FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-fra \
    tesseract-ocr-deu \
    tesseract-ocr-spa \
    poppler-utils \
    libmagic1 \
    libmagic-dev \
    gcc \
    g++ \
    build-essential \
    libffi-dev \
    libssl-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Download required NLTK data
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords')"

# Download spaCy model
RUN python -m spacy download en_core_web_sm

# Create necessary directories
RUN mkdir -p /app/temp /app/cache /app/uploads /app/lib/python

# Copy application files
COPY lib/python/ /app/lib/python/
COPY docker/unstructured-local/health_check.py /app/health_check.py

# Make Python script executable
RUN chmod +x /app/lib/python/enhanced_unstructured_processor.py

# Set environment variables
ENV PYTHONPATH=/app
ENV TEMP_DIR=/app/temp
ENV CACHE_DIR=/app/cache
ENV PYTHONIOENCODING=utf-8
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python /app/health_check.py

# Expose port
EXPOSE 8000

# Create non-root user for security
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Start command
CMD ["python", "/app/lib/python/fastapi_server.py"] 