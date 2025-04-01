# Hebrew Audio Chatbot

A cloud-based web application that continuously listens for Hebrew speech, transcribes it, analyzes it through an LLM, and responds with synthesized Hebrew speech.

## Features

- Continuous listening with voice activity detection (VAD)
- Hebrew speech recognition using Google Cloud Speech-to-Text API
- Natural language processing using OpenAI's LLM API
- Hebrew speech synthesis using Google Cloud Text-to-Speech API
- Real-time audio visualization
- Responsive web interface optimized for Hebrew

## Architecture

The application is built with a client-server architecture:

- **Frontend**: HTML, CSS, and JavaScript for handling audio recording, voice activity detection, and user interface
- **Backend**: Python FastAPI server for processing audio, connecting to cloud services, and WebSocket communication

```
                                  ┌─────────────────┐
                                  │  OpenAI API     │
                                  │  (LLM Analysis) │
                                  └────────┬────────┘
                                           │
┌───────────────┐   WebSocket    ┌────────▼────────┐    ┌─────────────────┐
│  Web Browser  │◄─────────────► │  Python Backend  │◄──►│  Google Speech  │
│  (Frontend)   │   Audio Data   │  (FastAPI)       │    │  API (STT/TTS)  │
└───────────────┘                └─────────────────┘    └─────────────────┘
```

## Prerequisites

To run this application, you need:

- Python 3.8 or higher
- Node.js and npm (for local development)
- Google Cloud Platform account with Speech-to-Text and Text-to-Speech APIs enabled
- OpenAI API key
- Docker (for containerization and deployment)

## Local Development Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/hebrew-audio-chatbot.git
cd hebrew-audio-chatbot
```

2. **Create a virtual environment**

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**

```bash
pip install -r requirements.txt
```

4. **Set up environment variables**

```bash
cp config/.env.example .env
```

Edit the `.env` file to add your API keys and Google Cloud credentials:

```
GOOGLE_APPLICATION_CREDENTIALS="path/to/your-service-account-key.json"
GCP_PROJECT_ID="your-gcp-project-id"
OPENAI_API_KEY="your-openai-api-key"
```

5. **Run the application locally**

```bash
python -m src.backend.main
```

The application will be available at http://localhost:8000

## Deployment to Google Cloud Platform

### Using the Deployment Script

1. Make the deployment script executable (if not already):

```bash
chmod +x gcp-deploy.sh
```

2. Run the deployment script:

```bash
./gcp-deploy.sh
```

The script will:
- Check if you have the necessary tools installed
- Ask for your GCP Project ID
- Enable the required APIs
- Create a service account with the necessary permissions
- Build and push the Docker image to Google Artifact Registry
- Deploy the application to Cloud Run
- Display the URL where your application is running

### Manual Deployment

If you prefer to deploy manually, follow these steps:

1. **Build the Docker image**

```bash
docker build -t gcr.io/[PROJECT_ID]/hebrew-audio-chatbot .
```

2. **Push the image to Google Container Registry**

```bash
docker push gcr.io/[PROJECT_ID]/hebrew-audio-chatbot
```

3. **Deploy to Cloud Run**

```bash
gcloud run deploy hebrew-audio-chatbot \
  --image gcr.io/[PROJECT_ID]/hebrew-audio-chatbot \
  --platform managed \
  --region [REGION] \
  --allow-unauthenticated
```

## Technical Considerations and Potential Issues

### 1. Voice Activity Detection (VAD)

The application uses client-side voice activity detection to determine when the user starts and stops speaking. This may not always be 100% accurate, especially in noisy environments or with different microphones.

**Solutions:**
- Adjust the VAD sensitivity parameters in `config.vadOptions` in `main.js`
- Consider adding a manual button for stopping recording

### 2. Hebrew Speech Recognition Accuracy

Google's Speech-to-Text accuracy for Hebrew may vary depending on:

- Dialect and accent 
- Microphone quality
- Background noise
- Speaking clarity

**Solutions:**
- Use a high-quality microphone
- Speak clearly and at a moderate pace
- Ensure a quiet environment
- Consider using speech adaptation features to improve recognition of specific terms

### 3. WebSocket Connectivity

WebSocket connections may disconnect due to network issues, timeouts, or server restarts.

**Solutions:**
- The application includes automatic reconnection logic
- Set appropriate timeout and keepalive settings
- Consider adding fallback to HTTP requests if WebSockets are not available

### 4. Browser Compatibility

The application uses modern web APIs that may not be supported in all browsers:

- Web Audio API
- MediaRecorder API
- WebSocket API

**Solutions:**
- Use modern browsers (Chrome, Firefox, Edge, Safari)
- Add feature detection and graceful degradation
- Consider adding polyfills for broader compatibility

### 5. Cloud Costs

Using Google Cloud Speech-to-Text, Text-to-Speech, and OpenAI APIs incurs costs:

- Speech-to-Text: ~$0.006 per 15 seconds of audio
- Text-to-Speech: ~$4 per 1 million characters
- OpenAI API: Varies by model and usage

**Solutions:**
- Implement usage limits and quotas
- Monitor usage with Google Cloud Monitoring
- Consider caching common responses

### 6. Performance and Latency

Real-time speech processing involves multiple network requests which can introduce latency:

1. Audio upload to backend
2. Speech-to-Text processing
3. LLM API request
4. Text-to-Speech synthesis
5. Audio download and playback

**Solutions:**
- Use the closest GCP region to your users
- Optimize audio format and quality
- Consider streaming responses when possible
- Add appropriate visual feedback during processing

## Troubleshooting

### Common Issues

1. **"Cannot access microphone"**
   - Ensure you've granted microphone permissions in your browser
   - Check if another application is using the microphone
   - Try reloading the page

2. **"Cannot connect to server"**
   - Check your internet connection
   - Verify the server is running
   - Check if there are any firewall rules blocking WebSocket connections

3. **"Speech not recognized"**
   - Ensure you're speaking clearly in Hebrew
   - Check the microphone is functioning and not muted
   - Try adjusting your distance from the microphone

4. **"No response from LLM"**
   - Verify your OpenAI API key is valid and has sufficient quota
   - Check the server logs for specific error messages
   - Ensure your request isn't being filtered by content policies

5. **Deployment failures**
   - Ensure all required APIs are enabled in GCP
   - Check service account permissions
   - Validate Dockerfile and application code
   - Review Cloud Run logs for specific errors

## License

[MIT License](LICENSE)

---

For questions or support, please open an issue on the GitHub repository.
