#!/usr/bin/env python3
"""ComplyDNA pilot demo smoke — /health + curated /v1/ask questions."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_QUESTIONS = ROOT / "evals" / "pilot_set.jsonl"
DEFAULT_API_KEY = "complydna_sk_test_local"


def load_questions(path: Path) -> list[str]:
    questions: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        payload = json.loads(line)
        question = payload.get("question", "").strip()
        if question:
            questions.append(question)
    return questions


def print_block(title: str, body: str) -> None:
    print(f"\n{'=' * 60}")
    print(title)
    print("=" * 60)
    print(body)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run ComplyDNA pilot demo smoke against a live API")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--questions", type=Path, default=DEFAULT_QUESTIONS)
    parser.add_argument("--api-key", default=os.environ.get("API_KEY", DEFAULT_API_KEY))
    parser.add_argument("--limit", type=int, default=0, help="Max questions (0 = all)")
    args = parser.parse_args(argv)

    base = args.base_url.rstrip("/")
    headers = {"X-API-Key": args.api_key, "Content-Type": "application/json"}

    questions = load_questions(args.questions)
    if args.limit > 0:
        questions = questions[: args.limit]

    if not questions:
        print("No questions found.", file=sys.stderr)
        return 1

    try:
        with httpx.Client(timeout=120.0) as client:
            health = client.get(f"{base}/health")
            health.raise_for_status()
            health_body = health.json()
            print_block(
                "HEALTH",
                json.dumps(health_body, ensure_ascii=False, indent=2),
            )

            failures = 0
            for index, question in enumerate(questions, start=1):
                response = client.post(
                    f"{base}/v1/ask",
                    headers=headers,
                    json={"question": question},
                )
                if response.status_code != 200:
                    failures += 1
                    print_block(
                        f"Q{index} FAILED ({response.status_code})",
                        f"Q: {question}\n\n{response.text}",
                    )
                    continue

                body = response.json()
                sources = body.get("sources") or []
                source_lines = [
                    f"- {item.get('citation')} (skor {item.get('score', 0):.3f})"
                    for item in sources[:3]
                ]
                print_block(
                    f"Q{index}",
                    "\n".join(
                        [
                            f"Q: {question}",
                            f"A: {body.get('answer', '')}",
                            "",
                            "KAYNAKLAR:",
                            *(source_lines or ["- (boş)"]),
                            "",
                            f"model={body.get('model_version')} index={body.get('index_version')}",
                        ]
                    ),
                )

    except httpx.HTTPError as exc:
        print(f"API unreachable at {base}: {exc}", file=sys.stderr)
        print("Start the server: make serve", file=sys.stderr)
        return 1

    if failures:
        print(f"\n{failures} question(s) failed.", file=sys.stderr)
        return 1

    print(f"\nPilot demo smoke OK — {len(questions)} question(s).")
    print(f"UI: {base}/demo/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
