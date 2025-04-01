# Setting Up Your Local Environment Variables

This guide explains how to configure your local environment variables for the Hebrew Audio Chatbot application using the provided `.env.example` file.

## What are Environment Variables?

Environment variables are a way to store configuration settings outside of your application code. This allows you to:

1. Keep sensitive information (like API keys) out of your code
2. Change configuration without modifying code
3. Use different settings in different environments (development, testing, production)

## Setting Up Your .env File

The repository includes a `.env.example` file in the `config` directory. This file shows you what environment variables need to be set, but doesn't contain actual values. You'll need to create your own `.env` file with your specific configuration.

### Step 1: Create Your .env File

Copy the example file to create your own `.env` file:

```bash
cp config/.env.example .env
```

This will create a new `.env` file in the root directory of your project.

### Step 2: Edit Your .env File

Open the `.env` file in your favorite text editor and replace the placeholder values with your actual configuration:

```
# GCP Settings
GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/your-service-account-key.json"
GCP_PROJECT_ID="your-gcp-project-id"

# OpenAI API Settings
OPENAI_API_KEY="your-openai-api-key"

# Application Settings
LOG_LEVEL="INFO"
PORT=8000
ENABLE_CORS=true
CORS_ORIGINS=["http://localhost:3000", "https://yourdomain.com"]

# Audio Settings
DEFAULT_LANGUAGE_CODE="he-IL"
DEFAULT_VOICE_NAME="he-IL-Standard-A"
MAX_AUDIO_DURATION_SECONDS=60
```

### Step 3: Update the Values

For each variable, replace the placeholder with your actual value:

#### GCP Settings
- `GOOGLE_APPLICATION_CREDENTIALS`: The absolute path to your Google Cloud service account key JSON file. See [GOOGLE_CREDENTIALS_GUIDE.md](GOOGLE_CREDENTIALS_GUIDE.md) for instructions on obtaining this file.
- `GCP_PROJECT_ID`: Your Google Cloud Project ID. You can find this in the Google Cloud Console.

#### OpenAI API Settings
- `OPENAI_API_KEY`: Your OpenAI API key. See [OPENAI_API_GUIDE.md](OPENAI_API_GUIDE.md) for instructions on obtaining this key.

#### Application Settings
- `LOG_LEVEL`: The level of logging detail. Default is "INFO". Other options are "DEBUG", "WARNING", "ERROR", and "CRITICAL".
- `PORT`: The port number your application will listen on.
- `ENABLE_CORS`: Whether Cross-Origin Resource Sharing is enabled. Set to "true" for development.
- `CORS_ORIGINS`: A JSON array of allowed origins for CORS. Add your frontend domains here.

#### Audio Settings
- `DEFAULT_LANGUAGE_CODE`: The language code for Google's Speech and Text services. Keep this as "he-IL" for Hebrew.
- `DEFAULT_VOICE_NAME`: The specific voice model to use for text-to-speech. "he-IL-Standard-A" is a standard Hebrew voice.
- `MAX_AUDIO_DURATION_SECONDS`: The maximum duration for a single audio recording in seconds.

## Important Security Notes

1. **NEVER commit your `.env` file to Git or any version control system.** The `.env` file is already included in the `.gitignore` file to prevent accidental commits.
2. Keep your API keys and service account credentials secure.
3. For production deployments, use a proper secret management solution rather than `.env` files.

## Verifying Your Configuration

To verify that your environment variables are working correctly:

1. Run the application locally:
   ```bash
   python -m src.backend.main
   ```
2. Check the application logs to make sure there are no errors related to missing or invalid environment variables.

## Troubleshooting

If you encounter issues with your environment configuration:

1. Double-check all paths and values in your `.env` file.
2. Ensure that the service account key file exists at the specified path.
3. Verify that your API keys are valid and active.
4. Make sure you've followed all steps in the [GOOGLE_CREDENTIALS_GUIDE.md](GOOGLE_CREDENTIALS_GUIDE.md) and [OPENAI_API_GUIDE.md](OPENAI_API_GUIDE.md).
