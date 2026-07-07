FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY pyproject.toml README.md ./
COPY app ./app
COPY web ./web
COPY scripts ./scripts
COPY evals ./evals
COPY data/raw ./data/raw
COPY data/parsed ./data/parsed

RUN pip install --no-cache-dir -e ".[dev]"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
