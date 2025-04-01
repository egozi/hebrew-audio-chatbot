import io
import logging
import os
from google.cloud import speech_v1p1beta1 as speech
from pydub import AudioSegment

logger = logging.getLogger(__name__)

class SpeechToTextService:
    """
    Service for transcribing audio to text using Google Cloud Speech-to-Text API.
    Optimized for Hebrew language processing.
    """
    
    def __init__(self):
        """Initialize the Speech-to-Text service with Google Cloud credentials."""
        self.client = speech.SpeechClient()
        self.language_code = os.getenv("DEFAULT_LANGUAGE_CODE", "he-IL")
        logger.info(f"Initialized Speech-to-Text service with language code: {self.language_code}")
    
    async def transcribe(self, audio_data: bytes) -> str:
        """
        Transcribe audio data to text.
        
        Args:
            audio_data: Raw audio bytes from the client
            
        Returns:
            Transcribed text in Hebrew
        """
        try:
            # Convert audio to proper format if needed
            # Google STT expects LINEAR16 (PCM) audio at 16kHz sample rate for optimal results
            audio = AudioSegment.from_file(io.BytesIO(audio_data))
            
            # Ensure correct format for Google STT (mono, 16kHz, 16-bit PCM)
            if audio.channels > 1:
                audio = audio.set_channels(1)  # Convert to mono
            
            if audio.frame_rate != 16000:
                audio = audio.set_frame_rate(16000)  # Convert to 16kHz
            
            # Export as WAV in memory
            buf = io.BytesIO()
            audio.export(buf, format="wav")
            content = buf.getvalue()
            
            # Configure request
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=16000,
                language_code=self.language_code,
                # Enable automatic punctuation
                enable_automatic_punctuation=True,
                # You can add additional settings for Hebrew-specific models or adaptation
                # For best results with Hebrew, consider adding model="command_and_search"
                # or other model variants that work well with Hebrew
            )
            
            # Create audio object
            audio = speech.RecognitionAudio(content=content)
            
            # Send request
            response = self.client.recognize(config=config, audio=audio)
            
            # Process response
            full_transcript = ""
            for result in response.results:
                transcript = result.alternatives[0].transcript
                full_transcript += transcript + " "
            
            logger.debug(f"Transcription complete: {full_transcript}")
            return full_transcript.strip()
            
        except Exception as e:
            logger.error(f"Error in transcription: {str(e)}")
            # Return empty string on error, the main.py will handle this
            return ""
