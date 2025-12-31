import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ChatInterface from './components/ChatInterface';
import FileAnalyzer from './components/FileAnalyzer';
import ImageGenerator from './components/ImageGenerator';
import Settings from './components/Settings';
import Notification from './components/Notification';
import { Persona, AppSettings, Notification as NotificationType } from './types';
import { PERSONAS, DEFAULT_MODEL } from './constants';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'file' | 'image'>('chat');
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS[0]);
  
  // Default enableSearch to true for "up-to-date" info requirement
  const [settings, setSettings] = useState<AppSettings>({
    model: DEFAULT_MODEL,
    temperature: 1.0, 
    enableSearch: true 
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState<NotificationType | null>(null);

  useEffect(() => {
      const savedSettings = localStorage.getItem('armin_settings');
      if (savedSettings) {
          try {
              const parsed = JSON.parse(savedSettings);
              // Validate temperature to prevent API 400 errors
              if (typeof parsed.temperature === 'number') {
                  if (parsed.temperature < 0) parsed.temperature = 0;
                  if (parsed.temperature > 2) parsed.temperature = 2;
              } else {
                  parsed.temperature = 1.0;
              }
              setSettings(parsed);
          } catch (e) {
              console.error("Failed to load settings");
          }
      }
  }, []);

  const handleError = (msg: string) => {
      setNotification({ id: Date.now().toString(), type: 'error', message: msg });
  };

  return (
    <div className="flex h-screen w-full bg-[#0f172a] overflow-hidden">
      <Notification notification={notification} onClose={() => setNotification(null)} />
      <Settings settings={settings} setSettings={setSettings} isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Sidebar (Desktop) / Topbar (Mobile) */}
      <aside className="w-16 md:w-64 flex-shrink-0 bg-slate-900 border-l border-white/5 flex flex-col items-center md:items-stretch py-4 z-20">
        <div className="px-4 mb-8 text-center md:text-right hidden md:block">
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-l from-armin-primary to-armin-secondary">
                Armin AI
            </h1>
            <p className="text-[10px] text-white/40 mt-1">نسل آینده آموزش هوشمند</p>
        </div>

        <nav className="flex-1 space-y-2 px-2 w-full">
            <button 
                onClick={() => setActiveTab('chat')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-white/10 text-white shadow-lg' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
                <span className="text-xl">💬</span>
                <span className="hidden md:inline text-sm font-medium">چت با آرمین</span>
            </button>
            <button 
                onClick={() => setActiveTab('file')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'file' ? 'bg-white/10 text-white shadow-lg' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
                <span className="text-xl">📁</span>
                <span className="hidden md:inline text-sm font-medium">تحلیل فایل</span>
            </button>
            <button 
                onClick={() => setActiveTab('image')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'image' ? 'bg-white/10 text-white shadow-lg' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
                <span className="text-xl">🎨</span>
                <span className="hidden md:inline text-sm font-medium">تصویرساز</span>
            </button>
        </nav>

        {/* Expert Mode Selector */}
        {activeTab === 'chat' && (
            <div className="px-2 mt-4 space-y-1 overflow-y-auto max-h-[40vh] border-t border-white/10 pt-4">
                <p className="text-xs text-white/30 px-2 mb-2 hidden md:block">دستیار متخصص</p>
                {PERSONAS.map(persona => (
                    <button
                        key={persona.id}
                        onClick={() => setActivePersona(persona)}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-right transition-all text-xs md:text-sm ${activePersona.id === persona.id ? 'bg-armin-primary text-white' : 'text-white/60 hover:bg-white/5'}`}
                    >
                        <span>{persona.icon}</span>
                        <span className="hidden md:inline truncate">{persona.name}</span>
                    </button>
                ))}
            </div>
        )}

        <div className="mt-auto px-2">
            <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-3 p-3 text-white/50 hover:text-white">
                <span className="text-xl">⚙️</span>
                <span className="hidden md:inline text-sm">تنظیمات</span>
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col h-full bg-[#0b0f19] bg-[url('https://picsum.photos/1920/1080?blur=10')] bg-cover bg-center bg-no-repeat bg-blend-overlay">
         {/* Overlay for readability */}
         <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-0"></div>
         
         <div className="relative z-10 h-full flex flex-col">
            {/* Header (Mobile) */}
            <div className="md:hidden p-4 border-b border-white/10 flex justify-between items-center bg-slate-900/50 backdrop-blur">
                <span className="font-bold text-white">{activePersona.name}</span>
                <span className="text-xs bg-armin-primary px-2 py-1 rounded text-white">Armin AI</span>
            </div>

            {/* Content Switcher */}
            {activeTab === 'chat' && (
                <ChatInterface 
                    key={activePersona.id} // Reset chat on persona change
                    persona={activePersona} 
                    settings={settings} 
                    onError={handleError} 
                />
            )}
            {activeTab === 'file' && (
                <FileAnalyzer 
                    persona={activePersona} 
                    settings={settings} 
                    onError={handleError}
                />
            )}
            {activeTab === 'image' && (
                <ImageGenerator onError={handleError} />
            )}
         </div>
      </main>
    </div>
  );
};

export default App;