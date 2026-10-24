import { createXai } from "@ai-sdk/xai";
import { generateText, streamText, type CoreMessage } from "ai";

/**
 * Shared xAI Grok client for SpaceXAI track (Cursor + Grok Imagine/Voice).
 * Requires XAI_API_KEY in the environment.
 */
export function createGrokClient(apiKey = process.env.XAI_API_KEY) {
  if (!apiKey) {
    throw new Error("XAI_API_KEY is not set. Copy .env.example to .env and add your key.");
  }

  return createXai({ apiKey });
}

export const grok = {
  /** Default chat model id — override per call as needed. */
  modelId: "grok-3-mini" as const,

  async chat(messages: CoreMessage[], options?: { model?: string; system?: string }) {
    const xai = createGrokClient();
    const model = xai(options?.model ?? grok.modelId);

    return generateText({
      model,
      system: options?.system,
      messages,
    });
  },

  stream(messages: CoreMessage[], options?: { model?: string; system?: string }) {
    const xai = createGrokClient();
    const model = xai(options?.model ?? grok.modelId);

    return streamText({
      model,
      system: options?.system,
      messages,
    });
  },
};

export type { CoreMessage };
