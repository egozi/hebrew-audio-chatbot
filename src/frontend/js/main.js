/**
 * Main JavaScript for Hebrew Audio Chatbot
 * 
 * This module initializes and manages the audio chatbot functionality, including:
 * - Microphone access and audio recording
 * - Voice activity detection
 * - WebSocket communication with the backend
 * - UI interactions and visualization
 */

// Application state
const state = {
    isRecording: false,      // Is the user currently holding the record button
    isProcessing: false,     // Is the server currently processing our request
    isConnected: false,      // Is the WebSocket connected
    audioContext: null,      // Web Audio API context
    mediaStream: null,       // Microphone stream
    processor: null,         // Audio processor node
    recorder: null,          // MediaRecorder for capturing audio
    socket: null,            // WebSocket connection
    vad: null,               // Voice Activity Detector
    visualizer: null,        // Audio visualizer
    chunks: [],              // Audio chunks for recording
    retryCount: 0,           // Connection retry counter
    maxRetries: 3            // Maximum connection retry attempts
};

// DOM elements
const elements = {
    recordButton: document.getElementById('recordButton'),
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
        silenceThreshold: 1500,   // 1.5 seconds of silence to end speech
        minSpeechTime: 300,       // Minimum 300ms of speech to consider it valid
        energyThreshold: 0.015,   // Lower means more sensitive detection
        energySmoothing: 0.8      // How much to smooth the energy detection
    },
    audio: {
        sampleRate: 16000,        // 16kHz sample rate for optimal STT
        channels: 1,              // Mono audio
        mimeType: 'audio/webm'    // Audio format
    }
};

/**
 * Initializes the application
 */
function init() {
    // Set up audio visualizer
    state.visualizer = new AudioVisualizer(elements.visualizerCanvas);
    
    // Set up UI event listeners
    setupEventListeners();
    
    // Initialize Voice Activity Detection
    initVAD();
    
    // Connect to WebSocket when the page is loaded
    connectWebSocket();
    
    // Handle window resize for visualizer
    window.addEventListener('resize', () => {
        if (state.visualizer) {
            state.visualizer.resize();
        }
    });
}

/**
 * Sets up event listeners for UI elements
 */
function setupEventListeners() {
    // Record button - Push to talk
    elements.recordButton.addEventListener('mousedown', startRecording);
    elements.recordButton.addEventListener('touchstart', startRecording);
    
    elements.recordButton.addEventListener('mouseup', stopRecording);
    elements.recordButton.addEventListener('touchend', stopRecording);
    elements.recordButton.addEventListener('mouseleave', stopRecording);
    
    // Error modal retry button
    elements.retryButton.addEventListener('click', () => {
        closeErrorModal();
        connectWebSocket();
    });
    
    // Error modal close button
    elements.closeButton.addEventListener('click', closeErrorModal);
}

/**
 * Initializes the Voice Activity Detector
 */
function initVAD() {
    state.vad = new VoiceActivityDetector({
        ...config.vadOptions,
        onSpeechStart: () => {
            console.log('Speech started');
            updateUIState('listening');
        },
        onSpeechEnd: () => {
            console.log('Speech ended');
            if (state.isRecording) {
                stopRecording();
            }
        },
        onProcess: (vadData) => {
            // Update the visualizer with VAD data if we're recording
            if (state.isRecording && state.processor) {
                // We don't have actual audio data here, but we can use the energy level
                const dummyData = new Float32Array(state.visualizer.barCount);
                for (let i = 0; i < dummyData.length; i++) {
                    dummyData[i] = vadData.energy * (0.5 + 0.5 * Math.random());
                }
                
                state.visualizer.update(dummyData, {
                    isSpeaking: vadData.isSpeaking,
                    isProcessing: state.isProcessing
                });
            }
        }
    });
}

/**
 * Connects to the WebSocket server
 */
function connectWebSocket() {
    try {
        updateUIState('connecting');
        
        // Close existing connection if any
        if (state.socket) {
            state.socket.close();
        }
        
        // Create new WebSocket connection
        state.socket = new WebSocket(config.websocketUrl);
        
        // WebSocket event handlers
        state.socket.onopen = () => {
            state.isConnected = true;
            state.retryCount = 0;
            console.log('WebSocket connected');
            updateUIState('ready');
        };
        
        state.socket.onclose = (event) => {
            state.isConnected = false;
            console.log('WebSocket disconnected', event);
            
            // Try to reconnect if the connection was lost unexpectedly
            if (!event.wasClean && state.retryCount < state.maxRetries) {
                state.retryCount++;
                const delay = state.retryCount * 1000; // Increasing backoff
                console.log(`Reconnecting in ${delay}ms (attempt ${state.retryCount}/${state.maxRetries})...`);
                
                setTimeout(connectWebSocket, delay);
            } else if (state.retryCount >= state.maxRetries) {
                showError('התנתקנו מהשרת. נא לרענן את הדף כדי לנסות שוב.');
            }
        };
        
        state.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (!state.isConnected) {
                showError('לא ניתן להתחבר לשרת. אנא וודא שהשרת פועל ונסה שוב.');
            }
        };
        
        state.socket.onmessage = handleServerMessage;
        
    } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        showError('אירעה שגיאה בהתחברות לשרת. אנא נסה שוב מאוחר יותר.');
    }
}

/**
 * Starts recording audio from the microphone
 */
async function startRecording(event) {
    // Prevent default behavior for touch events
    if (event.type === 'touchstart') {
        event.preventDefault();
    }
    
    // Don't start recording if we're already recording or processing
    if (state.isRecording || state.isProcessing) {
        return;
    }
    
    // Check WebSocket connection
    if (!state.isConnected) {
        showError('אין חיבור לשרת. אנא המתן לחיבור מחדש או רענן את הדף.');
        return;
    }
    
    try {
        // Request microphone access if we don't have it yet
        if (!state.mediaStream) {
            state.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: config.audio.channels,
                    sampleRate: config.audio.sampleRate,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // Initialize audio context with the obtained media stream
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create source node from the media stream
            const source = state.audioContext.createMediaStreamSource(state.mediaStream);
            
            // Create processor node for real-time processing (for VAD and visualization)
            state.processor = state.audioContext.createScriptProcessor(4096, 1, 1);
            
            // Connect the nodes
            source.connect(state.processor);
            state.processor.connect(state.audioContext.destination);
            
            // Process audio data for VAD and visualization
            state.processor.onaudioprocess = (e) => {
                const audioData = e.inputBuffer.getChannelData(0);
                
                // Use the VAD to process audio
                if (state.vad) {
                    state.vad.processAudio(audioData, state.audioContext.sampleRate);
                }
                
                // Update the visualizer
                if (state.visualizer) {
                    state.visualizer.update(audioData, {
                        isSpeaking: state.vad ? state.vad.speaking : true,
                        isProcessing: state.isProcessing
                    });
                }
            };
        }
        
        // Create a MediaRecorder to record the audio for sending to the server
        state.recorder = new MediaRecorder(state.mediaStream, {
            mimeType: config.audio.mimeType
        });
        
        // Clear previous audio chunks
        state.chunks = [];
        
        // Handle recorded data
        state.recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                state.chunks.push(e.data);
            }
        };
        
        // Start recording
        state.recorder.start();
        state.isRecording = true;
        
        // Reset VAD state
        if (state.vad) {
            state.vad.reset();
        }
        
        updateUIState('recording');
        
    } catch (error) {
        console.error('Error starting recording:', error);
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            showError('נדרשת גישה למיקרופון. אנא אפשר גישה למיקרופון בדפדפן שלך.');
        } else {
            showError('אירעה שגיאה בהפעלת ההקלטה. אנא נסה שוב מאוחר יותר.');
        }
    }
}

/**
 * Stops recording and sends the audio to the server
 */
function stopRecording(event) {
    // Prevent default behavior for touch events
    if (event && event.type === 'touchend') {
        event.preventDefault();
    }
    
    // Only stop if we're actually recording
    if (!state.isRecording || !state.recorder) {
        return;
    }
    
    try {
        // Stop the recorder
        state.recorder.stop();
        state.isRecording = false;
        
        updateUIState('processing');
        
        // When recording is complete, send data to server
        state.recorder.onstop = () => {
            if (state.chunks.length > 0) {
                // Create a blob from the audio chunks
                const audioBlob = new Blob(state.chunks, { type: config.audio.mimeType });
                
                // Only send if the duration is reasonable (not just a tap)
                if (audioBlob.size > 1000) {  // Arbitrary threshold, adjust as needed
                    sendAudioToServer(audioBlob);
                } else {
                    // Too short, just go back to ready state
                    updateUIState('ready');
                }
            } else {
                updateUIState('ready');
            }
        };
        
    } catch (error) {
        console.error('Error stopping recording:', error);
        updateUIState('ready');
    }
}

/**
 * Sends recorded audio to the server via WebSocket
 */
async function sendAudioToServer(audioBlob) {
    if (!state.isConnected) {
        showError('אין חיבור לשרת. אנא נסה שוב מאוחר יותר.');
        updateUIState('ready');
        return;
    }
    
    try {
        state.isProcessing = true;
        
        // Add a user message to the chat
        addUserMessage('🎤 הקלטה נשלחה...');
        
        // Send the audio blob to the server
        state.socket.send(await audioBlob.arrayBuffer());
    } catch (error) {
        console.error('Error sending audio to server:', error);
        showError('אירעה שגיאה בשליחת ההקלטה לשרת. אנא נסה שוב.');
        state.isProcessing = false;
        updateUIState('ready');
    }
}

/**
 * Handles messages received from the server
 */
function handleServerMessage(event) {
    try {
        // Check if the message is a JSON response (error or status)
        if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);
            
            if (data.status === 'error') {
                console.error('Server error:', data.message);
                showError(`שגיאת שרת: ${data.message}`);
                state.isProcessing = false;
                updateUIState('ready');
                return;
            }
        }
        
        // Handle binary response (audio data)
        if (event.data instanceof Blob) {
            // Play the received audio
            const audioUrl = URL.createObjectURL(event.data);
            const audio = new Audio(audioUrl);
            
            audio.oncanplaythrough = () => {
                // Add a bot message once audio starts playing
                addBotMessage('🔊 המערכת עונה בקול...');
            };
            
            audio.onended = () => {
                // Clean up the object URL
                URL.revokeObjectURL(audioUrl);
                
                // Reset state after playback
                state.isProcessing = false;
                updateUIState('ready');
            };
            
            // Play the audio
            audio.play().catch(error => {
                console.error('Error playing audio:', error);
                state.isProcessing = false;
                updateUIState('ready');
                
                if (error.name === 'NotAllowedError') {
                    showError('הדפדפן מונע ניגון אוטומטי של אודיו. אנא אפשר ניגון אוטומטי או לחץ על הכפתור כדי להשמיע.');
                }
            });
        }
    } catch (error) {
        console.error('Error handling server message:', error);
        state.isProcessing = false;
        updateUIState('ready');
    }
}

/**
 * Updates the UI based on the current state
 */
function updateUIState(newState) {
    // Update record button
    const button = elements.recordButton;
    button.classList.remove('recording', 'listening');
    
    // Update status text
    const statusText = elements.statusText;
    statusText.classList.remove('processing');
    
    // Update visualizer
    if (state.visualizer) {
        state.visualizer.setIdle();
    }
    
    // Set state-specific UI
    switch (newState) {
        case 'connecting':
            statusText.textContent = 'מתחבר לשרת...';
            button.disabled = true;
            break;
            
        case 'ready':
            statusText.textContent = 'מוכן להקשיב';
            button.disabled = false;
            break;
            
        case 'recording':
            statusText.textContent = 'לחץ והחזק לדיבור';
            button.classList.add('recording');
            if (state.visualizer) {
                state.visualizer.setRecording();
            }
            break;
            
        case 'listening':
            statusText.textContent = 'מקשיב...';
            button.classList.add('listening');
            break;
            
        case 'processing':
            statusText.textContent = 'מעבד...';
            statusText.classList.add('processing');
            button.disabled = true;
            if (state.visualizer) {
                state.visualizer.setProcessing();
            }
            break;
    }
}

/**
 * Adds a user message to the chat
 */
function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;
    
    messageDiv.appendChild(contentDiv);
    elements.chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

/**
 * Adds a bot message to the chat
 */
function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;
    
    messageDiv.appendChild(contentDiv);
    elements.chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
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

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
