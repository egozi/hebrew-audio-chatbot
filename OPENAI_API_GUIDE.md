# Setting Up an OpenAI API Key

This guide explains how to obtain an OpenAI API key for use with the Hebrew Audio Chatbot application.

## 1. Create an OpenAI Account

First, you need to create an account on the OpenAI platform:

1. Go to [https://platform.openai.com/signup](https://platform.openai.com/signup)
2. Sign up with your email, a Google account, or a Microsoft account
3. Follow the verification process to confirm your email
4. Complete your profile information as requested

## 2. Add a Payment Method

To access the OpenAI API, you need to add a payment method to your account:

1. Log in to your OpenAI account at [https://platform.openai.com/](https://platform.openai.com/)
2. Click on your profile icon in the top-right corner
3. Select "Billing" from the dropdown menu
4. Click "Add payment method"
5. Enter your credit card information
6. Set a usage limit if desired to control costs

## 3. Generate an API Key

Once your account is set up with a payment method, you can generate an API key:

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. (Optional) Add a name for your key to help you remember what it's used for (e.g., "Hebrew Audio Chatbot")
4. Click "Create secret key"
5. **Important:** Copy your API key immediately and store it securely. You won't be able to see the full key again after closing the dialog.

## 4. Configure Your Application to Use the API Key

There are two ways to use the API key in your application:

### Option 1: Environment Variable (Recommended)

Set the `OPENAI_API_KEY` environment variable:

#### On Linux/macOS:
```bash
export OPENAI_API_KEY="your-api-key-here"
```

#### On Windows (Command Prompt):
```cmd
set OPENAI_API_KEY=your-api-key-here
```

#### On Windows (PowerShell):
```powershell
$env:OPENAI_API_KEY="your-api-key-here"
```

### Option 2: .env File (For Development)

Add your API key to your `.env` file:
```
OPENAI_API_KEY="your-api-key-here"
```

## 5. Verify Your Setup

To verify that your API key is working correctly:

1. Run the Hebrew Audio Chatbot application locally using:
   ```bash
   python -m src.backend.main
   ```
2. Check the application logs to make sure there are no authentication errors
3. Test the LLM functionality

## Important Security Notes

1. **NEVER commit your API key to Git or any version control system.** It should remain private and secure.
2. Make sure the `.env` file is listed in your `.gitignore` file (it should already be there).
3. For production deployments, use environment variables or secret management services to handle the API key.
4. Consider using OpenAI's organization settings to track usage across different applications.
5. When deploying to Google Cloud Run using our provided script, the API key will be properly configured as a secret.

## Understanding API Usage and Costs

- OpenAI charges based on the number of tokens processed (both input and output)
- Different models have different pricing tiers
- You can set usage limits in your OpenAI account settings
- Monitor your usage regularly on the [OpenAI usage dashboard](https://platform.openai.com/usage)

## Troubleshooting

If you encounter authentication errors:

1. Verify that the `OPENAI_API_KEY` environment variable is set correctly
2. Ensure the API key is valid and active
3. Check your OpenAI account billing status
4. Confirm that you have sufficient credits or payment methods set up
5. If using Cloud Run deployment, verify that the API key secret is properly configured

For more help with OpenAI API authentication, refer to the [official documentation](https://platform.openai.com/docs/api-reference/authentication).
