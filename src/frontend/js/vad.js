/**
 * Voice Activity Detection (VAD) Module
 * 
 * This module handles voice activity detection using a combination of
 * audio analysis techniques to determine when a user is speaking or 
 * when they have stopped speaking.
 */

class VoiceActivityDetector {
    constructor(options = {}) {
        // Configuration options
        this.config = {
            // The time in milliseconds of silence before considering speech to be ended
            silenceThreshold: options.silenceThreshold || 1500,
            // Minimum time in milliseconds required for speech to be considered valid
            minSpeechTime: options.minSpeechTime || 300,
            // Energy level threshold below which is considered silence (0-1 scale, where 1 is max volume)
            energyThreshold: options.energyThreshold || 0.02,
            // Smoothing for energy calculation
            energySmoothing: options.energySmoothing || 0.8
        };
        
        // Internal state
        this.speaking = false;
        this.speechStart = null;
        this.silenceStart = null;
        this.lastEnergy = 0;
        
        // Event callbacks
        this.onSpeechStart = options.onSpeechStart || function() {};
        this.onSpeechEnd = options.onSpeechEnd || function() {};
        this.onProcess = options.onProcess || function() {};
    }
    
    /**
     * Process a raw audio buffer to detect voice activity
     * @param {Float32Array} audioData - Audio buffer (raw samples)
     * @param {number} sampleRate - Sample rate of the audio
     */
    processAudio(audioData, sampleRate) {
        // Calculate the energy (volume) level of this audio frame
        const energy = this._calculateEnergy(audioData);
        
        // Smooth energy levels to reduce false positives from brief noises
        this.lastEnergy = (this.config.energySmoothing * this.lastEnergy) + 
                           ((1 - this.config.energySmoothing) * energy);
        
        // Check if we're hearing speech
        const isSpeaking = this.lastEnergy > this.config.energyThreshold;
        
        // Get current time
        const now = Date.now();
        
        // Process current state based on energy level
        if (isSpeaking) {
            // If we weren't speaking before, mark the start of speech
            if (!this.speaking) {
                this.speechStart = now;
                this.speaking = true;
                this.silenceStart = null;
                this.onSpeechStart();
            }
        } else {
            // We're not hearing speech
            if (this.speaking) {
                // If this is the beginning of silence, mark the time
                if (this.silenceStart === null) {
                    this.silenceStart = now;
                }
                
                // If we've been silent for longer than the threshold, consider speech ended
                if (now - this.silenceStart > this.config.silenceThreshold) {
                    const speechDuration = this.silenceStart - this.speechStart;
                    
                    // Only consider it valid speech if it meets the minimum duration
                    if (speechDuration >= this.config.minSpeechTime) {
                        this.onSpeechEnd();
                    }
                    
                    this.speaking = false;
                    this.speechStart = null;
                    this.silenceStart = null;
                }
            }
        }
        
        // Call the process callback with the current state
        this.onProcess({
            energy: this.lastEnergy, 
            isSpeaking: this.speaking
        });
    }
    
    /**
     * Calculate the energy (volume) level of an audio buffer
     * @param {Float32Array} buffer - Audio buffer
     * @returns {number} Energy level from 0-1
     */
    _calculateEnergy(buffer) {
        let sum = 0;
        
        // Sum squared samples for energy calculation (RMS)
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        
        // Normalize the energy to 0-1 range
        const energy = Math.sqrt(sum / buffer.length);
        return Math.min(1, energy);
    }
    
    /**
     * Update VAD configuration
     * @param {Object} newConfig - New configuration parameters
     */
    updateConfig(newConfig) {
        this.config = {...this.config, ...newConfig};
    }
    
    /**
     * Reset the state of the VAD
     */
    reset() {
        this.speaking = false;
        this.speechStart = null;
        this.silenceStart = null;
        this.lastEnergy = 0;
    }
}

// Export the class for use in other modules
window.VoiceActivityDetector = VoiceActivityDetector;
