import { WorkerOptions, cli, defineAgent, voice, } from "@livekit/agents";
import * as cartesia from "@livekit/agents-plugin-cartesia";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as livekit from "@livekit/agents-plugin-livekit";
import * as openai from "@livekit/agents-plugin-openai";
import * as silero from "@livekit/agents-plugin-silero";
import { BackgroundVoiceCancellation } from "@livekit/noise-cancellation-node";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
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
            vad,
            // stt: new openai.STT({
            //   model: 'gpt-4o-transcribe',
            //   language: "multi",
            // }),
            // stt: new deepgram.STT({ model: 'nova-2-general', language: "ko" }),
            stt: new deepgram.STT({ model: "nova-3-general", language: "en" }),
            // llm: new openai.LLM({ model: "gpt-4o-mini" }),
            turnDetection: new livekit.turnDetector.MultilingualModel(),
        });
        await session.start({
            agent: assistant,
            room: ctx.room,
            inputOptions: {
                // For telephony applications, use `TelephonyBackgroundVoiceCancellation` for best results
                noiseCancellation: BackgroundVoiceCancellation(),
            },
            outputOptions: {
                audioEnabled: false,
                transcriptionEnabled: true,
            },
        });
        // await ctx.connect();
    },
});
cli.runApp(new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: "test-agent-2",
}));
//# sourceMappingURL=agent.js.map