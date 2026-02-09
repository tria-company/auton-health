import { logError } from '../config/database';
import { aiPricingService } from './aiPricingService';
import { aiConfig } from '../config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Configurar path do ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Serviço de integração com Azure OpenAI Whisper API
 * Para transcrição de áudio em consultas presenciais
 */
class WhisperService {
    private azureEndpoint: string;
    private azureApiKey: string;
    private azureDeployment: string;
    private azureApiVersion: string;

    // Cache de transcrições (opcional - evitar reprocessamento)
    private transcriptionCache = new Map<string, string>();

    constructor() {
        this.azureEndpoint = aiConfig.azure.endpoint;
        this.azureApiKey = aiConfig.azure.apiKey;
        this.azureDeployment = aiConfig.azure.deployments.whisper;
        this.azureApiVersion = aiConfig.azure.apiVersions.whisper;

        if (!this.azureApiKey || !this.azureEndpoint) {
            console.error('❌ [WHISPER] Azure OpenAI não configurado!');
            logError(
                'Azure OpenAI não configurado para Whisper',
                'error',
                null,
                { service: 'whisper' }
            );
        }
    }

    /**
     * Obtém a duração real do áudio usando ffprobe
     * @param filePath Caminho do arquivo de áudio
     * @returns Duração em milissegundos
     */
    private async getAudioDuration(filePath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    console.error(`❌ [WHISPER] Erro ao obter duração do áudio:`, err);
                    reject(err);
                    return;
                }
                const duration = metadata.format.duration || 0;
                console.log(`⏱️ [WHISPER] Duração real do áudio: ${duration.toFixed(2)}s`);
                resolve(duration * 1000); // Converter para ms
            });
        });
    }

    /**
     * Converte WebM para WAV usando ffmpeg
     */
    private async convertWebMToWAV(inputPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .toFormat('wav')
                .audioCodec('pcm_s16le')
                .audioChannels(1)
                .audioFrequency(16000)
                .on('end', () => {
                    console.log(`✅ [WHISPER] Conversão WebM → WAV concluída`);
                    resolve();
                })
                .on('error', (err) => {
                    console.error(`❌ [WHISPER] Erro na conversão:`, err);
                    reject(err);
                })
                .save(outputPath);
        });
    }

    /**
     * Transcreve chunk de áudio usando Azure OpenAI Whisper API
     * 
     * @param audioBuffer - Buffer do áudio (webm, mp3, wav, etc)
     * @param speaker - 'doctor' ou 'patient' (para logging)
     * @param language - Código do idioma (padrão: 'pt')
     * @param consultaId - ID da consulta para rastreamento de custos (opcional)
     * @returns Texto transcrito
     */
    async transcribeAudioChunk(
        audioBuffer: Buffer,
        speaker: 'doctor' | 'patient' = 'doctor',
        language: string = 'pt',
        consultaId?: string
    ): Promise<{ text: string; duration?: number }> {
        if (!this.azureApiKey || !this.azureEndpoint) {
            throw new Error('Azure OpenAI não configurado');
        }

        const startTime = Date.now();
        let tempFilePath: string | null = null;

        try {
            // Verificar cache (opcional)
            const cacheKey = this.generateCacheKey(audioBuffer);
            if (this.transcriptionCache.has(cacheKey)) {
                console.log(`📦 [WHISPER] Cache hit para ${speaker}`);
                return {
                    text: this.transcriptionCache.get(cacheKey)!,
                    duration: 0
                };
            }

            console.log(`🎤 [WHISPER] Transcrevendo áudio ${speaker} (${audioBuffer.length} bytes) via Azure...`);

            // Detectar formato do áudio baseado nos magic bytes
            const audioFormat = this.detectAudioFormat(audioBuffer);
            console.log(`🔍 [WHISPER] Formato detectado: ${audioFormat}`);

            // Criar arquivo temporário com extensão correta
            const tempDir = os.tmpdir();
            tempFilePath = path.join(tempDir, `whisper_${speaker}_${Date.now()}.${audioFormat}`);

            // Escrever buffer no arquivo temporário
            fs.writeFileSync(tempFilePath, audioBuffer);
            console.log(`💾 [WHISPER] Arquivo ${audioFormat} criado: ${tempFilePath} (${audioBuffer.length} bytes)`);

            // Azure Whisper API - chamada HTTP direta
            const azureUrl = `${this.azureEndpoint}/openai/deployments/${this.azureDeployment}/audio/transcriptions?api-version=${this.azureApiVersion}`;

            // Usar node-fetch com form-data (compatibilidade garantida)
            const FormData = (await import('form-data')).default;
            const nodeFetch = (await import('node-fetch')).default;

            const formData = new FormData();
            formData.append('file', fs.createReadStream(tempFilePath), {
                filename: `audio.${audioFormat}`,
                contentType: `audio/${audioFormat}`
            });
            formData.append('language', language);
            formData.append('response_format', 'json');
            formData.append('temperature', '0');

            console.log(`🌐 [WHISPER] Enviando para Azure: ${azureUrl}`);

            // Retry com backoff exponencial para lidar com rate limits (429)
            const MAX_RETRIES = 3;
            let lastError: Error | null = null;

            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                if (attempt > 0) {
                    const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                    console.log(`⏳ [WHISPER] Retry ${attempt}/${MAX_RETRIES} após ${delay / 1000}s...`);
                    await new Promise(r => setTimeout(r, delay));

                    // Recriar FormData porque o stream foi consumido
                    const freshFormData = new FormData();
                    freshFormData.append('file', fs.createReadStream(tempFilePath), {
                        filename: `audio.${audioFormat}`,
                        contentType: `audio/${audioFormat}`
                    });
                    freshFormData.append('language', language);
                    freshFormData.append('response_format', 'json');
                    freshFormData.append('temperature', '0');

                    const retryResponse = await nodeFetch(azureUrl, {
                        method: 'POST',
                        headers: {
                            'api-key': this.azureApiKey,
                            ...freshFormData.getHeaders()
                        },
                        body: freshFormData
                    });

                    if (retryResponse.ok) {
                        const result = await retryResponse.json() as { text?: string };
                        const text = result.text || '';
                        const duration = Date.now() - startTime;
                        console.log(`✅ [WHISPER] Retry ${attempt} bem-sucedido!`);

                        // ✅ NOVO: Usar duração REAL do áudio (ANTES de deletar o arquivo)
                        try {
                            const actualAudioDurationMs = await this.getAudioDuration(tempFilePath);
                            await aiPricingService.logWhisperUsage(actualAudioDurationMs, consultaId, text, result);
                        } catch (durationError) {
                            // Fallback para estimativa se ffprobe falhar
                            const estimatedAudioDurationMs = Math.max(1000, (audioBuffer.length / 16000) * 1000);
                            await aiPricingService.logWhisperUsage(estimatedAudioDurationMs, consultaId, text, result);
                        }

                        // Limpar arquivo temporário DEPOIS de ler a duração
                        try { fs.unlinkSync(tempFilePath); } catch (e) { }

                        this.transcriptionCache.set(cacheKey, text);

                        return { text, duration };
                    }

                    if (retryResponse.status === 429) {
                        lastError = new Error(`Rate limit ainda ativo (tentativa ${attempt + 1})`);
                        continue;
                    }

                    const errorText = await retryResponse.text();
                    throw new Error(`Azure Whisper API error: ${retryResponse.status} - ${errorText}`);
                }

                const response = await nodeFetch(azureUrl, {
                    method: 'POST',
                    headers: {
                        'api-key': this.azureApiKey,
                        ...formData.getHeaders()
                    },
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json() as { text?: string };
                    const text = result.text || '';
                    const duration = Date.now() - startTime;


                    // 📊 Registrar uso do Whisper para monitoramento de custos
                    // ✅ NOVO: Usar duração REAL do áudio (via ffprobe) em vez de estimativa
                    try {
                        const actualAudioDurationMs = await this.getAudioDuration(tempFilePath);
                        await aiPricingService.logWhisperUsage(actualAudioDurationMs, consultaId, text, result);
                        console.log(`📊 [WHISPER] Uso registrado: ${(actualAudioDurationMs / 1000).toFixed(2)}s de áudio (duração real)`);
                    } catch (durationError) {
                        // Fallback: se ffprobe falhar, usar estimativa
                        console.warn(`⚠️ [WHISPER] Erro ao obter duração real, usando estimativa:`, durationError);
                        const estimatedAudioDurationMs = Math.max(1000, (audioBuffer.length / 16000) * 1000);
                        await aiPricingService.logWhisperUsage(estimatedAudioDurationMs, consultaId, text, result);
                        console.log(`📊 [WHISPER] Uso registrado: ~${Math.round(estimatedAudioDurationMs / 1000)}s de áudio (estimado)`);
                    }

                    console.log(`✅ [WHISPER] Transcrito ${speaker} em ${duration}ms: "${text.substring(0, 50)}..."`);

                    // Salvar no cache
                    this.transcriptionCache.set(cacheKey, text);

                    // Limpar cache antigo (manter apenas últimos 100)
                    if (this.transcriptionCache.size > 100) {
                        const firstKey = this.transcriptionCache.keys().next().value;
                        if (firstKey) {
                            this.transcriptionCache.delete(firstKey);
                        }
                    }

                    return {
                        text,
                        duration
                    };
                }

                // Se for rate limit (429), continuar retry
                if (response.status === 429) {
                    console.log(`⚠️ [WHISPER] Rate limit (429), tentativa ${attempt + 1}/${MAX_RETRIES}`);
                    continue;
                }

                // Outro erro - falhar imediatamente
                const errorText = await response.text();
                throw new Error(`Azure Whisper API error: ${response.status} - ${errorText}`);
            }

            // Não deveria chegar aqui após todas tentativas
            throw new Error('Falha após todas as tentativas de retry');

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [WHISPER] Erro ao transcrever ${speaker} (${duration}ms):`, error);

            // Log adicional para debug
            if (tempFilePath) {
                console.error(`📁 [WHISPER] Arquivo com problema: ${tempFilePath}`);
                if (fs.existsSync(tempFilePath)) {
                    const stats = fs.statSync(tempFilePath);
                    console.error(`📊 [WHISPER] Tamanho do arquivo: ${stats.size} bytes`);
                }
            }

            logError(
                `Erro ao transcrever áudio com Whisper`,
                'error',
                null,
                {
                    speaker,
                    bufferSize: audioBuffer.length,
                    error: error instanceof Error ? error.message : String(error)
                }
            );

            throw error;
        } finally {
            // Limpar arquivo temporário
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                    console.log(`🗑️ [WHISPER] Arquivo temporário removido`);
                } catch (cleanupError) {
                    console.warn(`⚠️ [WHISPER] Erro ao remover arquivo temporário:`, cleanupError);
                }
            }
        }
    }

    /**
     * Gera chave de cache baseada no conteúdo do áudio
     */
    private generateCacheKey(buffer: Buffer): string {
        // Hash simples do buffer (primeiros 1KB + tamanho)
        const sample = buffer.slice(0, 1024).toString('base64');
        return `${buffer.length}_${sample}`;
    }

    /**
     * Helper para sleep/delay
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Valida formato de áudio aceito pelo Whisper
     */
    isValidAudioFormat(mimeType: string): boolean {
        const validFormats = [
            'audio/webm',
            'audio/mp3',
            'audio/mpeg',
            'audio/mp4',
            'audio/m4a',
            'audio/wav',
            'audio/x-wav'
        ];

        return validFormats.some(format => mimeType.includes(format));
    }

    /**
     * Detecta formato de áudio baseado nos magic bytes do buffer
     */
    private detectAudioFormat(buffer: Buffer): string {
        // WebM: 0x1A 0x45 0xDF 0xA3
        if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
            return 'webm';
        }

        // OGG: 'OggS'
        if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
            return 'ogg';
        }

        // WAV: 'RIFF' ... 'WAVE'
        if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            return 'wav';
        }

        // MP3: ID3 or 0xFF 0xFB
        if ((buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
            (buffer[0] === 0xFF && buffer[1] === 0xFB)) {
            return 'mp3';
        }

        // Padrão: webm (mais comum no navegador)
        console.warn('⚠️ [WHISPER] Formato de áudio não identificado, usando webm como padrão');
        return 'webm';
    }

    /**
     * Limpa cache de transcrições
     */
    clearCache(): void {
        this.transcriptionCache.clear();
        console.log('🧹 [WHISPER] Cache limpo');
    }
}

// Exportar instância singleton
export const whisperService = new WhisperService();
