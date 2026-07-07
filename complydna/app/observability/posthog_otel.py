from __future__ import annotations

from opentelemetry import trace
from opentelemetry.instrumentation.openai_v2 import OpenAIInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from posthog.ai.otel import PostHogSpanProcessor

from app.config import Settings

_initialized = False


def setup_posthog_otel(settings: Settings) -> bool:
    """Configure PostHog LLM analytics via OpenTelemetry. Idempotent; no-op without API key."""
    global _initialized
    if _initialized or not settings.posthog_api_key:
        return False

    attributes: dict[str, str] = {
        SERVICE_NAME: settings.posthog_service_name,
    }
    if settings.posthog_distinct_id:
        attributes["posthog.distinct_id"] = settings.posthog_distinct_id

    resource = Resource(attributes=attributes)
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(
        PostHogSpanProcessor(
            api_key=settings.posthog_api_key,
            host=settings.posthog_host,
        )
    )
    trace.set_tracer_provider(provider)
    OpenAIInstrumentor().instrument()
    _initialized = True
    return True
