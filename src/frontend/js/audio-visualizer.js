/**
 * Audio Visualizer Module
 * 
 * This module creates and manages an audio visualization on a canvas element.
 * It visualizes the audio input and provides visual feedback during recording.
 */

class AudioVisualizer {
    /**
     * Create a new audio visualizer
     * @param {HTMLCanvasElement} canvas - The canvas element to draw on
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        
        // Set canvas dimensions to match its display size
        this.resize();
        
        // Visual settings
        this.barWidth = 4;
        this.barSpacing = 2;
        this.barCount = Math.floor(this.canvas.width / (this.barWidth + this.barSpacing));
        this.barHeightScale = 2.5;  // Scale factor for bar height
        
        // State
        this.isActive = false;
        this.audioData = new Float32Array(this.barCount);
        
        // Animation frame ID for cancellation
        this.animationId = null;
        
        // Colors
        this.baseColor = '#4a89dc';        // Blue (default/idle)
        this.activeColor = '#da4453';      // Red (recording)
        this.processingColor = '#8cc152';  // Green (processing)
        this.currentColor = this.baseColor;
        
        // Initialize with a static visualization
        this._initializeVisualization();
    }
    
    /**
     * Update the visualizer with new audio data
     * @param {Float32Array} audioData - Raw audio data to visualize
     * @param {Object} state - Current state information
     */
    update(audioData, state = {}) {
        // Process the audio data to fit our visualization
        const dataLength = Math.min(audioData.length, this.barCount);
        
        // Only take a portion of samples to match our bar count
        const sampleStep = Math.floor(audioData.length / this.barCount) || 1;
        
        for (let i = 0; i < this.barCount; i++) {
            const sampleIndex = i * sampleStep;
            if (sampleIndex < audioData.length) {
                // Smooth transition for the visualization
                this.audioData[i] = 0.3 * this.audioData[i] + 0.7 * Math.abs(audioData[sampleIndex]);
            } else {
                // Gradually bring bars down when there's no data
                this.audioData[i] *= 0.8;
            }
        }
        
        // Update visualization state based on the current status
        if (state.isProcessing) {
            this.currentColor = this.processingColor;
        } else if (state.isSpeaking) {
            this.currentColor = this.activeColor;
        } else {
            this.currentColor = this.baseColor;
        }
        
        // Make sure we're animating
        this._ensureAnimating();
    }
    
    /**
     * Set the visualizer to an idle state
     */
    setIdle() {
        // Gradually reduce all bars to create a "falling" effect
        for (let i = 0; i < this.audioData.length; i++) {
            this.audioData[i] *= 0.92;
        }
        
        this.currentColor = this.baseColor;
        this._ensureAnimating();
    }
    
    /**
     * Set the visualizer to a processing state
     */
    setProcessing() {
        this.currentColor = this.processingColor;
        this._ensureAnimating();
    }
    
    /**
     * Set the visualizer to a recording state
     */
    setRecording() {
        this.currentColor = this.activeColor;
        this._ensureAnimating();
    }
    
    /**
     * Resize the canvas to match its display size
     */
    resize() {
        // Get the display size of the canvas
        const rect = this.canvas.getBoundingClientRect();
        
        // Set the canvas resolution to match its display size
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Recalculate bar count based on new width
        this.barCount = Math.floor(this.canvas.width / (this.barWidth + this.barSpacing));
        this.audioData = new Float32Array(this.barCount);
        
        // Redraw after resize
        this._draw();
    }
    
    /**
     * Initialize with a static noise-like visualization
     */
    _initializeVisualization() {
        // Create some random data for an initial visualization
        for (let i = 0; i < this.barCount; i++) {
            this.audioData[i] = Math.random() * 0.15; // Low random values
        }
        
        // Draw this initial state
        this._draw();
    }
    
    /**
     * Make sure animation is running
     */
    _ensureAnimating() {
        if (!this.animationId) {
            this._animate();
        }
    }
    
    /**
     * Animation loop for the visualizer
     */
    _animate() {
        this._draw();
        
        // Check if any significant data remains to animate
        let hasSignificantData = false;
        for (let i = 0; i < this.audioData.length; i++) {
            if (this.audioData[i] > 0.005) {
                hasSignificantData = true;
                break;
            }
        }
        
        // Continue animation if there's data to show, otherwise stop
        if (hasSignificantData) {
            // Continue animation
            this.animationId = requestAnimationFrame(() => this._animate());
            
            // Gradually decay the bars for a smoother animation
            for (let i = 0; i < this.audioData.length; i++) {
                this.audioData[i] *= 0.95;
            }
        } else {
            // Stop animation until new data arrives
            this.animationId = null;
        }
    }
    
    /**
     * Draw the visualization on the canvas
     */
    _draw() {
        const ctx = this.canvasCtx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear the canvas
        ctx.clearRect(0, 0, width, height);
        
        // Background (slightly transparent)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(0, 0, width, height);
        
        // Draw the audio bars
        ctx.fillStyle = this.currentColor;
        
        const centerY = height / 2;
        
        for (let i = 0; i < this.barCount; i++) {
            const barHeight = this.audioData[i] * height * this.barHeightScale;
            
            // Calculate x position of this bar
            const x = i * (this.barWidth + this.barSpacing);
            
            // Draw the bar (mirrored around center for symmetry)
            const y = centerY - barHeight / 2;
            
            ctx.fillRect(x, y, this.barWidth, barHeight);
        }
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

// Export for use in other modules
window.AudioVisualizer = AudioVisualizer;
