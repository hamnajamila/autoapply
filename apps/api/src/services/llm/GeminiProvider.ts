import { GoogleGenAI } from "@google/genai";
import { BaseLLMClient } from "./LLMClient";
import { env } from "../../config/env";

export class GeminiProvider extends BaseLLMClient {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor() {
    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required for GeminiProvider");
    }
    super();
    this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    this.model = env.GEMINI_MODEL || "gemini-1.5-flash";
  }

  async complete(prompt: string, systemPrompt: string): Promise<string> {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
      }
    });
    return res.text ?? "";
  }
}
