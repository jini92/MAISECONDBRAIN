FROM python:3.13-slim

WORKDIR /app

# Install dependencies
COPY pyproject.toml .
COPY src/ src/
RUN pip install --no-cache-dir -e ".[embeddings]"

# Copy pre-built graph cache
COPY .mnemo/ /app/.mnemo/

# Environment defaults
ENV MNEMO_PROJECT_ROOT=/app
ENV MNEMO_VAULT_PATH=""
ENV MNEMO_MEMORY_PATH=""

EXPOSE 8000

CMD uvicorn src.mnemo.api:app --host 0.0.0.0 --port ${PORT:-8000}
