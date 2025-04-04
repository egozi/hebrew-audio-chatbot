#!/bin/bash
# Deployment script for Hebrew Audio Chatbot to Google Cloud Run

# Exit on error
set -e

# Extract OPENAI_API_KEY from .env file if it exists
if [ -f .env ]; then
    echo "Extracting OPENAI_API_KEY from .env file..."
    # Use grep to find the line, cut to get the value after '=', and sed to remove potential quotes
    OPENAI_API_KEY_VALUE=$(grep '^OPENAI_API_KEY=' .env | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    if [ -n "$OPENAI_API_KEY_VALUE" ]; then
        export OPENAI_API_KEY="$OPENAI_API_KEY_VALUE"
        echo "OPENAI_API_KEY extracted."
    else
        echo "Warning: OPENAI_API_KEY not found or empty in .env file."
    fi
else
    echo "Warning: .env file not found. OPENAI_API_KEY cannot be extracted."
fi


# Configuration
PROJECT_ID="hebrew-audio-chatbot"
REGION="us-central1"  # Choose the region closest to your users (e.g., europe-west1 for Europe)
SERVICE_NAME="hebrew-audio-chatbot"
IMAGE_NAME="hebrew-audio-chatbot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print step information
print_step() {
    echo -e "\n${GREEN}=== $1 ===${NC}\n"
}

# Function to print error and exit
error_exit() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    exit 1
}

# Check if required tools are installed
check_requirements() {
    print_step "Checking requirements"
    
    # Check gcloud
    if ! command -v gcloud &> /dev/null; then
        error_exit "gcloud CLI is not installed. Please install Google Cloud SDK from https://cloud.google.com/sdk/docs/install"
    fi
    
    # Check docker
    if ! command -v docker &> /dev/null; then
        error_exit "docker is not installed. Please install Docker from https://docs.docker.com/get-docker/"
    fi
    
    echo -e "${GREEN}All requirements satisfied.${NC}"
}

# Setup configuration
setup_config() {
    print_step "Setting up configuration"
    
    # Get GCP project ID if not set
    if [ -z "$PROJECT_ID" ]; then
        echo -e "${YELLOW}Please enter your Google Cloud Project ID:${NC}"
        read PROJECT_ID
        
        if [ -z "$PROJECT_ID" ]; then
            error_exit "Project ID cannot be empty"
        fi
    fi
    
    echo "Using Project ID: $PROJECT_ID"
    echo "Using Region: $REGION"
    echo "Service Name: $SERVICE_NAME"
    
    # Configure gcloud to use this project
    echo "Setting gcloud project to $PROJECT_ID..."
    gcloud config set project $PROJECT_ID || error_exit "Failed to set gcloud project"
}

# Check and enable required APIs
enable_apis() {
    print_step "Enabling required GCP APIs"
    
    # List of required APIs
    APIS=(
        "cloudbuild.googleapis.com"
        "run.googleapis.com"
        "artifactregistry.googleapis.com"
        "speech.googleapis.com"
        "texttospeech.googleapis.com"
    )
    
    for api in "${APIS[@]}"; do
        echo "Enabling $api..."
        gcloud services enable $api || error_exit "Failed to enable $api"
    done
    
    echo -e "${GREEN}All required APIs have been enabled.${NC}"
}

# Create service account for the application
create_service_account() {
    print_step "Creating service account"
    
    SA_NAME="$SERVICE_NAME-sa"
    SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
    
    # Check if service account already exists
    if gcloud iam service-accounts describe $SA_EMAIL &> /dev/null; then
        echo "Service account $SA_EMAIL already exists."
    else
        echo "Creating service account $SA_NAME..."
        gcloud iam service-accounts create $SA_NAME \
            --display-name "$SERVICE_NAME Service Account" || error_exit "Failed to create service account"
    fi
    
    # Grant necessary roles
    echo "Granting roles to service account..."
    
    # Speech-to-Text roles
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/speech.admin" || echo "Warning: Could not assign Speech Administrator role"
    
    # Add Editor role for broader access including Text-to-Speech
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/editor" || echo "Warning: Could not assign Editor role"
    
    echo "Note: Using Editor role which includes Text-to-Speech permissions."
    echo "For more restricted permissions, consider creating a custom role in the Google Cloud Console."
    
    # Create and download key
    echo "Creating service account key..."
    KEY_FILE="$SA_NAME-key.json"
    
    if [ -f "$KEY_FILE" ]; then
        echo "Key file already exists at $KEY_FILE. Using existing key."
    else
        gcloud iam service-accounts keys create $KEY_FILE \
            --iam-account=$SA_EMAIL || error_exit "Failed to create service account key"
        echo "Service account key saved to $KEY_FILE"
    fi

    # Store the key in Secret Manager
    SA_KEY_SECRET_NAME="$SA_NAME-key-secret"
    echo "Storing service account key in Secret Manager as $SA_KEY_SECRET_NAME..."
    
    if ! gcloud secrets describe $SA_KEY_SECRET_NAME &> /dev/null; then
        echo "Creating secret $SA_KEY_SECRET_NAME..."
        gcloud secrets create $SA_KEY_SECRET_NAME \
            --replication-policy="automatic" \
            --data-file="$KEY_FILE" || error_exit "Failed to create secret for SA key"
    else
        echo "Secret $SA_KEY_SECRET_NAME already exists. Adding new version..."
        gcloud secrets versions add $SA_KEY_SECRET_NAME \
            --data-file="$KEY_FILE" || error_exit "Failed to add new version to SA key secret"
    fi

    # Grant Cloud Run service account access to the SA key secret
    echo "Granting service account $SA_EMAIL access to secret $SA_KEY_SECRET_NAME..."
    gcloud secrets add-iam-policy-binding $SA_KEY_SECRET_NAME \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/secretmanager.secretAccessor" || echo "Warning: Could not grant SA access to its key secret"

}

# Build and push Docker image
build_and_push_image() {
    print_step "Building and pushing Docker image"
    
    # Create artifacts repository if it doesn't exist
    REPO_NAME="images"
    REPO_PATH="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME"
    
    # Check if repository exists
    if ! gcloud artifacts repositories describe $REPO_NAME --location=$REGION &> /dev/null; then
        echo "Creating Artifact Registry repository..."
        gcloud artifacts repositories create $REPO_NAME \
            --repository-format=docker \
            --location=$REGION \
            --description="Docker images repository" || error_exit "Failed to create repository"
    fi
    
    # Configure Docker to use gcloud credentials
    echo "Configuring Docker authentication..."
    gcloud auth configure-docker $REGION-docker.pkg.dev || error_exit "Failed to configure Docker auth"
    
    # Build and push the image
    echo "Building Docker image..."
    docker build -t $REPO_PATH/$IMAGE_NAME:latest . || error_exit "Docker build failed"
    
    echo "Pushing Docker image to Artifact Registry..."
    docker push $REPO_PATH/$IMAGE_NAME:latest || error_exit "Docker push failed"
    
    IMAGE_URL="$REPO_PATH/$IMAGE_NAME:latest"
    echo "Image URL: $IMAGE_URL"
}

# Deploy to Cloud Run
deploy_to_cloud_run() {
    print_step "Deploying to Cloud Run"
    
    # Get the image URL
    IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:latest"

    # Check if OPENAI_API_KEY is set (should be sourced from .env)
    if [ -z "$OPENAI_API_KEY" ]; then
        error_exit "OPENAI_API_KEY is not set in the environment or .env file. Please ensure it is defined."
    fi

    # Create or update the secret for the OpenAI API key
    SECRET_NAME="openai-api-key"
    
    if ! gcloud secrets describe $SECRET_NAME &> /dev/null; then
        echo "Creating secret for OpenAI API key..."
        echo -n "$OPENAI_API_KEY" | gcloud secrets create $SECRET_NAME \
            --replication-policy="automatic" \
            --data-file=- || error_exit "Failed to create secret"
        
        # Grant service account access to the secret
        gcloud secrets add-iam-policy-binding $SECRET_NAME \
            --member="serviceAccount:$SA_EMAIL" \
            --role="roles/secretmanager.secretAccessor" || echo "Warning: Could not grant secret access"
    else
        echo "Secret $SECRET_NAME already exists. Updating value..."
        echo -n "$OPENAI_API_KEY" | gcloud secrets versions add $SECRET_NAME \
            --data-file=- || error_exit "Failed to update secret"
    fi
    
    # Set service account credentials as a volume
    echo "Setting up service account key as a volume..."
    KEY_FILE_PATH="/secrets/sa-key/key.json"
    
    # Deploy to Cloud Run
    echo "Deploying to Cloud Run..."
    gcloud run deploy $SERVICE_NAME \
        --image=$IMAGE_URL \
        --region=$REGION \
        --platform=managed \
        --allow-unauthenticated \
        --service-account=$SA_EMAIL \
        --set-env-vars="GOOGLE_APPLICATION_CREDENTIALS=$KEY_FILE_PATH" \
        --set-secrets="OPENAI_API_KEY=$SECRET_NAME:latest,$KEY_FILE_PATH=$SA_KEY_SECRET_NAME:latest" \
        --cpu=1 \
        --memory=512Mi \
        --concurrency=80 \
        --timeout=300 || error_exit "Deployment failed"

    # Get the service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')
    
    echo -e "\n${GREEN}Deployment successful!${NC}"
    echo -e "Your Hebrew Audio Chatbot is now running at: ${YELLOW}$SERVICE_URL${NC}"
}

# Main execution
main() {
    echo -e "${GREEN}=== Hebrew Audio Chatbot Deployment ===${NC}"
    echo -e "This script will deploy the Hebrew Audio Chatbot to Google Cloud Run."
    echo -e "${YELLOW}Note: This may incur charges on your Google Cloud account.${NC}"
    echo -e "Press Ctrl+C now if you want to abort."
    sleep 3
    
    check_requirements
    setup_config
    enable_apis
    create_service_account
    build_and_push_image
    deploy_to_cloud_run
    
    echo -e "\n${GREEN}Deployment completed successfully!${NC}"
}

# Run the main function
main
