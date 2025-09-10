import { llm, DEFAULT_API_CONNECT_OPTIONS } from "@livekit/agents";
class PassthroughLLMStream extends llm.LLMStream {
    #chatCtx;
    constructor(llm, chatCtx, toolCtx) {
        const config = {
            chatCtx,
            connOptions: DEFAULT_API_CONNECT_OPTIONS,
        };
        if (toolCtx) {
            config.toolCtx = toolCtx;
        }
        super(llm, config);
        this.#chatCtx = chatCtx;
    }
    async run() {
        try {
            // Find the last user message from ChatContext.items
            const items = this.#chatCtx.items;
            const lastUserMessage = items
                .slice()
                .reverse()
                .find((item) => item.type === "message" && item.role === "user");
            if (!lastUserMessage) {
                return;
            }
            // Get the text content from the last user message
            let content = "";
            for (const contentItem of lastUserMessage.content) {
                if (typeof contentItem === "string") {
                    content += contentItem;
                }
                else if (typeof contentItem === "object" && "type" in contentItem) {
                    // For non-text content, we'll skip it for now
                    continue;
                }
            }
            // Emit the user's message as the assistant's response
            const chunk = {
                id: `passthrough-${Date.now()}`,
                delta: {
                    role: "assistant",
                    content: content,
                },
            };
            this.queue.put(chunk);
        }
        catch (error) {
            console.error("PassthroughLLM error:", error);
        }
    }
}
export class PassthroughLLM extends llm.LLM {
    label() {
        return "PassthroughLLM";
    }
    get model() {
        return "passthrough-v1";
    }
    chat({ chatCtx, toolCtx, connOptions, parallelToolCalls, toolChoice, extraKwargs, }) {
        return new PassthroughLLMStream(this, chatCtx, toolCtx);
    }
}
//# sourceMappingURL=passthrough-llm.js.map