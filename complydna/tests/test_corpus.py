from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARSED = ROOT / "data" / "parsed"


def test_parsed_corpus_includes_masak_and_kvkk() -> None:
    names = {path.name for path in PARSED.glob("*.jsonl")}
    assert "TEBLIG-MASAK-SAMPLE.jsonl" in names
    assert "LAW-KVKK.jsonl" in names
    assert "LAW-5549.jsonl" in names
    assert "LAW-6415.jsonl" in names
