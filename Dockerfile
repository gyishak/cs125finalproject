FROM python:3.11-slim

# Work inside /app in the container
WORKDIR /app

# Copy dependency list and install
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your project into the image
COPY . /app

# FastAPI will run on port 8000 in the container
EXPOSE 8000

# Start the FastAPI app with Uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

