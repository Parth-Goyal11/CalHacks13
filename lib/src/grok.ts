import { createXai } from "@ai-sdk/xai";
import {
  experimental_generateImage as generateImage,
  generateText,
  streamText,
  type CoreMessage,
} from "ai";

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
  /** Fast non-reasoning default for demos. */
  modelId: "grok-4.20-0309-non-reasoning" as const,
  visionModelId: "grok-4.20-0309-non-reasoning" as const,
  /** Grok Imagine image model in this SDK. */
  imageModelId: "grok-2-image" as const,

  async chat(messages: CoreMessage[], options?: { model?: string; system?: string }) {
    const xai = createGrokClient();
    const model = xai(options?.model ?? grok.modelId);

    return generateText({
      model,
      system: options?.system,
      messages,
    });
  },

  /** One Grok Imagine still of a creature. Returns the image bytes, not a mesh. */
  async imagine(prompt: string) {
    const xai = createGrokClient();
    const result = await generateImage({
      model: xai.image(grok.imageModelId),
      prompt,
      maxRetries: 1,
    });
    return {
      base64: result.image.base64,
      mimeType: result.image.mimeType,
    };
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
