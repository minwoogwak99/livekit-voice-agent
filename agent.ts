import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  voice,
} from "@livekit/agents";
import * as cartesia from "@livekit/agents-plugin-cartesia";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as livekit from "@livekit/agents-plugin-livekit";
import * as openai from "@livekit/agents-plugin-openai";
import * as silero from "@livekit/agents-plugin-silero";
import {
  BackgroundVoiceCancellation,
  TelephonyBackgroundVoiceCancellation,
} from "@livekit/noise-cancellation-node";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { CustomTTS } from "./custom-tts.js";
import { PassthroughLLM } from "./passthrough-llm.js";

dotenv.config({ path: ".env.local" });

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load({
      minSilenceDuration: 2,
    });
  },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad! as silero.VAD;

    const assistant = new voice.Agent({
      instructions: "You are a helpful voice AI assistant.",
    });

    const session = new voice.AgentSession({
      // vad,
      // stt: new openai.STT({
      //   model: 'gpt-4o-transcribe',
      //   language: "multi",
      // }),
      // stt: new deepgram.STT({ model: 'nova-2-general', language: "ko" }),
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
        // For telephony applications, use `TelephonyBackgroundVoiceCancellation` for best results
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

cli.runApp(
  new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: "test-agent-cf",
    shutdownProcessTimeout: 10 * 1_000,
  })
);
