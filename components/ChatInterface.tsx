import React, { useState, useRef, useEffect } from 'react';
import { Message, AppSettings, Persona, Attachment } from '../types';
import { generateContentStream, getStepByStep, generateImageContent } from '../services/geminiService';

declare global {
  interface Window {
    MathJax: any;
    webkitSpeechRecognition: any;
  }
}

// --- Code Block Component ---
const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
    const lines = code.split('\n');
    return (
        <div className="relative my-4 rounded-lg overflow-hidden border border-white/10 bg-[#1e1e1e] shadow-2xl font-mono text-sm group" dir="ltr">
            <div className="flex justify-between items-center px-4 py-2 bg-[#2d2d2d] border-b border-white/5">
                <span className="text-xs text-white/50 lowercase">{language || 'code'}</span>
                <button 
                    onClick={() => navigator.clipboard.writeText(code)}
                    className="text-xs text-white/40 hover:text-white transition-colors"
                >
                    Copy
                </button>
            </div>
            <div className="flex overflow-x-auto p-4">
                <div className="flex flex-col text-right pr-4 text-white/20 select-none border-r border-white/5 mr-4">
                    {lines.map((_, i) => (
                        <span key={i} className="leading-6">{i + 1}</span>
                    ))}
                </div>
                <pre className="flex-1 leading-6">
                    <code className="language-javascript text-gray-300">
                        {lines.map((line, i) => (
                            <div key={i} className="whitespace-pre">
                                {line.split(/(\s+)/).map((token, j) => {
                                    if (token.match(/^(const|let|var|function|return|import|export|from|if|else|for|while|class|interface)$/)) return <span key={j} className="text-purple-400 font-bold">{token}</span>;
                                    if (token.match(/^('.*'|".*"|`.*`)$/)) return <span key={j} className="text-green-400">{token}</span>;
                                    if (token.match(/^\d+$/)) return <span key={j} className="text-orange-400">{token}</span>;
                                    if (token.match(/(\/\/.*)/)) return <span key={j} className="text-gray-500 italic">{token}</span>;
                                    if (token.match(/[A-Z][a-zA-Z0-9]*/)) return <span key={j} className="text-yellow-400">{token}</span>;
                                    return <span key={j}>{token}</span>;
                                })}
                            </div>
                        ))}
                    </code>
                </pre>
            </div>
        </div>
    );
};

// --- Parsed Text ---
const ParsedText: React.FC<{ text: string, onImageDetected?: (prompt: string) => void, imageError?: boolean }> = ({ text, onImageDetected, imageError }) => {
    const parts = text.split(/(```[\s\S]*?```|<<GENERATE_IMAGE:.*?>>)/g);
    
    useEffect(() => {
        const imgMatch = text.match(/<<GENERATE_IMAGE:(.*?)>>/);
        if (imgMatch && onImageDetected) {
            onImageDetected(imgMatch[1].trim());
        }
        if (window.MathJax && window.MathJax.typesetPromise) {
             window.MathJax.typesetPromise().catch((err: any) => {});
        }
    }, [text]);

    return (
        <div className="prose prose-invert max-w-none text-sm leading-relaxed">
            {parts.map((part, i) => {
                if (part.startsWith('```')) {
                    const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
                    const lang = match ? match[1] : '';
                    const content = match ? match[2] : part.replace(/```/g, '');
                    return <CodeBlock key={i} code={content} language={lang} />;
                }
                if (part.startsWith('<<GENERATE_IMAGE:')) {
                    if (imageError) {
                        return <div key={i} className="text-xs text-red-400 italic bg-red-500/10 p-2 rounded flex items-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                             </svg>
                            خطا در تولید تصویر (محدودیت سیستم)
                        </div>;
                    }
                    return <div key={i} className="text-xs text-armin-secondary italic animate-pulse flex items-center gap-2">
                        <span className="w-2 h-2 bg-armin-secondary rounded-full animate-ping"></span>
                        🖼️ در حال آماده‌سازی بوم نقاشی برای تصویر...
                    </div>;
                }
                return <p key={i} className="whitespace-pre-wrap mb-2" dangerouslySetInnerHTML={{__html: part.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/__(.*?)__/g, '<i>$1</i>')}} />;
            })}
        </div>
    );
};

interface Props {
  persona: Persona;
  settings: AppSettings;
  onError: (msg: string) => void;
}

const ChatInterface: React.FC<Props> = ({ persona, settings, onError }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming, thinking, attachments]);

  // --- Voice Input ---
  const handleMicClick = () => {
      if (!('webkitSpeechRecognition' in window)) {
          onError("مرورگر شما از قابلیت تبدیل گفتار به نوشتار پشتیبانی نمی‌کند. لطفاً از گوگل کروم استفاده کنید.");
          return;
      }
      if (isRecording) return;

      const recognition = new window.webkitSpeechRecognition();
      recognition.lang = 'fa-IR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = (event: any) => {
          console.error("Speech Error", event.error);
          setIsRecording(false);
          onError("خطا در دسترسی به میکروفون یا سرویس گفتار.");
      };
      recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(prev => prev + ' ' + transcript);
      };

      try {
        recognition.start();
      } catch(e) {
          onError("خطا در شروع ضبط صدا.");
      }
  };

  // --- File/Image Attachments ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const newAttachments: Attachment[] = [];
          for (let i = 0; i < e.target.files.length; i++) {
              const file = e.target.files[i];
              // Size check (e.g. 5MB)
              if (file.size > 5 * 1024 * 1024) {
                  onError(`فایل ${file.name} بیش از حد حجیم است (حداکثر ۵ مگابایت).`);
                  continue;
              }
              try {
                  const base64 = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve((reader.result as string).split(',')[1]);
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                  });
                  newAttachments.push({
                      type: file.type.startsWith('image/') ? 'image' : 'file',
                      mimeType: file.type,
                      data: base64,
                      name: file.name
                  });
              } catch (err) {
                  console.error(err);
                  onError(`خطا در خواندن فایل ${file.name}`);
              }
          }
          setAttachments(prev => [...prev, ...newAttachments]);
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // --- Actions ---
  const handleDownloadFile = (content: string, type: 'txt' | 'html') => {
      try {
          const element = document.createElement("a");
          const file = new Blob([content], {type: type === 'html' ? 'text/html' : 'text/plain'});
          element.href = URL.createObjectURL(file);
          element.download = `armin-ai-lesson-${Date.now()}.${type}`;
          document.body.appendChild(element);
          element.click();
          document.body.removeChild(element);
      } catch (e) {
          onError("خطا در دانلود فایل.");
      }
  };

  const generateImageForMessage = async (msgId: string, prompt: string) => {
      const msg = messages.find(m => m.id === msgId);
      if (msg && (msg.images || msg.imageError)) return; 

      try {
          const base64 = await generateImageContent(prompt + " . photorealistic, 8k, cinematic, educational, highly detailed");
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, images: [base64] } : m));
      } catch (e: any) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, imageError: true } : m));
          // Only show error notification if it's NOT a quota error (which is handled inline)
          if (!e.message.includes('Quota') && !e.message.includes('429')) {
             onError(`خطا در تصویرسازی خودکار: ${e.message}`);
          }
      }
  };

  const handleSend = async (text: string = input, isEdit: boolean = false) => {
    if ((!text.trim() && attachments.length === 0) || loading) return;

    const controller = new AbortController();
    setAbortController(controller);

    const currentAttachments = [...attachments];
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    };

    let newHistory = isEdit ? [...messages.slice(0, -2), userMsg] : [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setAttachments([]);
    setLoading(true);
    setThinking(true); // Start thinking animation

    // Simulate "Supernatural Deep Thought" (Delayed response)
    await new Promise(resolve => setTimeout(resolve, 2000));
    setThinking(false);
    setStreaming(true);

    const botMsgId = (Date.now() + 1).toString();
    const botMsg: Message = {
      id: botMsgId,
      role: 'model',
      content: '',
      timestamp: Date.now(),
      isStreaming: true
    };
    
    setMessages(prev => [...prev, botMsg]);

    try {
      let accumalatedText = '';
      const result = await generateContentStream(
        settings.model,
        newHistory,
        persona.systemPrompt,
        settings,
        (chunk) => {
          accumalatedText += chunk;
          setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: accumalatedText } : m));
        },
        controller.signal
      );

      setMessages(prev => prev.map(m => m.id === botMsgId ? { 
          ...m, 
          content: result.text,
          sources: result.sources.length > 0 ? result.sources : undefined,
          isStreaming: false 
      } : m));

    } catch (err: any) {
       if (err.name === 'AbortError') {
           // handled in UI
       } else {
           onError(err.message);
           setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isError: true, content: err.message, isStreaming: false } : m));
       }
    } finally {
      setLoading(false);
      setStreaming(false);
      setAbortController(null);
    }
  };

  const handleStop = () => {
      if (abortController) {
          abortController.abort();
          setStreaming(false);
          setLoading(false);
          setThinking(false);
      }
  };

  const handleShowSteps = async (msgIndex: number) => {
    const targetMsg = messages[msgIndex];
    if (targetMsg.role !== 'model') return;
    const userPrompt = messages[msgIndex - 1]?.content;
    if (!userPrompt) return;

    setLoading(true);
    try {
        const steps = await getStepByStep(userPrompt, targetMsg.content, settings.model);
        const explanationMsg: Message = {
            id: Date.now().toString(),
            role: 'model',
            content: `🔍 **تحلیل گام‌به‌گام:**\n\n${steps}`,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, explanationMsg]);
    } catch (err: any) {
        onError(err.message);
    } finally {
        setLoading(false);
    }
  };

  // Styles
  const isDoctor = persona.id === 'doctor';
  const isTeacher = persona.id === 'teacher';
  
  const userBubbleStyle = isTeacher 
      ? 'bg-gradient-to-r from-green-600 to-red-600' 
      : isDoctor 
          ? 'bg-blue-600' 
          : 'bg-gradient-to-br from-armin-primary to-purple-800';

  const botBubbleStyle = isDoctor
      ? 'bg-white border-blue-200 text-slate-900 shadow-md'
      : 'bg-white/10 backdrop-blur-md border border-white/10';

  return (
    <div className={`flex flex-col h-full ${persona.bgColor} ${persona.textColor} transition-colors duration-500`}>
      <div className={`h-1 w-full bg-gradient-to-r ${persona.themeColor}`}></div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-50 animate-fade-in">
                <div className="text-7xl mb-4 grayscale hover:grayscale-0 transition-all duration-700 transform hover:scale-110">{persona.icon}</div>
                <h2 className="text-3xl font-bold mb-2 text-center">{persona.name}</h2>
                <p className="text-center max-w-md text-sm leading-relaxed">{persona.description}</p>
                {settings.enableSearch && <span className="text-xs bg-armin-secondary/20 text-armin-secondary px-2 py-1 rounded-full mt-2">🔍 جستجوی گوگل فعال است</span>}
            </div>
        )}
        
        {messages.map((msg, index) => (
          <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-down`}>
            <div className={`relative max-w-[90%] sm:max-w-[80%] p-4 rounded-2xl shadow-lg group transition-all duration-300
              ${msg.role === 'user' 
                ? `${userBubbleStyle} text-white rounded-tr-none shadow-lg` 
                : `${botBubbleStyle} rounded-tl-none` }
              ${msg.isError ? 'border border-red-500/50 bg-red-900/20' : ''}
            `}>
              
              {msg.role === 'model' && (
                  <div className="text-[10px] opacity-50 mb-2 flex justify-between items-center border-b border-white/10 pb-1">
                      <span className="font-bold tracking-wider uppercase">{persona.name}</span>
                      {msg.isStreaming && <span className="animate-pulse flex items-center gap-1 text-armin-secondary"><span>●</span> در حال نوشتن</span>}
                  </div>
              )}

              {/* Display Attachments */}
              {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                      {msg.attachments.map((att, i) => (
                          <div key={i} className="relative rounded-lg overflow-hidden border border-white/20">
                              {att.type === 'image' ? (
                                  <img src={`data:${att.mimeType};base64,${att.data}`} className="h-20 w-auto object-cover" />
                              ) : (
                                  <div className="h-20 w-20 bg-white/10 flex flex-col items-center justify-center p-1 text-center">
                                      <span className="text-2xl">📄</span>
                                      <span className="text-[8px] truncate w-full">{att.name}</span>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              )}

              <ParsedText 
                text={msg.content} 
                onImageDetected={(prompt) => generateImageForMessage(msg.id, prompt)} 
                imageError={msg.imageError}
              />

              {/* Generated Images (Fade-in) */}
              {msg.images && msg.images.map((img, i) => (
                  <div key={i} className="mt-4 rounded-xl overflow-hidden shadow-2xl border border-white/20 animate-fade-in group/img relative">
                      <img src={img} alt="Generated Content" className="w-full h-auto" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                          <a href={img} download="armin-image.png" className="bg-white/20 backdrop-blur text-white px-4 py-2 rounded-full hover:bg-white/40">دانلود تصویر اصلی</a>
                      </div>
                  </div>
              ))}

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/10 text-xs bg-black/10 -mx-4 -mb-4 px-4 py-3 rounded-b-2xl">
                      <p className="opacity-70 mb-2 font-bold flex items-center gap-2">
                          🌍 منابع اطلاعات (تأیید شده):
                      </p>
                      <div className="flex flex-wrap gap-2">
                          {msg.sources.map((s, i) => (
                              <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg truncate max-w-[220px] transition-colors flex items-center gap-2 border border-white/5 shadow-sm hover:shadow-md">
                                  <span>🔗</span>
                                  <span className="truncate">{s.title || s.uri}</span>
                              </a>
                          ))}
                      </div>
                  </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 mt-4 pt-2 border-t border-white/5 opacity-80 hover:opacity-100 transition-opacity">
                {msg.role === 'model' && !msg.isStreaming && !loading && !msg.isError && (
                    <>
                        <button onClick={() => handleDownloadFile(msg.content, 'txt')} className="text-xs bg-black/20 hover:bg-black/40 px-3 py-1 rounded-full flex items-center gap-1 transition-all border border-white/10">
                            📥 فایل متنی
                        </button>
                         <button onClick={() => handleShowSteps(index)} className="text-xs bg-armin-secondary/10 hover:bg-armin-secondary/30 text-armin-secondary px-3 py-1 rounded-full border border-armin-secondary/30 flex items-center gap-1 transition-all">
                            👣 نمایش مراحل
                        </button>
                    </>
                )}
                 {msg.isError && (
                    <div className="text-xs text-red-300 italic flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        خطا در پردازش درخواست
                    </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Supernatural Thinking State */}
        {thinking && (
            <div className="flex justify-start animate-fade-in">
                 <div className={`${botBubbleStyle} p-4 rounded-2xl rounded-tl-none relative overflow-hidden`}>
                     <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full border-2 border-armin-secondary border-t-transparent animate-spin"></div>
                         <div className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-armin-secondary to-purple-400 animate-pulse">
                             در حال ارتباط با ابعاد بالاتر دانش...
                         </div>
                     </div>
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse-slow"></div>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={`p-4 backdrop-blur-lg border-t ${isDoctor ? 'bg-slate-100/90 border-slate-200' : 'bg-black/20 border-white/10'}`}>
        {/* Attachment Previews */}
        {attachments.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2 scrollbar-none">
                {attachments.map((att, i) => (
                    <div key={i} className="relative group flex-shrink-0 animate-scale-in">
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/30 bg-black/50 flex items-center justify-center">
                            {att.type === 'image' ? (
                                <img src={`data:${att.mimeType};base64,${att.data}`} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xl">📄</span>
                            )}
                        </div>
                        <button onClick={() => removeAttachment(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md transform hover:scale-110 transition-transform">×</button>
                    </div>
                ))}
            </div>
        )}

        <div className="relative flex items-end gap-2 max-w-4xl mx-auto">
          {/* File Upload Button */}
          <input 
              type="file" 
              multiple 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileSelect}
              accept="image/*,.pdf,.txt,.docx,.csv" 
          />
          <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-colors mb-1"
              title="آپلود فایل یا عکس"
          >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
          </button>

          {/* Voice Input Button */}
          <button 
              onClick={handleMicClick}
              className={`p-3 rounded-xl transition-all mb-1 ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-red-500/50 shadow-lg' : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'}`}
              title="صحبت کنید"
          >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
                if(e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            }}
            placeholder={isDoctor ? "مشکل پزشکی خود را بگویید..." : "پیام، عکس یا فایل خود را بفرستید..."}
            className={`w-full rounded-2xl p-4 focus:outline-none resize-none h-16 max-h-32 scrollbar-thin transition-all shadow-inner
                ${isDoctor 
                    ? 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500' 
                    : 'bg-white/5 border border-white/20 text-white placeholder-white/40 focus:border-white/40 focus:bg-white/10'}`}
          />
          <button 
                onClick={() => handleSend()}
                disabled={(!input.trim() && attachments.length === 0) || loading}
                className={`p-4 rounded-xl transition-all flex-shrink-0 mb-1 ${input.trim() || attachments.length > 0 ? 'bg-gradient-to-br from-armin-primary to-purple-700 text-white shadow-lg hover:scale-105 hover:shadow-purple-500/30' : 'bg-white/5 text-white/20'}`}
          >
             {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 transform rotate-180">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                 </svg>
             )}
          </button>
        </div>
        {/* Stop Button Centered */}
        {streaming && (
            <div className="absolute top-0 left-0 right-0 flex justify-center -mt-6">
                 <button onClick={handleStop} className="bg-red-500/80 hover:bg-red-600 backdrop-blur text-white text-xs px-4 py-1.5 rounded-full shadow-lg border border-red-400/30 animate-bounce-in flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path d="M5.25 3A2.25 2.25 0 003 5.25v9.5A2.25 2.25 0 005.25 17h9.5A2.25 2.25 0 0017 14.75v-9.5A2.25 2.25 0 0014.75 3h-9.5z" />
                    </svg>
                    توقف
                 </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;