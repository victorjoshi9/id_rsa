const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "sk_dc8d4e4e93650dd4cb81569a044c8f30a2c7dde2fc7c2b0b";

// Voice ID for "Priyanka" (or a suitable high-quality female voice)
// Using a standard high-quality female voice ID as placeholder
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; 

export async function speakWithPriyanka(text: string) {
  if (!ELEVENLABS_API_KEY) {
    console.error("ElevenLabs API key is missing");
    return;
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    await audio.play();
  } catch (error) {
    console.error("Failed to play ElevenLabs audio:", error);
    // Fallback to native speech synthesis if ElevenLabs fails
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    window.speechSynthesis.speak(utterance);
  }
}
