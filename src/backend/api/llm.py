import logging
import os
from openai import AsyncOpenAI
import time

logger = logging.getLogger(__name__)

class LLMService:
    """
    Service for generating responses using OpenAI's language models.
    Optimized for Hebrew language processing.
    """
    
    def __init__(self):
        """Initialize the LLM service with OpenAI API key."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.warning("OPENAI_API_KEY not found in environment variables.")
        
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = "gpt-4o"  # Default to the most capable model, can be configured in env vars
        logger.info(f"Initialized LLM service with model: {self.model}")
        
        # System prompt to define the chatbot's behavior
        # Note: The prompt is in English but instructs the model to respond in Hebrew
        self.system_prompt = """
        You are a helpful, friendly assistant who speaks fluent Hebrew.
        Always respond in Hebrew regardless of the language used in the query.
        Keep your responses conversational and concise.
        Be polite, helpful, and tailored to Israeli culture when appropriate.
        If you don't know something, say so in Hebrew rather than making up information.
        """
    
    async def generate_response(self, text: str) -> str:
        """
        Generate a response to the transcribed text using OpenAI.
        
        Args:
            text: The transcribed Hebrew text from the user
            
        Returns:
            LLM-generated response in Hebrew
        """
        try:
            start_time = time.time()
            
            # Create chat completion
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": text}
                ],
                temperature=0.7,
                max_tokens=150,  # Keep responses concise for voice
                top_p=1,
                frequency_penalty=0,
                presence_penalty=0
            )
            
            # Extract response text
            response_text = response.choices[0].message.content
            
            # Log response time for monitoring
            time_taken = time.time() - start_time
            logger.debug(f"LLM response generated in {time_taken:.2f} seconds")
            
            return response_text
            
        except Exception as e:
            logger.error(f"Error generating LLM response: {str(e)}")
            # Return a default Hebrew error message if we fail
            return "סליחה, אני לא יכול לענות כרגע. נא לנסות שוב מאוחר יותר."  # "Sorry, I can't answer right now. Please try again later."
