import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

let _instance: any = null;

const getAI = () => {
  if (!_instance) {
    _instance = genkit({
      plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
      model: 'googleai/gemini-3.6-flash',
      telemetry: {
        disable: true
      }
    });
  }
  return _instance;
};

// High-durability factory functions to ensure 'this' binding and lazy-init safety
export const ai = {
  defineFlow: (...args: any[]) => getAI().defineFlow(...args),
  definePrompt: (...args: any[]) => getAI().definePrompt(...args),
  run: (...args: any[]) => getAI().run(...args),
} as any;



