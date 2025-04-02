/**
 * Main JavaScript for Hebrew Audio Chatbot
 * 
 * This module initializes and manages the audio chatbot functionality, including:
 * - Microphone access and audio recording (collecting chunks)
 * - Single button Start/Stop/Send interaction
 * - WebSocket communication with the backend (sending single audio blob)
 * - UI interactions and visualization
 */

// Application state
const state = {
    isRecording: false,      // Is the user currently recording
    isProcessing: false,     // Is the server currently processing our request
    isConnected: false,      // Is the WebSocket connected
    audioContext: null,      // Web Audio API context
    mediaStream: null,       // Microphone stream
    processor: null,         // Audio processor node (ScriptProcessorNode for simplicity now)
    recorder: null,          // Using MediaRecorder again for blob creation
    socket: null,            // WebSocket connection
    vad: null,               // Voice Activity Detector (basic integration)
    visualizer: null,        // Audio visualizer
    audioChunks: [],         // Store audio chunks for blob creation
    retryCount: 0,           // Connection retry counter
    maxRetries: 3,           // Maximum connection retry attempts
    userMessageElement: null,// Reference to the current user message element for updates
    botMessageElement: null, // Reference to the current bot message element for updates
    visualizerUpdater: null  // Holds the requestAnimationFrame ID for the visualizer
};

// DOM elements
const elements = {
    recordButton: document.getElementById('recordButton'),
    // sendButton: document.getElementById('sendButton'), // Removed
    statusText: document.getElementById('status'),
    chatMessages: document.getElementById('chat-messages'),
    visualizerCanvas: document.getElementById('visualizer'),
    errorModal: document.getElementById('errorModal'),
    errorMessage: document.getElementById('errorMessage'),
    retryButton: document.getElementById('retryButton'),
    closeButton: document.querySelector('.close-button')
};

// Configuration
const config = {
    websocketUrl: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/audio`,
    vadOptions: { 
        silenceThreshold: 2000,   
        minSpeechTime: 300,       
        energyThreshold: 0.015,   
        energySmoothing: 0.8      
    },
    audio: {
        sampleRate: 16000, // Target sample rate
        channels: 1,       // Mono audio
        mimeType: 'audio/webm;codecs=opus', 
    }
};

/**
 * Initializes the application
 */
function init() {
    state.visualizer = new AudioVisualizer(elements.visualizerCanvas);
    setupEventListeners();
    initVAD(); 
    connectWebSocket();
    window.addEventListener('resize', () => {
        if (state.visualizer) state.visualizer.resize();
    });
    updateUIState('initial'); 
}

/**
 * Sets up event listeners for UI elements
 */
function setupEventListeners() {
    // Record button - Toggle recording & send on stop
    elements.recordButton.addEventListener('click', toggleRecording); 
    
    // Error modal retry button
    elements.retryButton.addEventListener('click', () => {
        closeErrorModal();
        connectWebSocket();
    });
    
    // Error modal close button
    elements.closeButton.addEventListener('click', closeErrorModal);
}

/**
 * Initializes the Voice Activity Detector (basic setup)
 */
function initVAD() {
    state.vad = new VoiceActivityDetector({
        ...config.vadOptions,
        onSpeechStart: () => console.log('VAD: Speech started'),
        onSpeechEnd: () => {
             console.log('VAD: Speech ended');
             // Optional: Could automatically stop recording here if desired
             // if (state.isRecording) {
             //     toggleRecording(); 
             // }
        }
    });
}

/**
 * Connects to the WebSocket server
 */
function connectWebSocket() {
    try {
        updateUIState('connecting');
        if (state.socket) state.socket.close();
        
        state.socket = new WebSocket(config.websocketUrl);
        state.socket.binaryType = 'arraybuffer'; 

        state.socket.onopen = () => {
            state.isConnected = true;
            state.retryCount = 0;
            console.log('WebSocket connected');
            updateUIState('ready');
        };
        
        state.socket.onclose = (event) => {
            state.isConnected = false;
            console.log('WebSocket disconnected', event);
            if (state.isRecording) stopRecordingInternal(false); 
            
            if (!event.wasClean && state.retryCount < state.maxRetries) {
                state.retryCount++;
                const delay = state.retryCount * 1000;
                console.log(`Reconnecting in ${delay}ms...`);
                setTimeout(connectWebSocket, delay);
            } else if (state.retryCount >= state.maxRetries) {
                showError('התנתקנו מהשרת. נא לרענן את הדף כדי לנסות שוב.');
                updateUIState('error');
            } else {
                 updateUIState('disconnected');
            }
        };
        
        state.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (!state.isConnected) showError('לא ניתן להתחבר לשרת.');
            if (state.isRecording) stopRecordingInternal(false);
            updateUIState('error');
        };
        
        state.socket.onmessage = handleServerMessage;
        
    } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        showError('אירעה שגיאה בהתחברות לשרת.');
        updateUIState('error');
    }
}

/**
 * Toggles audio recording state and triggers send on stop
 */
async function toggleRecording() {
    if (state.isProcessing) return; 

    if (state.isRecording) {
        // Stop recording AND trigger send
        await stopRecordingInternal(true); 
        // UI state will be updated to 'sending' within stopRecordingInternal/onstop
    } else {
        // Start recording
        await startRecordingInternal();
    }
}

// Removed sendRecording function as logic is merged into toggleRecording

/**
 * Internal function to start recording audio using MediaRecorder
 */
async function startRecordingInternal() {
    if (!state.isConnected || state.socket.readyState !== WebSocket.OPEN) {
        showError('אין חיבור לשרת.');
        return;
    }
    
    state.isRecording = true;
    updateUIState('recording');
    state.audioChunks = []; // Clear previous chunks
    
    try {
        // Setup AudioContext and MediaStream if needed
        if (!state.mediaStream || !state.audioContext || state.audioContext.state === 'closed') {
            console.log("Setting up AudioContext and MediaStream...");
            state.mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    sampleRate: config.audio.sampleRate, 
                    channelCount: config.audio.channels, 
                    echoCancellation: true, 
                    noiseSuppression: true, 
                    autoGainControl: true 
                } 
            });
            
            if (state.audioContext && state.audioContext.state !== 'closed') await state.audioContext.close();
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)(); 
            console.log(`AudioContext running at: ${state.audioContext.sampleRate}Hz`);

            const source = state.audioContext.createMediaStreamSource(state.mediaStream);
            const bufferSize = 4096; 
            state.processor = state.audioContext.createScriptProcessor(bufferSize, 1, 1);

            state.processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                if (state.vad && state.isRecording) {
                    state.vad.processAudio(inputData, state.audioContext.sampleRate);
                }
                if (state.visualizer && state.isRecording) {
                     state.visualizer.update(inputData, { isSpeaking: state.isRecording, isProcessing: state.isProcessing });
                }
            };
            
            source.connect(state.processor);
            state.processor.connect(state.audioContext.destination); 

            console.log("Audio setup complete.");
        } else {
             console.log("Reusing AudioContext/MediaStream.");
             if (state.audioContext.state === 'suspended') await state.audioContext.resume();
        }

        // --- MediaRecorder Setup ---
        console.log(`Attempting to create MediaRecorder with mimeType: ${config.audio.mimeType}`);
        try {
             state.recorder = new MediaRecorder(state.mediaStream, { mimeType: config.audio.mimeType });
        } catch (e) {
             console.warn(`Failed to create MediaRecorder with ${config.audio.mimeType}, trying default:`, e);
             try {
                 state.recorder = new MediaRecorder(state.mediaStream); 
                 console.log(`Using default MediaRecorder mimeType: ${state.recorder.mimeType}`);
             } catch (e2) {
                 console.error("Failed to create MediaRecorder with any mimeType:", e2);
                 showError("שגיאה בהגדרת מקליט האודיו בדפדפן.");
                 await cleanupAudioResources();
                 updateUIState('ready');
                 return;
             }
        }

        state.recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.audioChunks.push(event.data);
            }
        };

        state.recorder.onstop = async () => {
             console.log("MediaRecorder stopped.");
             if (state.audioChunks.length === 0) {
                 console.log("No audio chunks recorded.");
                 // Don't add user message if nothing was recorded
                 // updateUserMessage(state.userMessageElement, '🎤 לא הוקלט שמע.'); 
                 state.userMessageElement = null; // Clear placeholder if it exists
                 updateUIState('ready'); 
                 return;
             }

             const audioBlob = new Blob(state.audioChunks, { type: state.recorder.mimeType });
             console.log(`Created blob of type ${audioBlob.type}, size ${audioBlob.size}`);
             
             if (state.isConnected && state.socket.readyState === WebSocket.OPEN) {
                 try {
                     updateUIState('sending'); // Indicate sending NOW
                     if (state.userMessageElement) { // Update placeholder message
                          updateUserMessage(state.userMessageElement, '🎤 שולח הקלטה...');
                     } else { // Add message if none existed
                          state.userMessageElement = addUserMessage('🎤 שולח הקלטה...');
                     }
                     const arrayBuffer = await audioBlob.arrayBuffer();
                     console.log(`Sending audio blob as ArrayBuffer: ${arrayBuffer.byteLength} bytes`);
                     state.socket.send(arrayBuffer);
                 } catch (sendError) {
                      console.error("Error sending audio blob:", sendError);
                      showError("שגיאה בשליחת ההקלטה.");
                      updateUIState('ready');
                 }
             } else {
                 console.error("WebSocket not open when trying to send blob.");
                 showError("שגיאה בשליחת ההקלטה (אין חיבור).");
                 updateUIState('ready');
             }
        };

        state.recorder.start(100); // Start recording, collect chunks frequently for responsiveness
        console.log("MediaRecorder started.");
        
        state.userMessageElement = addUserMessage('🎤 מקליט...'); 
        if (state.vad) state.vad.reset(); 
        
    } catch (error) {
        console.error('Error starting recording:', error);
        state.isRecording = false;
        showError(error.name === 'NotAllowedError' ? 'נדרשת גישה למיקרופון.' : 'שגיאה בהפעלת הקלטה.');
        await cleanupAudioResources();
        updateUIState('ready');
    }
}

/**
 * Internal function to stop recording and optionally trigger sending via recorder.stop()
 * @param {boolean} triggerSend - If true, stops the MediaRecorder which triggers the onstop handler to send.
 */
async function stopRecordingInternal(triggerSend = true) { 
    if (!state.isRecording) return; 

    console.log(`Stopping recording... Trigger Send: ${triggerSend}`);
    state.isRecording = false; // Set state immediately
    
    if (state.visualizerUpdater) cancelAnimationFrame(state.visualizerUpdater);
    state.visualizerUpdater = null;
    if (state.visualizer) state.visualizer.setIdle();
    
    try {
        // Stop the MediaRecorder if it's running. This triggers 'onstop' which handles sending if triggerSend is true.
        if (state.recorder && state.recorder.state === "recording") {
            state.recorder.stop(); 
        } else {
             console.log("Recorder not active or already stopped.");
             // If not triggering send, just update UI
             if (!triggerSend) {
                  updateUIState('ready'); // Or a specific 'stopped' state if needed
                  if (state.userMessageElement) {
                       updateUserMessage(state.userMessageElement, state.userMessageElement.textContent.replace('מקליט...', 'הקלטה נעצרה.'));
                  }
             }
        }
        
        // UI update for 'sending' is handled within the recorder.onstop handler
        // UI update for just stopping locally happens above if recorder wasn't running
        
    } catch (error) {
        console.error('Error stopping MediaRecorder:', error);
        updateUIState('ready'); // Revert to ready on error
    } 
}

/**
 * Handles messages received from the server (JSON or ArrayBuffer)
 */
function handleServerMessage(event) {
    // Check if it's binary audio data first
    if (event.data instanceof ArrayBuffer) {
        console.log(`Received audio data: ${event.data.byteLength} bytes`);
        if (event.data.byteLength > 0) {
            playAudio(event.data); // Play the bot's audio response
        } else {
            console.log("Received empty audio buffer.");
             if (state.isProcessing) {
                 // state.isProcessing = false; // Handled in playAudio.onended
                 // updateUIState('ready'); // Handled in playAudio.onended
             }
        }
    } 
    // Then check if it's a string (likely JSON)
    else if (typeof event.data === 'string') {
        try {
            const message = JSON.parse(event.data);
            console.log("Received JSON:", message);
            switch (message.type || message.status) { // Handle both message structures
                case 'transcript': // Assuming backend sends this structure now
                    handleTranscript(message.text); 
                    break;
                case 'error': // Handle errors from backend
                    console.error('Server error:', message.message);
                    showError(`שגיאת שרת: ${message.message}`);
                    state.isProcessing = false;
                    updateUIState('ready');
                    state.userMessageElement = null;
                    state.botMessageElement = null;
                    break;
                default:
                    console.warn('Unknown JSON message type:', message);
            }
        } catch (error) {
            console.error('Error parsing JSON or unknown string message:', error, event.data);
             if (state.isProcessing || state.isRecording) {
                 state.isProcessing = false;
                 state.isRecording = false;
                 updateUIState('ready');
                 showError("שגיאה בתקשורת עם השרת.");
             }
        }
    } 
    else {
        console.warn('Received unknown message type:', typeof event.data, event.data);
    }
}

/**
 * Handles incoming transcript messages 
 */
function handleTranscript(text) { 
    if (!state.userMessageElement) {
        state.userMessageElement = addUserMessage('');
    }
    let displayText = state.userMessageElement.textContent.replace(' (שולח...)', '');
    displayText = displayText.replace('🎤 שולח הקלטה...', ''); 
    updateUserMessage(state.userMessageElement, `🎤 ${text || 'לא זוהה דיבור.'}`); 
    
    // Assume transcript means STT is done. Wait for audio response.
    state.isProcessing = true; 
    updateUIState('processing'); 
}

/**
 * Handles incoming LLM text response messages (If backend sends them separately)
 */
// function handleLlmResponse(text) { ... } // Can be removed if LLM text isn't sent separately

/**
 * Plays the received audio data (TTS response)
 */
function playAudio(audioData) {
    try {
        const audioBlob = new Blob([audioData], { type: 'audio/wav' }); 
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Add bot message placeholder if it doesn't exist
        // We assume the bot message contains the LLM text already if backend sends it before audio
        if (!state.botMessageElement) { 
             state.botMessageElement = addBotMessage('🔊 המערכת עונה...');
        } else {
             if (!state.botMessageElement.textContent.includes('🔊')) {
                 updateBotMessage(state.botMessageElement, state.botMessageElement.textContent + ' 🔊');
             }
        }
        
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            console.log("Audio playback finished.");
            state.isProcessing = false; // Processing ends AFTER audio playback
            updateUIState('ready');
            // Clear messages for next turn after a delay
            setTimeout(() => {
                 // Check if elements still exist before nullifying
                 if (state.userMessageElement && state.userMessageElement.parentNode) {
                      state.userMessageElement.parentNode.removeChild(state.userMessageElement);
                 }
                 if (state.botMessageElement && state.botMessageElement.parentNode) {
                      state.botMessageElement.parentNode.removeChild(state.botMessageElement);
                 }
                 state.userMessageElement = null; 
                 state.botMessageElement = null;
            }, 1500); // Delay before clearing messages
        };
        
        audio.onerror = (e) => {
             console.error('Error playing audio:', e);
             URL.revokeObjectURL(audioUrl);
             showError('אירעה שגיאה בניגון השמע.');
             state.isProcessing = false;
             updateUIState('ready');
             state.userMessageElement = null;
             state.botMessageElement = null;
        };
        
        audio.play().catch(error => {
            console.error('Error initiating audio playback:', error);
            state.isProcessing = false;
            updateUIState('ready');
            state.userMessageElement = null;
            state.botMessageElement = null;
            if (error.name === 'NotAllowedError') {
                showError('הדפדפן מונע ניגון אוטומטי של אודיו.');
            }
        });
        
    } catch (error) {
        console.error('Error processing audio data:', error);
        state.isProcessing = false;
        updateUIState('ready');
        state.userMessageElement = null;
        state.botMessageElement = null;
    }
}

/**
 * Updates the UI based on the current state
 */
function updateUIState(newState) {
    console.log("Updating UI State to:", newState);
    const recordBtn = elements.recordButton;
    // const sendBtn = elements.sendButton; // Removed
    const statusText = elements.statusText;
    
    // Reset common states
    recordBtn.classList.remove('recording');
    recordBtn.disabled = false;
    // sendBtn.disabled = true; // Removed
    statusText.classList.remove('processing');
    
    // Set state-specific UI
    switch (newState) {
        case 'initial': 
        case 'connecting':
            statusText.textContent = 'מתחבר לשרת...';
            recordBtn.disabled = true;
            break;
        case 'disconnected':
             statusText.textContent = 'מנותק';
             recordBtn.disabled = true;
             break;
        case 'error':
             statusText.textContent = 'שגיאה';
             recordBtn.disabled = true; 
             break;
        case 'ready':
            statusText.textContent = 'מוכן (לחץ להקלטה)';
            recordBtn.querySelector('.record-text').textContent = 'התחל הקלטה';
            recordBtn.classList.remove('recording');
            break;
        case 'recording':
            statusText.textContent = 'מקליט... (לחץ לעצירה ושליחה)';
            recordBtn.querySelector('.record-text').textContent = 'עצור ושלח';
            recordBtn.classList.add('recording');
            break;
        // 'stopped' state removed as stop now triggers send
        case 'sending': // Recording stopped, blob sent, waiting for server
             statusText.textContent = 'שולח לשרת...';
             recordBtn.disabled = true; // Disable while sending
             recordBtn.querySelector('.record-text').textContent = 'שולח...';
             recordBtn.classList.remove('recording');
             break;
        case 'processing': // Server is processing STT/LLM/TTS
            statusText.textContent = 'מעבד...';
            statusText.classList.add('processing');
            recordBtn.disabled = true;
            recordBtn.querySelector('.record-text').textContent = 'מעבד...';
            break;
    }
}

/**
 * Adds or updates a user message in the chat
 */
function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text; 
    messageDiv.appendChild(contentDiv);
    elements.chatMessages.appendChild(messageDiv);
    scrollToBottom();
    return contentDiv; 
}

/** Updates the text content of an existing user message element */
function updateUserMessage(element, text) {
    if (element) {
        element.textContent = text; 
        scrollToBottom();
    }
}

/**
 * Adds or updates a bot message in the chat
 */
function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text; 
    messageDiv.appendChild(contentDiv);
    elements.chatMessages.appendChild(messageDiv);
    scrollToBottom();
    return contentDiv; 
}

/** Updates the text content of an existing bot message element */
function updateBotMessage(element, text) {
    if (element) {
        element.textContent = text; 
        scrollToBottom();
    }
}

/** Scrolls the chat messages container to the bottom */
function scrollToBottom() {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

/**
 * Shows an error modal with a message
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorModal.classList.add('show');
}

/**
 * Closes the error modal
 */
function closeErrorModal() {
    elements.errorModal.classList.remove('show');
}

/**
 * Cleans up audio resources like AudioContext and MediaStream.
 */
async function cleanupAudioResources() {
    console.log("Cleaning up audio resources...");
    // Stop MediaRecorder if it exists and is recording
    if (state.recorder && state.recorder.state === "recording") {
        try { state.recorder.stop(); } catch(e) {}
    }
    state.recorder = null; // Clear recorder reference

    // Disconnect ScriptProcessorNode if it exists
    if (state.processor) {
        try { state.processor.disconnect(); } catch(e) {}
        state.processor = null;
    }
    // Stop MediaStream tracks
    if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
        state.mediaStream = null;
    }
    // Close AudioContext
    if (state.audioContext && state.audioContext.state !== 'closed') {
         try { await state.audioContext.close(); } catch(e) {}
        state.audioContext = null;
    }
    console.log("Audio resources cleaned up.");
}


// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Optional: Clean up audio context on page unload
window.addEventListener('beforeunload', cleanupAudioResources);
