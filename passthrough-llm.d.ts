import { llm } from "@livekit/agents";
export declare class PassthroughLLM extends llm.LLM {
    label(): string;
    get model(): string;
    chat({ chatCtx, toolCtx, connOptions, parallelToolCalls, toolChoice, extraKwargs, }: {
        chatCtx: llm.ChatContext;
        toolCtx?: llm.ToolContext;
        connOptions?: any;
        parallelToolCalls?: boolean;
        toolChoice?: llm.ToolChoice;
        extraKwargs?: Record<string, any>;
    }): llm.LLMStream;
}
//# sourceMappingURL=passthrough-llm.d.ts.map