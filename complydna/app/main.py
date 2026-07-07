from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes.ask import router as ask_router
from app.config import get_settings
from app.observability import setup_posthog_otel
from app.version import resolve_git_sha

settings = get_settings()
setup_posthog_otel(settings)
WEB_DIR = Path(__file__).resolve().parent.parent / "web"

app = FastAPI(title=settings.app_name, debug=settings.debug)
app.include_router(ask_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "index_version": settings.index_version,
        "model_version": settings.model_version,
        "git_sha": resolve_git_sha(),
    }


@app.get("/")
def root() -> RedirectResponse:
    return RedirectResponse(url="/demo/")


if WEB_DIR.is_dir():
    app.mount("/demo", StaticFiles(directory=str(WEB_DIR), html=True), name="demo")
