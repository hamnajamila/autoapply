import OpenAI from "openai";
import { BaseLLMClient } from "./LLMClient";
import { env } from "../../config/env";

export class OpenAIProvider extends BaseLLMClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for OpenAIProvider");
    }
    super();
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.model = env.OPENAI_MODEL || "gpt-4o";
  }

  async complete(prompt: string, systemPrompt: string): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    });
    const text = res.choices[0]?.message?.content ?? "";
    return text;
  }
}

