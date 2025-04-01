# Setting Up Google Cloud Platform Credentials

This guide explains how to set up a Google Cloud Platform (GCP) account and obtain the necessary credentials for the Hebrew Audio Chatbot application.

## 1. Create a Google Cloud Platform Account

If you don't already have a Google Cloud Platform account:

1. Go to [cloud.google.com](https://cloud.google.com/)
2. Click on "Get started for free" or "Start free"
3. Sign in with your Google account or create a new one
4. Complete the registration process (you'll need to provide credit card information, but GCP offers a free tier and credits for new users)

## 2. Create a New GCP Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. At the top of the page, click on the project dropdown
3. Click "New Project"
4. Enter a name for your project (e.g., "Hebrew Audio Chatbot")
5. Click "Create"

Make note of your **Project ID**, as you'll need it later.

## 3. Enable Required APIs

For the Hebrew Audio Chatbot, you need to enable two main APIs:

1. From the Google Cloud Console, select your project
2. In the left sidebar, navigate to "APIs & Services" > "Library"
3. Search for and enable the following APIs one by one:
   - "Cloud Speech-to-Text API"
   - "Cloud Text-to-Speech API"

For each API:
1. Click on the API name in the search results
2. Click "Enable"
3. Wait for the API to be enabled (should take just a few seconds)

## 4. Create a Service Account

1. In the left sidebar, navigate to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Enter a name for the service account (e.g., "hebrew-chatbot-service")
4. (Optional) Add a description
5. Click "Create and Continue"

## 5. Assign Roles to the Service Account

Now, you need to grant specific permissions to this service account:

1. Click "Add Role" and select "Cloud Speech Administrator" (or similar speech-related role)
2. Since specific Text-to-Speech roles might not be directly visible, we'll add broader access:
   - Click "Add Another Role" and select "Editor" (which includes TTS permissions)
   - Alternatively, search for any roles containing "Text" or "Speech" that seem appropriate
3. Click "Continue"
4. (Optional) Grant users access to this service account if needed
5. Click "Done"

**Important Note**: Google Cloud roles and permissions change frequently. If you can't find the exact roles mentioned:
- Try searching for "Speech" or "Text" in the role selector
- Consider using the "Editor" role which provides broader access
- For more precise permissions, you can also create a custom role with specific Text-to-Speech permissions via IAM > Roles > Create Role

## 6. Create and Download the Service Account Key

1. From the Service Accounts list, find the service account you just created
2. Click the three dots in the "Actions" column
3. Select "Manage keys"
4. Click "Add Key" > "Create new key"
5. Choose JSON as the key type
6. Click "Create"

The JSON key file will be automatically downloaded to your computer. This file is your **Google Application Credentials**. Keep it secure, as it grants access to your GCP resources.

## 7. Configure Your Application to Use the Credentials

There are two ways to use these credentials in your application:

### Option 1: Environment Variable (Recommended)

Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to the location of your JSON key file:

#### On Linux/macOS:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your-project-credentials.json"
```

#### On Windows (Command Prompt):
```cmd
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your-project-credentials.json
```

#### On Windows (PowerShell):
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your-project-credentials.json"
```

### Option 2: .env File (For Development)

Add the path to your credentials file in your `.env` file:
```
GOOGLE_APPLICATION_CREDENTIALS="/path/to/your-project-credentials.json"
GCP_PROJECT_ID="your-project-id"
```

## 8. Verify Your Setup

To verify that your credentials are working correctly:

1. Run the Hebrew Audio Chatbot application locally using:
   ```bash
   python -m src.backend.main
   ```
2. Check the application logs to make sure there are no authentication errors
3. Test the speech-to-text and text-to-speech functionality

## Important Security Notes

1. **NEVER commit your credential JSON file to Git or any version control system.** It should remain private and secure.
2. Make sure the JSON key file is listed in your `.gitignore` file (it should already be there).
3. For production deployments, use environment variables or secret management services to handle credentials.
4. Consider rotating your service account keys periodically for enhanced security.
5. When deploying to Google Cloud Run using our provided script, the credentials will be properly configured as a secret.

## Troubleshooting

If you encounter authentication errors:

1. Verify that the `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set correctly
2. Ensure the JSON key file exists at the specified path
3. Check that the service account has the necessary permissions
4. Confirm that the APIs are enabled for your project
5. If using Cloud Run deployment, verify that the service account is properly attached to your service

For more help with Google Cloud authentication, refer to the [official documentation](https://cloud.google.com/docs/authentication).
