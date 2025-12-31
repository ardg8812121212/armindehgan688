import React from 'react';
import { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<Props> = ({ settings, setSettings, isOpen, onClose }) => {
    
  const handleChange = (key: keyof AppSettings, value: any) => {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      localStorage.setItem('armin_settings', JSON.stringify(newSettings));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>⚙️</span> تنظیمات هوش مصنوعی
            </h3>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors text-2xl">×</button>
        </div>

        <div className="space-y-6">
            {/* API Key Input */}
            <div className="bg-armin-primary/10 border border-armin-primary/30 p-4 rounded-xl">
                <label className="block text-sm font-bold text-armin-secondary mb-2">کلید API گوگل (Gemini)</label>
                <input 
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => handleChange('apiKey', e.target.value)}
                    placeholder="کلید API خود را اینجا وارد کنید..."
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-armin-secondary focus:outline-none font-mono"
                />
                <p className="text-[10px] text-white/50 mt-2 leading-relaxed">
                    برای استفاده رایگان، کلید را از <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 underline hover:text-blue-300">Google AI Studio</a> دریافت کنید.
                    این کلید فقط در مرورگر شما ذخیره می‌شود.
                </p>
            </div>

            <div>
                <label className="block text-sm text-white/70 mb-2">مدل (Model)</label>
                <select 
                    value={settings.model}
                    onChange={(e) => handleChange('model', e.target.value)}
                    className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white text-sm focus:border-white/40 focus:outline-none"
                >
                    <option value="gemini-3-flash-preview">Gemini 3 Flash (پیشنهادی)</option>
                    <option value="gemini-3-pro-preview">Gemini 3 Pro (پیشرفته)</option>
                    <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
                </select>
            </div>

            <div>
                <label className="block text-sm text-white/70 mb-2">خلاقیت: {settings.temperature}</label>
                <div className="flex items-center gap-4">
                    <input 
                        type="range" 
                        min="0" 
                        max="2" 
                        step="0.1"
                        value={settings.temperature}
                        onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                        className="flex-1 accent-armin-primary h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="w-10 text-center text-sm font-mono text-white/80">{settings.temperature}</span>
                </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                <span className="text-sm text-white/90">استفاده از جستجوی گوگل</span>
                <input 
                    type="checkbox"
                    checked={settings.enableSearch}
                    onChange={(e) => handleChange('enableSearch', e.target.checked)}
                    className="w-5 h-5 accent-armin-secondary cursor-pointer"
                />
            </div>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 text-center text-xs text-white/30">
            Armin AI v2.2.0 | ذخیره خودکار تغییرات
        </div>
      </div>
    </div>
  );
};

export default Settings;