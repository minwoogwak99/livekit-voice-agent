import { tts } from "@livekit/agents";
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
export declare class CustomTTSStream extends tts.ChunkedStream {
    label: string;
    private readonly options;
    constructor(text: string, tts: CustomTTS, options: Required<CustomTTSOptions>);
    protected run(): Promise<void>;
    private convertAudioToFrame;
    private parseWavFile;
}
export declare class CustomTTS extends tts.TTS {
    label: string;
    private readonly options;
    constructor(options?: CustomTTSOptions);
    synthesize(text: string): tts.ChunkedStream;
    stream(): never;
}
//# sourceMappingURL=custom-tts.d.ts.map