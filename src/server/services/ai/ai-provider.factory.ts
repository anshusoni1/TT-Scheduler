import type { DocumentAIProvider } from './document-ai-provider.interface';
import { GeminiDocumentAIProvider } from './gemini-document-ai.provider';
import { MockDocumentAIProvider } from './mock-document-ai.provider';

let customProvider: DocumentAIProvider | null = null;

export function setCustomAIProvider(provider: DocumentAIProvider | null): void {
  customProvider = provider;
}

export function getAIProvider(): DocumentAIProvider {
  if (customProvider) {
    return customProvider;
  }

  if (process.env.NODE_ENV === 'test' && !process.env.USE_REAL_AI_IN_TESTS) {
    return new MockDocumentAIProvider();
  }

  return new GeminiDocumentAIProvider();
}
