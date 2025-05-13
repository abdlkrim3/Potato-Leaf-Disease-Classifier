from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np
from io import BytesIO
from PIL import Image
import tensorflow as tf
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
origins = [
    "http://localhost",
    "http://localhost:5173",  # Vite default port
    "http://127.0.0.1",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model configuration
MODEL_PATH = "C:/Users/lenovo/OneDrive/Desktop/potato_desais/potato-disease-classification/potatoes.h5"
IMAGE_SIZE = (256, 256)  # Update with your model's expected input size

# Load model
try:
    MODEL = tf.keras.models.load_model(MODEL_PATH)
    logger.info(f"Model loaded successfully from {MODEL_PATH}")
except Exception as e:
    logger.error(f"Error loading model: {e}")
    raise RuntimeError(f"Could not load model from {MODEL_PATH}")

CLASS_NAMES = ["Early Blight", "Late Blight", "Healthy"]

# Treatment advice mapping
TREATMENT_ADVICE = {
    "Early Blight": "Apply copper-based fungicides weekly. Remove infected leaves promptly.",
    "Late Blight": "URGENT: Remove and destroy infected plants. Use fungicides with mancozeb.",
    "Healthy": "No treatment needed. Maintain proper watering and fertilization."
}

@app.get("/ping")
async def ping():
    return {"status": "alive", "message": "Model serving API is running"}

def read_file_as_image(data) -> np.ndarray:
    """Read and preprocess image data"""
    try:
        image = Image.open(BytesIO(data))
        if image.mode != 'RGB':
            image = image.convert('RGB')
        image = image.resize(IMAGE_SIZE)
        return np.array(image)
    except Exception as e:
        logger.error(f"Image processing error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """Make prediction on uploaded image"""
    try:
        # Verify file is an image
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")

        # Read and preprocess image
        contents = await file.read()
        image = read_file_as_image(contents)
        image = image / 255.0  # Normalize if your model expects [0,1]
        
        # Predict
        img_batch = np.expand_dims(image, 0)
        predictions = MODEL.predict(img_batch)
        
        # Format response
        predicted_class = CLASS_NAMES[np.argmax(predictions[0])]
        confidence = float(np.max(predictions[0]))
        
        # Create class probabilities dictionary
        class_probabilities = {
            CLASS_NAMES[i]: float(predictions[0][i]) 
            for i in range(len(CLASS_NAMES))
        }

        # Return properly formatted JSON
        return {
            "prediction": predicted_class,
            "confidence": confidence,
            "class_probabilities": class_probabilities,
            "advice": TREATMENT_ADVICE.get(predicted_class, "No specific advice available.")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)