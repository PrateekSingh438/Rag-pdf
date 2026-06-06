"""Shared rate limiter. Endpoints that hit the LLM, touch storage, or are abuse
targets (auth) import `limiter` and decorate themselves with @limiter.limit(...).

The key is the client IP. Behind Hugging Face Spaces / Vercel the socket peer is a
proxy, so we read the real client from X-Forwarded-For and fall back to the socket
address for local/direct calls."""
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip)
