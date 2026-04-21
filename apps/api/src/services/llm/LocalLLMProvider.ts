import axios from "axios";
import { BaseLLMClient } from "./LLMClient";
import { env } from "../../config/env";

type OllamaGenerateResponse = {
  response?: string;
};

export class LocalLLMProvider extends BaseLLMClient {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    super();
    this.baseUrl = env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    this.model = env.OLLAMA_MODEL || "qwen2.5:7b-instruct";
  }

  async complete(prompt: string, systemPrompt: string): Promise<string> {
    const response = await axios.post<OllamaGenerateResponse>(
      `${this.baseUrl.replace(/\/$/, "")}/api/generate`,
      {
        model: this.model,
        system: systemPrompt,
        prompt,
        stream: false
      },
      {
        timeout: 120000
      }
    );

    return String(response.data?.response ?? "").trim();
  }
}
