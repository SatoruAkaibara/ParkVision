# ai-engine/Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required by OpenCV and YOLO
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages
COPY Requirements.txt ./
RUN pip install --no-cache-dir -r Requirements.txt

# Copy the rest of the AI engine code
COPY . .

# Run the main Python script
CMD ["python", "main.py"]