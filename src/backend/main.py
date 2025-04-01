import logging
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import uvicorn
from dotenv import load_dotenv

# Import our API modules
from api.speech_to_text import SpeechToTextService
from api.llm import LLMService
from api.text_to_speech import TextToSpeechService

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Hebrew Audio Chatbot",
    description="A chatbot that processes Hebrew speech and responds with audio",
    version="1.0.0",
)

# Configure CORS
if os.getenv("ENABLE_CORS", "true").lower() == "true":
    origins = json.loads(os.getenv("CORS_ORIGINS", '["*"]'))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Initialize services
speech_to_text = SpeechToTextService()
llm_service = LLMService()
text_to_speech = TextToSpeechService()

# WebSocket endpoint for real-time audio processing
@app.websocket("/ws/audio")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection established")
    
    try:
        while True:
            # Receive audio data from client
            audio_data = await websocket.receive_bytes()
            logger.debug(f"Received audio data: {len(audio_data)} bytes")
            
            # Process audio through our pipeline
            # 1. Convert speech to text
            text = await speech_to_text.transcribe(audio_data)
            logger.info(f"Transcribed text: {text}")
            
            if not text.strip():
                await websocket.send_text(json.dumps({"status": "error", "message": "Could not transcribe audio"}))
                continue
            
            # 2. Process with LLM
            llm_response = await llm_service.generate_response(text)
            logger.info(f"LLM response: {llm_response}")
            
            # 3. Convert text to speech
            audio_response = await text_to_speech.synthesize(llm_response)
            
            # Send response back to client
            await websocket.send_bytes(audio_response)
            
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in WebSocket connection: {str(e)}")
        try:
            await websocket.send_text(json.dumps({"status": "error", "message": str(e)}))
        except:
            pass

# Mount static files for serving the frontend
app.mount("/", StaticFiles(directory="src/frontend", html=True), name="frontend")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
