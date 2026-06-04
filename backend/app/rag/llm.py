"""Groq LLM client. chat() for one-shot calls (eval, practice questions),
chat_stream() yields tokens for the streaming chat endpoint.

The model id and key come from settings, so the provider/model are swappable via
.env without touching call sites. Callers may also pass an explicit `model` to
override per request (used by the in-app model picker), validated against
AVAILABLE_MODELS so only known Groq models are ever sent."""
from groq import Groq
from ..config import settings

_client = Groq(api_key=settings.groq_api_key)

# Models the user can pick in the UI. First entry is the implicit fallback.
# 8B has the largest free-tier budget; 70B trades speed for answer quality.
AVAILABLE_MODELS = [
    {"id": "llama-3.1-8b-instant", "label": "Llama 3.1 8B",
     "description": "Fast · largest free-tier budget"},
    {"id": "llama-3.3-70b-versatile", "label": "Llama 3.3 70B",
     "description": "Higher quality · slower, smaller budget"},
]
_ALLOWED = {m["id"] for m in AVAILABLE_MODELS}


def resolve_model(model: str | None) -> str:
    """Pick a valid model id: an allowed override, else the configured default,
    else the first model in the catalog. Guards against arbitrary input."""
    if model and model in _ALLOWED:
        return model
    if settings.groq_model in _ALLOWED:
        return settings.groq_model
    return AVAILABLE_MODELS[0]["id"]


def chat(messages, temperature=0.2, max_tokens=1024, response_format=None,
         model: str | None = None) -> str:
    kwargs = dict(model=resolve_model(model), messages=messages,
                  temperature=temperature, max_tokens=max_tokens)
    if response_format:  # e.g. {"type": "json_object"} for structured output
        kwargs["response_format"] = response_format
    r = _client.chat.completions.create(**kwargs)
    return r.choices[0].message.content


def chat_stream(messages, temperature=0.2, max_tokens=1024, model: str | None = None):
    stream = _client.chat.completions.create(model=resolve_model(model),
                                             messages=messages, temperature=temperature,
                                             max_tokens=max_tokens, stream=True)
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
