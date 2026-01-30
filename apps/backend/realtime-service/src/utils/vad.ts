import { EventEmitter } from 'events';

interface VADOptions {
    sampleRate: number;
    fftSize: number;
    energyThreshold: number; // RMS threshold logic
    silenceDuration: number; // ms to wait before declaring silence
    minSpeechDuration: number; // ms minimum to consider it valid speech
}

export class VoiceActivityDetector extends EventEmitter {
    private options: VADOptions;
    private isSpeaking: boolean = false;
    private silenceStart: number | null = null;
    private speechStart: number | null = null;
    private silenceTimer: NodeJS.Timeout | null = null;

    constructor(options: Partial<VADOptions> = {}) {
        super();
        this.options = {
            sampleRate: options.sampleRate || 16000,
            fftSize: options.fftSize || 512,
            energyThreshold: options.energyThreshold || 0.01,
            silenceDuration: options.silenceDuration || 800, // 800ms of silence = end of utterance
            minSpeechDuration: options.minSpeechDuration || 200, // Ignore clicks/pops < 200ms
        };
    }

    /**
     * Process a chunk of audio (PCM 16-bit mono)
     */
    processAudio(buffer: Buffer): void {
        const energy = this.calculateRMS(buffer);

        // Check if current chunk has speech energy
        if (energy > this.options.energyThreshold) {
            this.handleSpeech(energy);
        } else {
            this.handleSilence(energy);
        }
    }

    reset(): void {
        this.isSpeaking = false;
        this.silenceStart = null;
        this.speechStart = null;
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }

    private calculateRMS(buffer: Buffer): number {
        let sum = 0;
        const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);

        for (let i = 0; i < int16Array.length; i++) {
            // Normalize to 0-1 range (16-bit audio)
            const val = int16Array[i] / 32768.0;
            sum += val * val;
        }

        return Math.sqrt(sum / int16Array.length);
    }

    private handleSpeech(energy: number): void {
        // If we were waiting for silence confirmation, cancel it
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }

        this.silenceStart = null;

        if (!this.isSpeaking) {
            // Potential start of speech
            if (!this.speechStart) {
                this.speechStart = Date.now();
            }

            // Confirm speech if duration passes minimum
            if (Date.now() - this.speechStart > 100) { // Fast check
                this.isSpeaking = true;
                this.emit('speechStart');
                // console.log(`[VAD] Speech started (Energy: ${energy.toFixed(4)})`);
            }
        }
    }

    private handleSilence(energy: number): void {
        if (!this.isSpeaking) {
            this.speechStart = null; // Reset partial speech candidate
            return;
        }

        if (!this.silenceStart) {
            this.silenceStart = Date.now();
        }

        // Check if silence has persisted long enough
        const silenceDuration = Date.now() - this.silenceStart;

        if (silenceDuration > this.options.silenceDuration) {
            // Double check we haven't already finished
            if (this.silenceTimer) return;

            // Verify valid speech duration
            const totalSpeechDuration = this.silenceStart - (this.speechStart || 0);

            if (totalSpeechDuration >= this.options.minSpeechDuration) {
                // console.log(`[VAD] Speech ended (Duration: ${totalSpeechDuration}ms)`);
                this.emit('speechEnd', { duration: totalSpeechDuration });
            } else {
                // console.log(`[VAD] Ignored short noise (Duration: ${totalSpeechDuration}ms)`);
                this.emit('noise'); // Optional: notify ignored noise
            }

            this.reset();
        }
    }
}
