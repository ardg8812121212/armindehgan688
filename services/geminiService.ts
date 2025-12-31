import { GoogleGenAI, Type } from "@google/genai";
import { AppSettings, Message, Attachment } from '../types';
import { IMAGE_MODEL } from '../constants';

const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

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
    const tools: any[] = [];
    if (settings.enableSearch) {
      tools.push({ googleSearch: {} });
    }

    // Convert history to Gemini format, including attachments
    const chatHistory = history.slice(0, -1).map(msg => {
      const parts: any[] = [];
      
      // Add text
      if (msg.content) {
          parts.push({ text: msg.content });
      }

      // Add attachments (User uploaded images/files)
      if (msg.attachments) {
          msg.attachments.forEach(att => {
              parts.push({
                  inlineData: {
                      mimeType: att.mimeType,
                      data: att.data
                  }
              });
          });
      }

      return {
        role: msg.role,
        parts: parts,
      };
    });

    // Prepare current message
    const lastMsg = history[history.length - 1];
    const currentParts: any[] = [{ text: lastMsg.content }];
    if (lastMsg.attachments) {
        lastMsg.attachments.forEach(att => {
            currentParts.push({
                inlineData: {
                    mimeType: att.mimeType,
                    data: att.data
                }
            });
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

    // We must send 'message' as a string or array of parts. 
    // sendMessageStream accepts string | Part | Array<string | Part>
    const result = await chat.sendMessageStream({ 
        message: currentParts.length === 1 && currentParts[0].text ? currentParts[0].text : currentParts 
    });
    
    let fullText = "";
    let sources: { uri: string, title: string }[] = [];

    for await (const chunk of result) {
      if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
      }

      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
      
      const grounding = chunk.candidates?.[0]?.groundingMetadata;
      if (grounding?.groundingChunks) {
         grounding.groundingChunks.forEach((c: any) => {
             if (c.web?.uri) {
                 sources.push({ uri: c.web.uri, title: c.web.title || c.web.uri });
             }
         });
      }
    }
    
    sources = sources.filter((v,i,a)=>a.findIndex(t=>(t.uri === v.uri))===i);

    return { text: fullText, sources };

  } catch (error: any) {
    if (error.name === 'AbortError') {
        return { text: "🚫 تولید پاسخ متوقف شد.", sources: [] };
    }
    console.error("Gemini Stream Error:", error);
    throw new Error(getFriendlyErrorMessage(error));
  }
};

export const generateImageContent = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: IMAGE_MODEL,
            contents: {
                parts: [{ text: prompt }]
            },
            config: {}
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        
        if (response.text) {
             throw new Error("⚠️ تصویر تولید نشد (مدل پاسخ متنی داد).");
        }
        throw new Error("تصویری تولید نشد.");

    } catch (error: any) {
        throw new Error(getFriendlyErrorMessage(error));
    }
}

export const analyzeFile = async (
    files: File[], 
    prompt: string, 
    model: string,
    systemInstruction: string
): Promise<string> => {
    try {
        const parts: any[] = [];
        
        // Process all files
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
            
            parts.push({
                inlineData: {
                    mimeType: file.type,
                    data: base64Data
                }
            });
        }

        // Add the prompt
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

export const analyzeImage = async (file: File, prompt: string, model: string): Promise<string> => {
    return analyzeFile([file], prompt, model, "You are an expert image analyst.");
};

export const getStepByStep = async (
    originalQuestion: string,
    originalAnswer: string,
    model: string
): Promise<string> => {
    try {
        const prompt = `
        سوال کاربر: ${originalQuestion}
        پاسخ قبلی شما: ${originalAnswer}
        
        لطفاً مراحل رسیدن به این پاسخ را به صورت گام‌به‌گام، دقیق و آموزشی توضیح بده.
        `;
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt
        });
        return response.text || "توضیحی یافت نشد.";
    } catch (error: any) {
        throw new Error(getFriendlyErrorMessage(error));
    }
}