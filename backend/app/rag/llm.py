"""Groq LLM client. chat() for one-shot calls (eval, practice questions),
chat_stream() yields tokens for the streaming chat endpoint.

The model id and key come from settings, so the provider/model are swappable via
.env without touching call sites."""
from groq import Groq
from ..config import settings

_client = Groq(api_key=settings.groq_api_key)


def chat(messages, temperature=0.2, max_tokens=1024, response_format=None) -> str:
    kwargs = dict(model=settings.groq_model, messages=messages,
                  temperature=temperature, max_tokens=max_tokens)
    if response_format:  # e.g. {"type": "json_object"} for structured output
        kwargs["response_format"] = response_format
    r = _client.chat.completions.create(**kwargs)
    return r.choices[0].message.content


def chat_stream(messages, temperature=0.2, max_tokens=1024):
    stream = _client.chat.completions.create(model=settings.groq_model,
                                             messages=messages, temperature=temperature,
                                             max_tokens=max_tokens, stream=True)
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
