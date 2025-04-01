# Use the official Python image as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies needed for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . .

# Make sure our code is in the Python path
ENV PYTHONPATH="/app:${PYTHONPATH}"

# Set environment variables
ENV PORT=8000
ENV HOST="0.0.0.0"

# Default to production environment - override with --build-arg ENV=development if needed
ARG ENV=production
ENV ENV=${ENV}

# Expose port for the application
EXPOSE 8000

# Run the application using uvicorn
CMD ["python", "-m", "src.backend.main"]
