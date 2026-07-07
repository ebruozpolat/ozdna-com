from app.config import Settings
from app.observability.posthog_otel import setup_posthog_otel


def test_setup_posthog_otel_noop_without_api_key() -> None:
    assert setup_posthog_otel(Settings(posthog_api_key="")) is False
