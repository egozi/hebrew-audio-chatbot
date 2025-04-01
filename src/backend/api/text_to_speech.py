import io
import logging
import os
from google.cloud import texttospeech

logger = logging.getLogger(__name__)

class TextToSpeechService:
    """
    Service for converting text to speech using Google Cloud Text-to-Speech API.
    Optimized for Hebrew language output.
    """
    
    def __init__(self):
        """Initialize the Text-to-Speech service with Google Cloud credentials."""
        self.client = texttospeech.TextToSpeechClient()
        self.language_code = os.getenv("DEFAULT_LANGUAGE_CODE", "he-IL")
        self.voice_name = os.getenv("DEFAULT_VOICE_NAME", "he-IL-Standard-A")
        logger.info(f"Initialized Text-to-Speech service with voice: {self.voice_name}")
        
        # Default audio configuration
        self.audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,  # Normal speaking rate
            pitch=0.0,  # Default pitch
            # Sample rate might need adjustment based on the client-side capabilities
            sample_rate_hertz=24000
        )
    
    async def synthesize(self, text: str) -> bytes:
        """
        Convert text to speech.
        
        Args:
            text: Text to be converted to speech (in Hebrew)
            
        Returns:
            Synthesized audio bytes
        """
        try:
            # Build the voice request
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            # Voice selection
            voice = texttospeech.VoiceSelectionParams(
                language_code=self.language_code,
                name=self.voice_name,
                # For Hebrew, you might want to try different genders and options
                # Adjust as necessary for better pronunciation
                ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
            )
            
            # Send request
            response = self.client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=self.audio_config
            )
            
            # Get audio content
            audio_content = response.audio_content
            logger.debug(f"Synthesized {len(audio_content)} bytes of audio")
            
            return audio_content
            
        except Exception as e:
            logger.error(f"Error in text-to-speech synthesis: {str(e)}")
            # Return an empty bytes object on error
            # Main.py will handle this appropriately
            return b""
