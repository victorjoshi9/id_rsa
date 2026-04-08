import { GoogleGenAI } from "@google/genai";

// Multi-provider configuration
const CONFIG = {
  gemini: {
    key: process.env.GEMINI_API_KEY || "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta"
  },
  openai: {
    key: process.env.OPENAI_API_KEY || "",
    baseUrl: "https://api.openai.com/v1"
  },
  openrouter: {
    key: process.env.OPENROUTER_API_KEY || "",
    baseUrl: "https://openrouter.ai/api/v1"
  },
  huggingface: {
    key: process.env.HUGGINGFACE_API_KEY || "",
    baseUrl: "https://api-inference.huggingface.co/models"
  }
};

const genAI = new GoogleGenAI({ apiKey: CONFIG.gemini.key }) as any;

export const models = {
  flash: "gemini-2.0-flash",
  pro: "gemini-1.5-pro",
  thinking: "gemini-2.0-flash-thinking-exp",
  image: "gemini-3-pro-image-preview",
  tts: "gemini-2.5-flash-preview-tts"
};

/**
 * Unified AI Caller with automatic fallback
 */
async function unifiedChat(prompt: string, systemInstruction?: string) {
  // Try Gemini first
  try {
    const model = genAI.getGenerativeModel({ 
      model: models.flash,
      systemInstruction: systemInstruction
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (e) {
    console.warn("Gemini failed, trying OpenRouter fallback...", e);
    
    if (CONFIG.openrouter.key) {
      try {
        const response = await fetch(`${CONFIG.openrouter.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${CONFIG.openrouter.key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "meta-llama/llama-3.1-8b-instruct:free",
            messages: [
              { role: "system", content: systemInstruction || "" },
              { role: "user", content: prompt }
            ]
          })
        });
        const data = await response.json();
        return data.choices[0].message.content;
      } catch (orErr) {
        console.error("OpenRouter fallback also failed", orErr);
      }
    }
    throw e;
  }
}

export async function generateThesisTopics(branch: string, keywords: string[], imageBase64?: string) {
  const prompt = `Generate 6 specific, novel MTech research topics for ${branch} with keywords: ${keywords.join(", ")}.
  ${imageBase64 ? "I have also attached an image related to my research area. Please analyze it and incorporate findings." : ""}
  Return ONLY a JSON array of objects with: title, description, type, tags.
  No markdown, no preamble.`;
  
  if (imageBase64) {
    const model = genAI.getGenerativeModel({ model: models.flash });
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64.split(",")[1],
          mimeType: "image/jpeg"
        }
      }
    ]);
    return JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
  }

  const text = await unifiedChat(prompt);
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export async function generateThesisSection(sectionName: string, context: string) {
  const system = `You are a senior academic writer. Write a formal MTech thesis section. 
  Follow strict academic standards. No AI-isms. Use citations like [AuthorYear]. 
  Aim for depth and technical accuracy.`;
  
  return await unifiedChat(`Write the ${sectionName} for an MTech thesis.\nContext: ${context}`, system);
}

export async function getThinkingResponse(prompt: string) {
  return await unifiedChat(prompt, "You are a highly intelligent research assistant with deep thinking capabilities.");
}
