"""Auth endpoints: register, login, current user, profile update, and Google
OAuth (authorization-code flow). Google users are created with a random,
unusable password hash and identified by their email."""
import os
import shutil
import secrets
from urllib.parse import urlencode
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..config import settings
from ..ratelimit import limiter
from ..database import get_db
from ..models import User, KnowledgeBase, QuizAttempt, DocumentFile
from ..schemas import UserCreate, UserOut, Token, ProfileUpdate, ChangePassword
from ..auth import hash_password, verify_password, create_access_token, get_current_user
from ..rag.store import delete_collection

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


@router.post("/register", response_model=Token)
@limiter.limit("10/hour")
def register(request: Request, body: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=body.email, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(user.id))


@router.post("/login", response_model=Token)
@limiter.limit("20/minute")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(get_db)):
    # OAuth2 form uses "username" for the email field.
    user = db.query(User).filter_by(email=form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
@router.patch("/profile", response_model=UserOut)
def update_me(body: ProfileUpdate, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    if body.name is not None:
        user.name = body.name.strip() or None
    if body.institution is not None:
        user.institution = body.institution.strip() or None
    if body.picture is not None:
        user.picture = body.picture.strip() or None
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password")
def change_password(body: ChangePassword, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"ok": True}


@router.delete("/me/data")
def delete_all_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Danger zone: wipe all of the user's knowledge bases, documents, conversations,
    quiz history, vectors, and uploaded files. The account itself is kept."""
    kbs = db.query(KnowledgeBase).filter_by(owner_id=user.id).all()
    for kb in kbs:
        try:
            delete_collection(kb.id)
        except Exception:
            pass
        kb_dir = os.path.join(settings.upload_dir, str(kb.id))
        if os.path.isdir(kb_dir):
            shutil.rmtree(kb_dir, ignore_errors=True)
        db.query(DocumentFile).filter_by(kb_id=kb.id).delete()
    db.query(QuizAttempt).filter_by(user_id=user.id).delete()
    for kb in kbs:
        db.delete(kb)  # cascades documents + conversations + messages
    db.commit()
    return {"deleted": True}


# ---- Google OAuth (authorization-code flow) ----
@router.get("/google/login")
def google_login():
    if not settings.google_client_id:
        raise HTTPException(503, "Google login is not configured on the server")
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
def google_callback(code: str | None = None, error: str | None = None,
                    db: Session = Depends(get_db)):
    def fail(reason: str):
        # Surface a coarse reason (never secrets) to diagnose OAuth failures.
        print(f"[google_oauth] callback failed: {reason}")
        return RedirectResponse(f"{settings.frontend_url}/login?error=google&reason={reason}")

    if error:
        return fail(f"provider_{error}")
    if not code:
        return fail("no_code")
    try:
        with httpx.Client(timeout=15) as client:
            tok = client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            })
            if tok.status_code != 200:
                print(f"[google_oauth] token exchange {tok.status_code}: {tok.text[:300]}")
                return fail(f"token_{tok.status_code}")
            access = tok.json().get("access_token")
            if not access:
                return fail("no_access_token")
            info = client.get(GOOGLE_USERINFO_URL,
                              headers={"Authorization": f"Bearer {access}"}).json()
    except httpx.HTTPError:
        return fail("http_error")

    email = info.get("email")
    if not email:
        return fail("no_email")
    user = db.query(User).filter_by(email=email).first()
    if not user:
        user = User(email=email,
                    hashed_password=hash_password(secrets.token_urlsafe(32)),
                    name=info.get("name"), picture=info.get("picture"))
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # backfill display name / avatar from Google if we don't have them
        changed = False
        if not user.name and info.get("name"):
            user.name, changed = info["name"], True
        if not user.picture and info.get("picture"):
            user.picture, changed = info["picture"], True
        if changed:
            db.commit()

    token = create_access_token(user.id)
    return RedirectResponse(f"{settings.frontend_url}/login?token={token}")
