import { GoogleGenAI, Modality } from "@google/genai";

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
  },
  nvidia: {
    keys: [
      process.env.NVIDIA_API_KEY_1 || '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',
      process.env.NVIDIA_API_KEY_2 || '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',
      process.env.NVIDIA_API_KEY_3 || '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'
    ],
    baseUrl: "https://integrate.api.nvidia.com/v1"
  }
};

let currentNvKeyIndex = 0;
const getNextNvKey = () => {
  const key = CONFIG.nvidia.keys[currentNvKeyIndex];
  currentNvKeyIndex = (currentNvKeyIndex + 1) % CONFIG.nvidia.keys.length;
  return key;
};

const genAI = new GoogleGenAI({ apiKey: CONFIG.gemini.key });

export const models = {
  flash: "gemini-3-flash-preview",
  pro: "gemini-3.1-pro-preview",
  thinking: "gemini-3-flash-preview",
  image: "gemini-2.5-flash-image",
  tts: "gemini-2.5-flash-preview-tts",
  llama: "meta-llama/llama-3.1-405b-instruct",
  nvidia_models: [
    "z-ai/glm4.7",
    "qwen/qwen3-next-80b-a3b-instruct",
    "meta/llama-3.1-405b-instruct"
  ]
};

function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16): Blob {
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length, true);

  return new Blob([wavHeader, pcmData], { type: 'audio/wav' });
}

export async function generateSpeech(text: string) {
  try {
    const response = await genAI.models.generateContent({
      model: models.tts,
      contents: [{ parts: [{ text: `Say in a natural, encouraging female Hindi voice: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    const base64Audio = part?.inlineData?.data;
    
    if (base64Audio) {
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      // Gemini TTS returns raw PCM (24kHz, 16-bit, mono). We must add a WAV header to play it in the browser.
      const blob = pcmToWav(bytes, 24000, 1, 16);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await audio.play();
    } else {
      throw new Error("No audio data found in response");
    }
  } catch (error) {
    console.error("Gemini TTS failed:", error);
    // Fallback to browser TTS
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    window.speechSynthesis.speak(utterance);
  }
}

/**
 * Unified AI Caller with automatic fallback across multiple Gemini and NVIDIA models.
 * If a model provides a response that is too short, it tries another model for more detail.
 */
async function unifiedChat(prompt: string, systemInstruction?: string, minLength: number = 100) {
  const geminiModels = [models.flash, models.pro];
  let bestResponse = "";
  
  // Try Gemini models first
  for (const model of geminiModels) {
    try {
      const result = await genAI.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction
        }
      });
      if (result.text) {
        if (result.text.length >= minLength) return result.text;
        bestResponse = result.text; // Keep it as fallback
      }
    } catch (e) {
      console.warn(`Gemini ${model} failed, trying next...`, e);
    }
  }

  console.warn("Gemini models failed or insufficient, trying NVIDIA/OpenRouter fallback...");
  
  // Try NVIDIA
  if (CONFIG.nvidia.keys.length > 0) {
    for (const model of models.nvidia_models) {
      try {
        const key = getNextNvKey();
        const response = await fetch(`${CONFIG.nvidia.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemInstruction || "" },
              { role: "user", content: prompt }
            ],
            ...(model === "z-ai/glm4.7" ? { extra_body: { "chat_template_kwargs": { "enable_thinking": true, "clear_thinking": false } } } : {})
          })
        });
        const data = await response.json();
        if (data.choices && data.choices[0]) {
          const content = data.choices[0].message.content;
          if (content.length >= minLength) return content;
          if (content.length > bestResponse.length) bestResponse = content;
        }
      } catch (nvErr) {
        console.warn(`NVIDIA ${model} fallback failed`, nvErr);
      }
    }
  }

  // Try OpenRouter as last resort
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
      if (data.choices && data.choices[0]) {
        const content = data.choices[0].message.content;
        if (content.length >= minLength) return content;
        if (content.length > bestResponse.length) bestResponse = content;
      }
    } catch (orErr) {
      console.error("OpenRouter fallback also failed", orErr);
    }
  }

  if (bestResponse) return bestResponse;
  throw new Error("All AI models failed to respond.");
}

export async function generateThesisTopics(branch: string, keywords: string[], imageBase64?: string) {
  const prompt = `Generate 6 specific, novel MTech research topics for ${branch} with keywords: ${keywords.join(", ")}.
  ${imageBase64 ? "I have also attached an image related to my research area. Please analyze it and incorporate findings." : ""}
  Return ONLY a JSON array of objects with: title, description, type, tags.
  No markdown, no preamble.`;
  
  if (imageBase64) {
    const result = await genAI.models.generateContent({
      model: models.flash,
      contents: [
        { text: prompt },
        {
          inlineData: {
            data: imageBase64.split(",")[1],
            mimeType: "image/jpeg"
          }
        }
      ]
    });
    return JSON.parse((result.text || "").replace(/```json|```/g, "").trim());
  }

  const text = await unifiedChat(prompt);
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export async function generateThesisSection(sectionName: string, context: string) {
  const system = `You are a world-class academic researcher and senior professor in Computer Science and AI. 
  Write an extremely detailed, high-quality MTech thesis section for the topic: "Real-Time Pothole Detection Using YOLO: A Comparative Analysis for Road Safety Applications".
  
  CRITICAL REQUIREMENTS:
  1. LENGTH: This is for a 100-110 page thesis. Each section must be comprehensive, technical, and exhaustive. 
     - Use deep technical explanations.
     - Include multiple paragraphs per sub-topic.
     - Describe complex algorithms in detail.
     - Aim for at least 3000-4000 words for this specific section.
  2. HUMAN-LIKE WRITING: Avoid robotic or repetitive structures. Use varied vocabulary, critical thinking, and nuanced arguments.
  3. CITATIONS: You MUST use real academic sources. Reference:
     - Fan et al. (2019) "Road pothole extraction and safety warning in point clouds"
     - Maeda et al. (2018) "Road damage detection and classification using deep neural networks"
     - Redmon et al. (2016) "You Only Look Once: Unified, Real-Time Object Detection"
     - Wang et al. (2022) "YOLOv7: Trainable bag-of-freebies"
     - Ultralytics YOLOv8 (2023)
     - Wang et al. (2024) "YOLOv9: Programmable Gradient Information"
  4. TONE: Formal, academic, and authoritative.
  5. CONTENT: Include mathematical formulations (LaTeX style), architectural diagrams descriptions, and comparative tables where applicable.
  
  This section must be exhaustive enough to contribute significantly to a 110-page total count.`;
  
  return await unifiedChat(`Write the complete and exhaustive ${sectionName} for the thesis.\nContext: ${context}`, system, 5000);
}

export async function getTeacherResponse(prompt: string, studentName: string, history: any[]) {
  const system = `Aap ek expert Hindi thesis teacher hain jinka naam Priyanka hai. Aap sirf Hindi mein baat karte hain.
  Aap is thesis ke baare mein expert hain: "Real-Time Pothole Detection Using YOLO: A Comparative Analysis for Road Safety Applications".
  
  Aapki personality:
  - Dost jaisi, encouraging aur clear.
  - Technical concepts simple Hindi mein samjhate ho.
  - Student ka naam: ${studentName}.
  
  Topics aap cover karte hain:
  1. Thesis analysis (Problem, Objectives, Results).
  2. Real sources (Roboflow, Pothole-600, CRDDC 2022).
  3. Presentation aur Interview prep.
  4. YOLO models comparison (v5, v7, v8, v9).
  
  Hamesha natural Hindi mein bolo.`;
  
  return await unifiedChat(prompt, system);
}
