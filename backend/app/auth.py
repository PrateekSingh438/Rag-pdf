"""JWT authentication: hash/verify passwords, mint tokens, resolve current user."""
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from .models import User

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(p: str) -> str:
    return pwd.hash(p)


def verify_password(p: str, h: str) -> bool:
    return pwd.verify(p, h)


def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": str(user_id), "exp": expire},
                      settings.secret_key, algorithm=settings.algorithm)


def get_current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    err = HTTPException(status_code=401, detail="Invalid credentials")
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        uid = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise err
    user = db.get(User, uid)
    if not user:
        raise err
    return user
