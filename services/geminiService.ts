import { GoogleGenAI, Type } from "@google/genai";
import { AppSettings, Message, Attachment } from '../types';
import { IMAGE_MODEL, API_KEY_ENV } from '../constants';

// Helper to initialize AI with the correct key
const getAI = (settings?: AppSettings) => {
    // Priority: Settings Key -> Env Key -> Empty (will fail gracefully)
    const key = settings?.apiKey || API_KEY_ENV || '';
    if (!key) {
        throw new Error("⚠️ کلید API یافت نشد. لطفاً در تنظیمات (⚙️) کلید خود را وارد کنید.");
    }
    return new GoogleGenAI({ apiKey: key });
};

const getFriendlyErrorMessage = (error: any): string => {
    let msg = "";
    if (error instanceof Error) {
        msg = error.message;
    } else if (typeof error === 'object' && error !== null) {
        try {
            msg = JSON.stringify(error);
            if (error.error && error.error.message) msg = error.error.message;
            else if (error.message) msg = error.message;
        } catch {
            msg = String(error);
        }
    } else {
        msg = String(error);
    }

    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        return "⚠️ سقف مجاز استفاده (Quota) تکمیل شده است. لطفاً دقایقی دیگر تلاش کنید.";
    }
    if (msg.includes('SAFETY')) {
        return "⚠️ محتوا به دلیل محدودیت‌های ایمنی تولید نشد.";
    }
    if (msg.includes('404') || msg.includes('NOT_FOUND')) {
        return "⚠️ مدل مورد نظر یافت نشد. لطفاً در تنظیمات مدل دیگری را انتخاب کنید.";
    }
    if (msg.includes('API key')) {
        return "⚠️ کلید API نامعتبر است یا وارد نشده است.";
    }
    
    return msg.replace(/{"error":.*?}/g, "خطای ارتباط با سرور").substring(0, 200); 
};

export const generateContentStream = async (
  model: string,
  history: Message[],
  systemInstruction: string,
  settings: AppSettings,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<{ text: string, sources: { uri: string, title: string }[] }> => {
  try {
    const ai = getAI(settings);
    const tools: any[] = [];
    if (settings.enableSearch) {
      tools.push({ googleSearch: {} });
    }

    const chatHistory = history.slice(0, -1).map(msg => {
      const parts: any[] = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.attachments) {
          msg.attachments.forEach(att => {
              parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
          });
      }
      return { role: msg.role, parts: parts };
    });

    const lastMsg = history[history.length - 1];
    const currentParts: any[] = [{ text: lastMsg.content }];
    if (lastMsg.attachments) {
        lastMsg.attachments.forEach(att => {
            currentParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
        });
    }

    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: systemInstruction,
        temperature: settings.temperature,
        tools: tools,
      },
      history: chatHistory
    });

    const result = await chat.sendMessageStream({ 
        message: currentParts.length === 1 && currentParts[0].text ? currentParts[0].text : currentParts 
    });
    
    let fullText = "";
    let sources: { uri: string, title: string }[] = [];

    for await (const chunk of result) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
      const grounding = chunk.candidates?.[0]?.groundingMetadata;
      if (grounding?.groundingChunks) {
         grounding.groundingChunks.forEach((c: any) => {
             if (c.web?.uri) sources.push({ uri: c.web.uri, title: c.web.title || c.web.uri });
         });
      }
    }
    
    sources = sources.filter((v,i,a)=>a.findIndex(t=>(t.uri === v.uri))===i);
    return { text: fullText, sources };

  } catch (error: any) {
    if (error.name === 'AbortError') return { text: "🚫 تولید پاسخ متوقف شد.", sources: [] };
    console.error("Gemini Stream Error:", error);
    throw new Error(getFriendlyErrorMessage(error));
  }
};

export const generateImageContent = async (prompt: string, settings?: AppSettings): Promise<string> => {
    try {
        const ai = getAI(settings);
        const response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: { parts: [{ text: prompt }] },
            config: {}
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
        
        if (response.text) throw new Error("⚠️ تصویر تولید نشد (مدل پاسخ متنی داد).");
        throw new Error("تصویری تولید نشد.");

    } catch (error: any) {
        throw new Error(getFriendlyErrorMessage(error));
    }
}

export const analyzeFile = async (
    files: File[], 
    prompt: string, 
    model: string,
    systemInstruction: string,
    settings: AppSettings
): Promise<string> => {
    try {
        const ai = getAI(settings);
        const parts: any[] = [];
        for (const file of files) {
            const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const res = reader.result as string;
                    resolve(res.split(',')[1]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
        }
        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts },
            config: { systemInstruction }
        });
        return response.text || "پاسخی دریافت نشد.";
    } catch (error: any) {
        console.error("File Analysis Error:", error);
        throw new Error(getFriendlyErrorMessage(error));
    }
}

export const analyzeImage = async (file: File, prompt: string, model: string, settings: AppSettings): Promise<string> => {
    return analyzeFile([file], prompt, model, "You are an expert image analyst.", settings);
};

export const getStepByStep = async (
    originalQuestion: string,
    originalAnswer: string,
    model: string,
    settings: AppSettings
): Promise<string> => {
    try {
        const ai = getAI(settings);
        const prompt = `سوال کاربر: ${originalQuestion}\nپاسخ قبلی شما: ${originalAnswer}\nلطفاً مراحل رسیدن به این پاسخ را به صورت گام‌به‌گام توضیح بده.`;
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt
        });
        return response.text || "توضیحی یافت نشد.";
    } catch (error: any) {
        throw new Error(getFriendlyErrorMessage(error));
    }
}