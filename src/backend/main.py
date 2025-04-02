import logging
import os
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import uvicorn
from dotenv import load_dotenv
from langchain.memory import ConversationBufferMemory # Import Memory

# Import our API modules
from .api.speech_to_text import SpeechToTextService
from .api.llm import LLMService
from .api.text_to_speech import TextToSpeechService

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
    
    # Create a new memory instance for this connection
    # "chat_history" is the key LangChain uses for messages in this memory type
    memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True) 
    
    try:
        while True:
            # Receive audio data from client (using non-streaming approach now)
            audio_data = await websocket.receive_bytes()
            if not audio_data:
                 logger.info("Received empty bytes, closing connection.")
                 break # Close connection if client sends empty bytes (might signify end)

            logger.debug(f"Received audio data: {len(audio_data)} bytes")
            
            # Process audio through our pipeline
            # 1. Convert speech to text
            text = await speech_to_text.transcribe(audio_data)
            logger.info(f"Transcribed text: {text}")
            
            if not text.strip():
                await websocket.send_text(json.dumps({"type": "error", "message": "Could not transcribe audio"}))
                continue
            
            # 2. Process with LLM (passing memory)
            llm_response = await llm_service.generate_response(text, memory) # Pass memory object
            logger.info(f"LLM response: {llm_response}")
            
            # 3. Convert text to speech
            audio_response = await text_to_speech.synthesize(llm_response)
            
            # Send response back to client
            # Send LLM text first (optional, for UI update)
            await websocket.send_text(json.dumps({"type": "llm_response", "text": llm_response}))
            # Then send audio
            await websocket.send_bytes(audio_response)
            
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in WebSocket connection: {str(e)}", exc_info=True)
        try:
            # Send error only if websocket still seems connected
            if websocket.client_state == 1: # STATE_CONNECTED = 1
                 await websocket.send_text(json.dumps({"type": "error", "message": "An internal processing error occurred."}))
        except Exception as send_err:
            logger.error(f"Failed to send error message to WebSocket: {send_err}")
    finally:
         logger.info("WebSocket connection closed.")


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Mount static files AFTER API routes
app.mount("/", StaticFiles(directory="src/frontend", html=True), name="frontend")


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    reload = os.getenv("RELOAD", "true").lower() == "true"
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    logger.info(f"Starting server on {host}:{port} (Reload: {reload}, Log Level: {log_level})")
    uvicorn.run(
        "src.backend.main:app", 
        host=host, 
        port=port, 
        reload=reload,
        log_level=log_level
    )
