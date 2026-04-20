import type { BaseLLMClient } from "./LLMClient";
import { LocalLLMProvider } from "./LocalLLMProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { GeminiProvider } from "./GeminiProvider";
import { env } from "../../config/env";

function createLocalProvider(): BaseLLMClient | null {
  try {
    return new LocalLLMProvider();
  } catch {
    return null;
  }
}

function createOpenAIProvider(): BaseLLMClient | null {
  if (!env.OPENAI_API_KEY) return null;
  try {
    return new OpenAIProvider();
  } catch {
    return null;
  }
}

function createGeminiProvider(): BaseLLMClient | null {
  if (!env.GEMINI_API_KEY) return null;
  try {
    return new GeminiProvider();
  } catch {
    return null;
  }
}

export function getDefaultLLMClient(): BaseLLMClient | null {
  switch (env.LLM_PROVIDER) {
    case "heuristic":
      return null;
    case "gemini":
      return createGeminiProvider();
    case "openai":
      return createOpenAIProvider();
    case "ollama":
      return createLocalProvider();
    case "auto":
    default:
      return createGeminiProvider() ?? createOpenAIProvider() ?? createLocalProvider();
  }
}

