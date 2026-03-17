export interface LLMClient {
  complete(prompt: string, systemPrompt: string): Promise<string>;
  completeJSON<T>(prompt: string, systemPrompt: string): Promise<T>;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}

export abstract class BaseLLMClient implements LLMClient {
  abstract complete(prompt: string, systemPrompt: string): Promise<string>;

  async completeJSON<T>(prompt: string, systemPrompt: string): Promise<T> {
    const sys = `${systemPrompt.trim()}\n\nRespond ONLY with valid JSON. No markdown, no backticks.`;

    const tryParse = async (p: string, s: string) => {
      const raw = await this.complete(p, s);
      const cleaned = stripCodeFences(raw);
      return JSON.parse(cleaned) as T;
    };

    try {
      return await tryParse(prompt, sys);
    } catch (err) {
      const retrySys =
        `${sys}\n\nIMPORTANT: Output must be a single JSON value (object or array) with double-quoted keys/strings. ` +
        `Do not include trailing commas.`;
      try {
        return await tryParse(prompt, retrySys);
      } catch {
        throw err;
      }
    }
  }
}

