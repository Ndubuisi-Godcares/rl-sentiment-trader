FROM python:3.12-slim

WORKDIR /app

# System dependencies required by torch and scipy
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libgomp1 git curl \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU-only FIRST to avoid downloading the 2.5 GB CUDA build
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining backend dependencies (torch already satisfied above)
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Pre-download and cache the FinBERT model inside the image so the first
# request doesn't incur a 400 MB download delay at runtime
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface
RUN python -c "\
from transformers import pipeline; \
pipeline('text-classification', model='yiyanghkust/finbert-tone', device=-1); \
print('FinBERT model cached.')"

# Copy source code
COPY backend/      /app/backend/
COPY trading_engine/ /app/trading_engine/

# Ensure logs directory exists (results are written here at runtime)
RUN mkdir -p /app/logs /app/data /app/reports

# Hugging Face Spaces requires port 7860
EXPOSE 7860

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]
