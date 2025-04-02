import logging
import os
# from openai import AsyncOpenAI # LangChain uses its own client wrapper
import time
from langchain_openai import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.chains import LLMChain
from langchain.prompts import (
    ChatPromptTemplate,
    MessagesPlaceholder,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
)

logger = logging.getLogger(__name__)

class LLMService:
    """
    Service for generating responses using OpenAI's language models via LangChain,
    including conversation memory. Optimized for Hebrew language processing.
    """
    
    def __init__(self):
        """Initialize the LLM service."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            # Log warning, but LangChain might pick up the key from env automatically
            logger.warning("OPENAI_API_KEY not found in environment variables, LangChain might still find it.")
        
        self.model_name = "gpt-4o" # Or get from env var
        
        # Initialize the LangChain ChatOpenAI model
        # Note: LangChain handles async differently; the chain invocation might be async.
        self.llm = ChatOpenAI(model_name=self.model_name, temperature=0.7, max_tokens=150) 
        
        logger.info(f"Initialized LLM service with model: {self.model_name}")
        
        # System prompt remains the same
        self.system_prompt_text = """
        You are a helpful, friendly assistant who speaks fluent Hebrew.
        Always respond in Hebrew regardless of the language used in the query.
        Keep your responses conversational and concise.
        Be polite, helpful, and tailored to Israeli culture when appropriate.
        If you don't know something, say so in Hebrew rather than making up information.
        """

        # Create the prompt template including memory placeholder
        self.prompt = ChatPromptTemplate(
            messages=[
                SystemMessagePromptTemplate.from_template(self.system_prompt_text),
                MessagesPlaceholder(variable_name="chat_history"), # Placeholder for memory
                HumanMessagePromptTemplate.from_template("{input}") # User input
            ]
        )

    # Note: Memory is now managed per connection in main.py
    # This service method now requires the memory object.
    async def generate_response(self, text: str, memory: ConversationBufferMemory) -> str:
        """
        Generate a response using the LLMChain with conversation memory.
        
        Args:
            text: The transcribed Hebrew text from the user.
            memory: The ConversationBufferMemory instance for this session.
            
        Returns:
            LLM-generated response in Hebrew.
        """
        try:
            start_time = time.time()
            
            # Create the LLMChain for this request, incorporating the memory
            conversation_chain = LLMChain(
                llm=self.llm,
                prompt=self.prompt,
                verbose=False, # Set to True for debugging LangChain steps
                memory=memory
            )

            # Run the chain asynchronously
            # Use .ainvoke for the async version of the chain
            response = await conversation_chain.ainvoke({"input": text})
            response_text = response.get("text", "") # Extract the response text

            # Log response time
            time_taken = time.time() - start_time
            logger.debug(f"LLM response generated in {time_taken:.2f} seconds (via LangChain)")
            
            return response_text.strip()
            
        except Exception as e:
            logger.error(f"Error generating LLM response via LangChain: {str(e)}", exc_info=True)
            return "סליחה, אני לא יכול לענות כרגע. נא לנסות שוב מאוחר יותר."
