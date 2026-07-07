from app.version import resolve_git_sha


def test_resolve_git_sha_returns_non_empty() -> None:
    resolve_git_sha.cache_clear()
    assert resolve_git_sha()
