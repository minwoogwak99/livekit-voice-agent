import { WorkerOptions, cli, defineAgent, voice, } from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as livekit from "@livekit/agents-plugin-livekit";
import * as silero from "@livekit/agents-plugin-silero";
import { TelephonyBackgroundVoiceCancellation } from "@livekit/noise-cancellation-node";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { CustomTTS } from "./custom-tts.js";
import { PassthroughLLM } from "./passthrough-llm.js";
dotenv.config({ path: ".env.local" });
export default defineAgent({
    prewarm: async (proc) => {
        proc.userData.vad = await silero.VAD.load({
            minSilenceDuration: 2,
        });
    },
    entry: async (ctx) => {
        const vad = ctx.proc.userData.vad;
        const assistant = new voice.Agent({
            instructions: "You are a helpful voice AI assistant.",
        });
        const session = new voice.AgentSession({
            stt: new deepgram.STT({ model: "nova-3", language: "multi" }),
            llm: new PassthroughLLM(),
            tts: new CustomTTS({
                endpoint: "https://api-hifi.8om.ai/v1/audio/speech",
                model: "kokoro",
                voice: "af_heart",
                speed: 1,
                volume_multiplier: 1,
                sampleRate: 24000,
                numChannels: 1,
            }),
            turnDetection: new livekit.turnDetector.MultilingualModel(),
        });
        await session.start({
            agent: assistant,
            room: ctx.room,
            inputOptions: {
                noiseCancellation: TelephonyBackgroundVoiceCancellation(),
            },
            outputOptions: {
                audioEnabled: true,
                transcriptionEnabled: true,
            },
        });
        await ctx.connect();
    },
});
cli.runApp(new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: "test-agent-cf",
    shutdownProcessTimeout: 10 * 1_000,
}));
//# sourceMappingURL=agent.js.map