import { AudioFrame, AudioResampler } from "@livekit/rtc-node";
import { tts, shortuuid } from "@livekit/agents";

export interface TTSRequest {
  model: string;
  input: string;
  voice: string;
  response_format: string;
  download_format: string;
  speed: number;
  stream: boolean;
  return_download_link: boolean;
  lang_code?: string;
  volume_multiplier: number;
  normalization_options: {
    normalize: boolean;
    unit_normalization: boolean;
    url_normalization: boolean;
    email_normalization: boolean;
    optional_pluralization_normalization: boolean;
    phone_normalization: boolean;
    replace_remaining_symbols: boolean;
  };
}

export interface CustomTTSOptions {
  endpoint?: string;
  model?: string;
  voice?: string;
  speed?: number;
  volume_multiplier?: number;
  sampleRate?: number;
  numChannels?: number;
}

export class CustomTTSStream extends tts.ChunkedStream {
  label = "CustomTTS";
  private readonly options: Required<CustomTTSOptions>;

  constructor(
    text: string,
    tts: CustomTTS,
    options: Required<CustomTTSOptions>
  ) {
    super(text, tts);
    this.options = options;
  }

  protected async run(): Promise<void> {
    const requestBody: TTSRequest = {
      model: this.options.model,
      input: this.inputText,
      voice: this.options.voice,
      response_format: "wav",
      download_format: "wav",
      speed: this.options.speed,
      stream: false, // Set to false for now to get complete audio
      return_download_link: false,
      volume_multiplier: this.options.volume_multiplier,
      normalization_options: {
        normalize: true,
        unit_normalization: false,
        url_normalization: true,
        email_normalization: true,
        optional_pluralization_normalization: true,
        phone_normalization: true,
        replace_remaining_symbols: true,
      },
    };

    try {
      const response = await fetch(this.options.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(
          `TTS API error: ${response.status} ${response.statusText}`
        );
      }

      // Get audio blob from response
      const audioBlob = await response.blob();
      const audioBuffer = await audioBlob.arrayBuffer();
      const audioData = new Uint8Array(audioBuffer);

      // Convert MP3 to PCM using a simple approach
      // Note: For production, you might want to use a proper MP3 decoder
      // For now, we'll assume the API can return PCM data or use Web Audio API
      const audioFrame = await this.convertAudioToFrame(audioData);

      const requestId = shortuuid();
      const segmentId = shortuuid();

      const synthesizedAudio: tts.SynthesizedAudio = {
        requestId,
        segmentId,
        frame: audioFrame,
        deltaText: this.inputText,
        final: true,
      };

      this.queue.put(synthesizedAudio);
    } catch (error) {
      throw new Error(`Failed to synthesize speech: ${error}`);
    }
  }

  private async convertAudioToFrame(
    audioData: Uint8Array
  ): Promise<AudioFrame> {
    try {
      // Parse WAV file to extract PCM data
      const wavData = this.parseWavFile(audioData);

      // Check if resampling is needed
      if (
        wavData.sampleRate === this.options.sampleRate &&
        wavData.numChannels === this.options.numChannels
      ) {
        // No resampling needed
        return new AudioFrame(
          wavData.pcmData,
          wavData.sampleRate,
          wavData.numChannels,
          wavData.samplesPerChannel
        );
      }

      // Resample if necessary
      const resampler = new AudioResampler(
        wavData.sampleRate,
        this.options.sampleRate,
        wavData.numChannels
      );

      const inputFrame = new AudioFrame(
        wavData.pcmData,
        wavData.sampleRate,
        wavData.numChannels,
        wavData.samplesPerChannel
      );

      const resampledFrames = resampler.push(inputFrame);
      const remainingFrames = resampler.flush();

      // Combine all resampled frames
      const allFrames = [...resampledFrames, ...remainingFrames];

      if (allFrames.length === 0) {
        throw new Error("No resampled audio data produced");
      }

      // Return the first frame, ensuring it exists
      const resultFrame = allFrames[0];
      if (!resultFrame) {
        throw new Error("No resampled audio frame available");
      }

      return resultFrame;
    } catch (error) {
      throw new Error(`Failed to convert audio to frame: ${error}`);
    }
  }

  private parseWavFile(audioData: Uint8Array): {
    pcmData: Int16Array;
    sampleRate: number;
    numChannels: number;
    samplesPerChannel: number;
  } {
    const dataView = new DataView(audioData.buffer);

    // Check for "RIFF" header
    const riffHeader = new TextDecoder().decode(audioData.slice(0, 4));
    if (riffHeader !== "RIFF") {
      throw new Error("Invalid WAV file: missing RIFF header");
    }

    // Check for "WAVE" format
    const waveFormat = new TextDecoder().decode(audioData.slice(8, 12));
    if (waveFormat !== "WAVE") {
      throw new Error("Invalid WAV file: missing WAVE format");
    }

    // Find fmt chunk
    let offset = 12;
    while (offset < audioData.length) {
      const chunkId = new TextDecoder().decode(
        audioData.slice(offset, offset + 4)
      );
      const chunkSize = dataView.getUint32(offset + 4, true);

      if (chunkId === "fmt ") {
        // Parse format chunk
        const audioFormat = dataView.getUint16(offset + 8, true);
        const numChannels = dataView.getUint16(offset + 10, true);
        const sampleRate = dataView.getUint32(offset + 12, true);
        const bitsPerSample = dataView.getUint16(offset + 22, true);

        if (audioFormat !== 1) {
          throw new Error("Unsupported WAV format: only PCM is supported");
        }

        if (bitsPerSample !== 16) {
          throw new Error("Unsupported bit depth: only 16-bit is supported");
        }

        // Find data chunk
        let dataOffset = offset + 8 + chunkSize;
        while (dataOffset < audioData.length) {
          const dataChunkId = new TextDecoder().decode(
            audioData.slice(dataOffset, dataOffset + 4)
          );
          const dataChunkSize = dataView.getUint32(dataOffset + 4, true);

          if (dataChunkId === "data") {
            // Extract PCM data
            const pcmStart = dataOffset + 8;
            const pcmEnd = pcmStart + dataChunkSize;
            const pcmBytes = audioData.slice(pcmStart, pcmEnd);

            // Convert to Int16Array
            const pcmData = new Int16Array(
              pcmBytes.buffer,
              pcmBytes.byteOffset,
              pcmBytes.byteLength / 2
            );
            const samplesPerChannel = pcmData.length / numChannels;

            return {
              pcmData,
              sampleRate,
              numChannels,
              samplesPerChannel,
            };
          }

          dataOffset += 8 + dataChunkSize;
        }

        throw new Error("Data chunk not found in WAV file");
      }

      offset += 8 + chunkSize;
    }

    throw new Error("Format chunk not found in WAV file");
  }
}

export class CustomTTS extends tts.TTS {
  label = "CustomTTS";
  private readonly options: Required<CustomTTSOptions>;

  constructor(options: CustomTTSOptions = {}) {
    const defaultOptions: Required<CustomTTSOptions> = {
      endpoint: "https://api-hifi.8om.ai/v1/audio/speech",
      model: "kokoro",
      voice: "af_heart",
      speed: 1,
      volume_multiplier: 1,
      sampleRate: 24000,
      numChannels: 1,
    };

    const finalOptions = { ...defaultOptions, ...options };

    super(finalOptions.sampleRate, finalOptions.numChannels, {
      streaming: false,
    });
    this.options = finalOptions;
  }

  synthesize(text: string): tts.ChunkedStream {
    return new CustomTTSStream(text, this, this.options);
  }

  stream(): never {
    throw new Error("Streaming not implemented for CustomTTS");
  }
}
