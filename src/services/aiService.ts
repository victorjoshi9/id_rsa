import OpenAI from 'openai';
import { GoogleGenAI } from "@google/genai";

// NVIDIA Configuration
const NVIDIA_KEYS = [
  process.env.NVIDIA_API_KEY_1 || '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',
  process.env.NVIDIA_API_KEY_2 || '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',
  process.env.NVIDIA_API_KEY_3 || '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'
];

const nvidiaClients = NVIDIA_KEYS.map(key => new OpenAI({
  apiKey: key,
  baseURL: 'https://integrate.api.nvidia.com/v1',
  dangerouslyAllowBrowser: true
}));

const NVIDIA_MODELS = [
  "z-ai/glm4.7",
  "qwen/qwen3-next-80b-a3b-instruct",
  "meta/llama-3.1-405b-instruct"
];

let currentClientIndex = 0;

const getNextNvidiaClient = () => {
  const client = nvidiaClients[currentClientIndex];
  currentClientIndex = (currentClientIndex + 1) % nvidiaClients.length;
  return client;
};

// OpenRouter Configuration
const openRouterClient = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    "HTTP-Referer": window.location.origin,
    "X-Title": "MTech Research Assistant",
  }
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const generateWithNvidia = async (prompt: string, modelIndex: number = 0) => {
  try {
    const client = getNextNvidiaClient();
    const model = NVIDIA_MODELS[modelIndex % NVIDIA_MODELS.length];
    
    const completion = await client.chat.completions.create({
      model: model,
      messages: [{ role: "user", content: prompt }],
      temperature: 1,
      top_p: 1,
      max_tokens: 4096,
      ...(model === "z-ai/glm4.7" ? { extra_body: { "chat_template_kwargs": { "enable_thinking": true, "clear_thinking": false } } } : {})
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("NVIDIA API Error:", error);
    return null;
  }
};

export const generateWithOpenRouter = async (prompt: string) => {
  try {
    const completion = await openRouterClient.chat.completions.create({
      model: "openrouter/free",
      messages: [{ role: "user", content: prompt }],
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("OpenRouter API Error:", error);
    return null;
  }
};

export const getGeminiTTS = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ parts: [{ text: `Say in a professional, warm Hindi female voice: ${text}` }] }],
      config: {
        responseModalities: ["audio"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    const base64Audio = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType || 'audio/wav';

    if (base64Audio) {
      return `data:${mimeType};base64,${base64Audio}`;
    }
    return null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};
