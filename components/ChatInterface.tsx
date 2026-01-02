import React, { useState, useRef, useEffect } from 'react';
import { Message, AppSettings, Persona, Attachment } from '../types';
import { generateContentStream, getStepByStep, generateImageContent } from '../services/geminiService';
import { API_KEY_ENV } from '../constants';

declare global {
  interface Window {
    MathJax: any;
    webkitSpeechRecognition: any;
  }
}

const CodeBlock: React.FC<{ code: string; language?: string; onExplain?: (code: string) => void }> = ({ code, language, onExplain }) => {
    const lines = code.split('\n');
    return (
        <div className="relative my-4 rounded-lg overflow-hidden border border-white/10 bg-[#1e1e1e] shadow-2xl font-mono text-sm group" dir="ltr">
            <div className="flex justify-between items-center px-4 py-2 bg-[#2d2d2d] border-b border-white/5">
                <span className="text-xs text-white/50 lowercase">{language || 'code'}</span>
                <div className="flex gap-2">
                    {onExplain && (
                        <button onClick={() => onExplain(code)} className="text-xs bg-armin-primary/20 hover:bg-armin-primary/40 text-armin-primary px-2 py-1 rounded transition-colors flex items-center gap-1">
                            <span>💡</span> توضیح کد
                        </button>
                    )}
                    <button onClick={() => navigator.clipboard.writeText(code)} className="text-xs text-white/40 hover:text-white transition-colors">Copy</button>
                </div>
            </div>
            <div className="flex overflow-x-auto p-4">
                <div className="flex flex-col text-right pr-4 text-white/20 select-none border-r border-white/5 mr-4">
                    {lines.map((_, i) => <span key={i} className="leading-6">{i + 1}</span>)}
                </div>
                <pre className="flex-1 leading-6">
                    <code className="language-javascript text-gray-300">
                        {lines.map((line, i) => (
                            <div key={i} className="whitespace-pre">
                                {line.split(/(\s+)/).map((token, j) => {
                                    if (token.match(/^(const|let|var|function|return|import|export|from|if|else|for|while|class|interface)$/)) return <span key={j} className="text-purple-400 font-bold">{token}</span>;
                                    if (token.match(/^('.*'|".*"|`.*`)$/)) return <span key={j} className="text-green-400">{token}</span>;
                                    if (token.match(/^\d+$/)) return <span key={j} className="text-orange-400">{token}</span>;
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

const ParsedText: React.FC<{ text: string, onImageDetected?: (prompt: string) => void, imageError?: boolean, onExplainCode?: (code: string) => void }> = ({ text, onImageDetected, imageError, onExplainCode }) => {
    const parts = text.split(/(```[\s\S]*?```|<<GENERATE_IMAGE:.*?>>)/g);
    
    useEffect(() => {
        const imgMatch = text.match(/<<GENERATE_IMAGE:(.*?)>>/);
        if (imgMatch && onImageDetected) onImageDetected(imgMatch[1].trim());
        
        // Render MathJax
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise().catch((err: any) => console.log('MathJax error:', err));
        }
    }, [text]);

    return (
        <div className="prose prose-invert max-w-none text-sm leading-relaxed text-right tex2jax_process">
            {parts.map((part, i) => {
                if (part.startsWith('```')) {
                    const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
                    return <CodeBlock key={i} code={match ? match[2] : part.replace(/```/g, '')} language={match ? match[1] : ''} onExplain={onExplainCode} />;
                }
                if (part.startsWith('<<GENERATE_IMAGE:')) {
                    if (imageError) return <div key={i} className="text-xs text-red-400 italic bg-red-500/10 p-2 rounded">⚠️ خطا در تولید تصویر</div>;
                    return <div key={i} className="text-xs text-armin-secondary italic animate-pulse">🖼️ در حال آماده‌سازی بوم نقاشی...</div>;
                }
                // Handle paragraphs but preserve LaTeX
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

  useEffect(() => scrollToBottom(), [messages, streaming, thinking, attachments]);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleMicClick = () => {
      if (!('webkitSpeechRecognition' in window)) return onError("مرورگر پشتیبانی نمی‌شود.");
      if (isRecording) return;
      const recognition = new window.webkitSpeechRecognition();
      recognition.lang = 'fa-IR';
      recognition.continuous = false;
      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => { setIsRecording(false); onError("خطا در میکروفون"); };
      recognition.onresult = (e: any) => setInput(prev => prev + ' ' + e.results[0][0].transcript);
      try { recognition.start(); } catch(e) { onError("خطا در شروع ضبط"); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const newAttachments: Attachment[] = [];
          for (let i = 0; i < e.target.files.length; i++) {
              const file = e.target.files[i];
              if (file.size > 5 * 1024 * 1024) { onError(`فایل ${file.name} حجیم است.`); continue; }
              try {
                  const base64 = await new Promise<string>((resolve) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve((reader.result as string).split(',')[1]);
                      reader.readAsDataURL(file);
                  });
                  newAttachments.push({ type: file.type.startsWith('image/') ? 'image' : 'file', mimeType: file.type, data: base64, name: file.name });
              } catch { onError("خطا در خواندن فایل"); }
          }
          setAttachments(prev => [...prev, ...newAttachments]);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const generateImageForMessage = async (msgId: string, prompt: string) => {
      const msg = messages.find(m => m.id === msgId);
      if (msg && (msg.images || msg.imageError)) return; 
      try {
          const base64 = await generateImageContent(prompt + " . photorealistic, 8k, educational", settings);
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, images: [base64] } : m));
      } catch (e: any) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, imageError: true } : m));
          if (!e.message.includes('Quota')) onError(e.message);
      }
  };

  const handleSend = async (text: string = input, isEdit: boolean = false) => {
    if ((!text.trim() && attachments.length === 0) || loading) return;
    if (!settings.apiKey && !API_KEY_ENV) {
        onError("کلید API تنظیم نشده است. لطفاً به تنظیمات بروید.");
        return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now(), attachments: attachments.length ? [...attachments] : undefined };
    setMessages(isEdit ? [...messages.slice(0, -2), userMsg] : [...messages, userMsg]);
    setInput('');
    setAttachments([]);
    setLoading(true);
    setThinking(true);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    setThinking(false);
    setStreaming(true);

    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: botMsgId, role: 'model', content: '', timestamp: Date.now(), isStreaming: true }]);

    try {
      let accumalatedText = '';
      const result = await generateContentStream(settings.model, isEdit ? [...messages.slice(0, -2), userMsg] : [...messages, userMsg], persona.systemPrompt, settings, (chunk) => {
          accumalatedText += chunk;
          setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: accumalatedText } : m));
        }, controller.signal);
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: result.text, sources: result.sources.length ? result.sources : undefined, isStreaming: false } : m));
    } catch (err: any) {
       if (err.name !== 'AbortError') {
           onError(err.message);
           setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isError: true, content: err.message, isStreaming: false } : m));
       }
    } finally {
      setLoading(false);
      setStreaming(false);
      setAbortController(null);
    }
  };

  const handleStop = () => { if (abortController) { abortController.abort(); setStreaming(false); setLoading(false); setThinking(false); } };
  
  const handleShowSteps = async (msgIndex: number) => {
    const targetMsg = messages[msgIndex];
    if (targetMsg.role !== 'model') return;
    setLoading(true);
    try {
        const steps = await getStepByStep(messages[msgIndex - 1]?.content, targetMsg.content, settings.model, settings);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `🔍 **تحلیل گام‌به‌گام:**\n\n${steps}`, timestamp: Date.now() }]);
    } catch (err: any) { onError(err.message); } finally { setLoading(false); }
  };

  const handleExplainCode = (code: string) => {
      const prompt = `لطفاً این کد را به صورت کامل و دقیق توضیح بده:\n\n\`\`\`\n${code}\n\`\`\`\n\nتوضیحات باید شامل منطق، ساختار و نحوه عملکرد باشد.`;
      handleSend(prompt);
  };

  return (
    <div className={`flex flex-col h-full ${persona.bgColor} ${persona.textColor}`}>
      <div className={`h-1 w-full bg-gradient-to-r ${persona.themeColor}`}></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-50 animate-fade-in text-center">
                <div className="text-7xl mb-4 grayscale hover:grayscale-0 transition-all transform hover:scale-110">{persona.icon}</div>
                <h2 className="text-3xl font-bold mb-2">{persona.name}</h2>
                <p className="max-w-md text-sm">{persona.description}</p>
            </div>
        )}
        {messages.map((msg, index) => (
          <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-down`}>
            <div className={`relative max-w-[90%] sm:max-w-[80%] p-4 rounded-2xl shadow-lg ${msg.role === 'user' ? 'bg-white/10 text-white rounded-tr-none' : 'bg-black/40 backdrop-blur rounded-tl-none border border-white/10'} ${msg.isError ? 'border-red-500/50 bg-red-900/20' : ''}`}>
               {/* Attachments */}
               {msg.attachments && <div className="flex gap-2 mb-3">{msg.attachments.map((att, i) => <div key={i} className="h-16 w-16 bg-white/10 rounded flex items-center justify-center overflow-hidden">{att.type === 'image' ? <img src={`data:${att.mimeType};base64,${att.data}`} className="h-full w-full object-cover"/> : <span>📄</span>}</div>)}</div>}
               
               <ParsedText 
                    text={msg.content} 
                    onImageDetected={(p) => generateImageForMessage(msg.id, p)} 
                    imageError={msg.imageError} 
                    onExplainCode={persona.id === 'engineer' || persona.id === 'armin-core' ? handleExplainCode : undefined}
               />
               
               {msg.images && msg.images.map((img, i) => <img key={i} src={img} className="mt-4 rounded-xl border border-white/20 w-full" />)}
               {msg.sources && <div className="mt-4 pt-2 border-t border-white/10 text-xs opacity-70">📚 منابع: {msg.sources.map(s => s.title).join(', ')}</div>}
               {msg.role === 'model' && !msg.isStreaming && !loading && !msg.isError && (
                   <div className="flex gap-2 mt-4 pt-2 border-t border-white/5">
                        <button onClick={() => handleShowSteps(index)} className="text-xs bg-armin-secondary/10 text-armin-secondary px-3 py-1 rounded-full">👣 گام‌به‌گام</button>
                   </div>
               )}
            </div>
          </div>
        ))}
        {thinking && <div className="animate-pulse text-armin-secondary text-sm p-4">🔮 در حال تفکر عمیق...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 backdrop-blur-lg bg-black/20 border-t border-white/10">
         {attachments.length > 0 && <div className="flex gap-2 mb-2">{attachments.map((att, i) => <div key={i} className="text-xs bg-white/20 px-2 py-1 rounded">{att.name}</div>)}</div>}
         <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.txt,.csv,.json" />
            <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/70">📎</button>
            <button onClick={handleMicClick} className={`p-3 rounded-xl ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-white/5 text-white/70'}`}>🎤</button>
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} placeholder="پیام..." className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 text-white h-16 resize-none focus:outline-none focus:border-white/40"/>
            <button onClick={() => handleSend()} disabled={loading} className="p-4 bg-armin-primary rounded-xl text-white disabled:opacity-50">🚀</button>
         </div>
         {streaming && <button onClick={handleStop} className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-xs px-4 py-1 rounded-full">توقف</button>}
      </div>
    </div>
  );
};

export default ChatInterface;