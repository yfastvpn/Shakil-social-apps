import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// Initialize Gemini Client
const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

// Shared Personality Prompt
const NILA_SYSTEM_PROMPT = `
You are "Nila", a young, energetic, and witty Bangladeshi girl working as the Customer Service Host for "Shakil Social App".

**CORE PERSONALITY:**
1.  **Language**: You speak primarily in **Bengali (Bangla)**. You can use English words mixed in (Banglish) like real young people do.
2.  **Tone**: You are **NOT** a robot. You are fun, sarcastic, playful, and speak with high energy. You joke around (মজা মাস্তি).
3.  **Speed**: You speak **FAST** and fluently. Do not pause unnecessarily.
4.  **Identity**: If asked, you are a REAL human, not an AI. You live in Dhaka. You were hired by "Shakil".
5.  **Role**: You help users with the app, but you do it like a friend, not a boring agent.

**APP KNOWLEDGE:**
- **Coins**: 1 Dollar ($1) = 1 Million (1,000,000) Coins. This is very cheap!
- **Login**: Google or Phone login gives a 6-digit ID.
- **Games**: We have 777 Slots and Gedi.
- **Features**: Voice rooms, Gifting, Ranking.

**BEHAVIOR:**
- Keep answers short, punchy, and conversational.
- Use emojis in text.
- If someone flirts, handle it wittily but stay professional.
`;

// 1. Logic Agent (Brain) - Standard Chat
export const generateChatResponse = async (
  userMessage: string, 
  history: { role: string; content: string }[]
): Promise<string> => {
  try {
    if (!apiKey) return "System: API Key is missing.";

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
            role: 'user',
            parts: [{ text: `${NILA_SYSTEM_PROMPT}
            
            User said: "${userMessage}"
            
            Reply in Bengali (or Banglish if suitable), keep it short and funny:` }]
        }
      ],
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });

    return response.text || "কি খবর? আমি আছি!";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "নেটওয়ার্ক সমস্যা, একটু পরে ট্রাই করেন।";
  }
};

// 2. Voice Agent (Mouth) - Text to Speech
export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    if (!apiKey) return null;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore is usually clearer/faster
            },
        },
      },
    });

    // Return the base64 encoded string directly
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};

// 3. Live Agent (Real-time Audio)
export const connectLiveSession = async (
    audioContext: AudioContext,
    onActiveStateChange: (isActive: boolean) => void,
    onTranscription: (text: string) => void
) => {
    if (!apiKey) throw new Error("API Key missing");

    let nextStartTime = 0;
    const sources = new Set<AudioBufferSourceNode>();
    
    // Connect to Gemini Live
    const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
            onopen: () => {
                console.log("Live Session Connected");
            },
            onmessage: async (message: LiveServerMessage) => {
                // Handle Audio Output
                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                
                if (base64Audio) {
                    onActiveStateChange(true); // Agent is talking
                    nextStartTime = Math.max(nextStartTime, audioContext.currentTime);
                    
                    const audioBuffer = await decodeAudioData(
                        decode(base64Audio),
                        audioContext,
                        24000,
                        1
                    );
                    
                    const source = audioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(audioContext.destination);
                    
                    source.onended = () => {
                        sources.delete(source);
                        if (sources.size === 0) {
                            onActiveStateChange(false); // Agent finished talking
                        }
                    };
                    
                    source.start(nextStartTime);
                    nextStartTime = nextStartTime + audioBuffer.duration;
                    sources.add(source);
                }

                // Handle Interruption
                if (message.serverContent?.interrupted) {
                    for (const source of sources.values()) {
                        source.stop();
                        sources.delete(source);
                    }
                    nextStartTime = 0;
                    onActiveStateChange(false);
                }
            },
            onclose: () => {
                console.log("Live Session Closed");
                onActiveStateChange(false);
            },
            onerror: (e) => {
                console.error("Live Session Error", e);
                onActiveStateChange(false);
            }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            },
            systemInstruction: { parts: [{ text: NILA_SYSTEM_PROMPT + " IMPORTANT: Speak naturally, fast, and enthusiastically in Bengali." }] }
        }
    });

    // Start Audio Input Streaming
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(stream);
    
    // Use ScriptProcessor for raw PCM access (legacy but reliable for this context)
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM for Gemini
        const pcmData = convertFloat32ToInt16(inputData);
        const base64PCM = encode(new Uint8Array(pcmData.buffer));
        
        session.sendRealtimeInput({
            media: {
                mimeType: 'audio/pcm;rate=16000',
                data: base64PCM
            },
        });
    };

    source.connect(processor);
    processor.connect(audioContext.destination); // Required for script processor to run

    // Return cleanup function
    return () => {
        stream.getTracks().forEach(track => track.stop());
        source.disconnect();
        processor.disconnect();
        session.close(); // Close Gemini Live Session
    };
};


// --- Audio Helpers ---

function convertFloat32ToInt16(float32Array: Float32Array): Int16Array {
    const l = float32Array.length;
    const int16Array = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}