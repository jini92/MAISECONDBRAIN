FROM python:3.13-slim

WORKDIR /app

# Install system deps for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY pyproject.toml .
COPY src/ src/
RUN pip install --no-cache-dir -e ".[embeddings]" psycopg2-binary

# Copy pre-built graph cache (legacy fallback)
COPY .mnemo/ /app/.mnemo/

# Environment defaults
ENV MNEMO_PROJECT_ROOT=/app
ENV MNEMO_VAULT_PATH=""
ENV MNEMO_MEMORY_PATH=""

EXPOSE 8000

CMD uvicorn src.mnemo.api:app --host 0.0.0.0 --port ${PORT:-8000}
