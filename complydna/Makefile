.PHONY: help setup bootstrap ingest index eval eval-live eval-pilot eval-pilot-live test serve pilot up down docker-bootstrap logs

PYTHON ?= python3
VENV ?= .venv
BIN := $(VENV)/bin
PY := $(BIN)/python
PORT ?= 8000

help:
	@echo "ComplyDNA on-prem — common targets"
	@echo ""
	@echo "  make setup            venv + pip install -e \".[dev]\""
	@echo "  make bootstrap        ingest + index (local Qdrant at data/qdrant/)"
	@echo "  make ingest           data/raw → data/parsed"
	@echo "  make index            parsed JSONL → Qdrant"
	@echo "  make eval             offline golden-set eval"
	@echo "  make eval-live        live eval (indexed Qdrant + bge-m3)"
	@echo "  make eval-pilot       pilot set eval (offline stub)"
	@echo "  make eval-pilot-live  pilot set + live Qdrant/LLM (.env)"
	@echo "  make pilot            smoke /health + /v1/ask (API must be running)"
	@echo "  make test             pytest (unit, no integration)"
	@echo "  make serve            API + demo UI on http://localhost:$(PORT)/demo/"
	@echo "  make up               docker compose up --build -d"
	@echo "  make docker-bootstrap up + ingest + index inside api container"
	@echo "  make down             docker compose down"
	@echo "  make logs             docker compose logs -f api"

setup:
	$(PYTHON) -m venv $(VENV)
	$(BIN)/pip install -U pip
	$(BIN)/pip install -e ".[dev]"

ingest:
	@test -x $(PY) || (echo "run 'make setup' first" && exit 1)
	$(PY) scripts/ingest.py --source data/raw --output data/parsed

index:
	@test -x $(PY) || (echo "run 'make setup' first" && exit 1)
	$(PY) -m app.services.indexer --source data/parsed

bootstrap: ingest index

eval:
	@test -x $(PY) || (echo "run 'make setup' first" && exit 1)
	$(PY) evals/run.py

eval-live:
	@test -x $(PY) || (echo "run 'make setup' first" && exit 1)
	$(PY) evals/run.py --live

eval-pilot:
	@test -x $(PY) || (echo "run 'make setup' first" && exit 1)
	$(PY) evals/run.py --golden-set evals/pilot_set.jsonl

eval-pilot-live:
	@test -x $(PY) || (echo "run 'make setup' first" && exit 1)
	$(PY) evals/run.py --live --golden-set evals/pilot_set.jsonl

pilot:
	@test -x $(PY) || (echo "run 'make setup' first" && exit 1)
	$(PY) scripts/pilot_demo.py

test:
	@test -x $(PY) || (echo "run 'make setup' first" && exit 1)
	$(PY) -m pytest -m "not integration" -q

serve:
	@test -x $(BIN)/uvicorn || (echo "run 'make setup' first" && exit 1)
	$(BIN)/uvicorn app.main:app --host 0.0.0.0 --port $(PORT)

up:
	docker compose up --build -d

docker-bootstrap: up
	@echo "Waiting for Qdrant…"
	@sleep 4
	docker compose exec -T api python scripts/ingest.py --source data/raw --output data/parsed
	docker compose exec -T api python -m app.services.indexer --source data/parsed
	@echo "Demo: http://localhost:$(PORT)/demo/"

down:
	docker compose down

logs:
	docker compose logs -f api
