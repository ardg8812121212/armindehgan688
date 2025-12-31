import React, { useEffect } from 'react';
import { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<Props> = ({ settings, setSettings, isOpen, onClose }) => {
    
  // Load from local storage on mount handled in App.tsx generally, but we save on change here
  const handleChange = (key: keyof AppSettings, value: any) => {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      localStorage.setItem('armin_settings', JSON.stringify(newSettings));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">⚙️ تنظیمات هوش مصنوعی</h3>
            <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
        </div>

        <div className="space-y-6">
            <div>
                <label className="block text-sm text-white/70 mb-2">مدل (Model)</label>
                <select 
                    value={settings.model}
                    onChange={(e) => handleChange('model', e.target.value)}
                    className="w-full bg-black/30 border border-white/20 rounded-lg p-2 text-white text-sm"
                >
                    <option value="gemini-3-flash-preview">Gemini 3 Flash (سریع و هوشمند)</option>
                    <option value="gemini-3-pro-preview">Gemini 3 Pro (پیشرفته)</option>
                    <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp (جایگزین)</option>
                </select>
                <p className="text-[10px] text-white/30 mt-1">
                    نکته: اگر با خطای 404 مواجه شدید، لطفا مدل را تغییر دهید.
                </p>
            </div>

            <div>
                <label className="block text-sm text-white/70 mb-2">دما / خلاقیت (Temperature): {settings.temperature}</label>
                <div className="flex items-center gap-4">
                    <input 
                        type="range" 
                        min="0" 
                        max="2" 
                        step="0.1"
                        value={settings.temperature}
                        onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                        className="flex-1 accent-armin-primary"
                    />
                    <input 
                        type="number" 
                        min="0" 
                        max="2" 
                        step="0.1"
                        value={settings.temperature}
                        onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                        className="w-16 bg-black/30 border border-white/20 rounded-lg p-1 text-center text-white text-sm"
                    />
                </div>
                <div className="flex justify-between text-xs text-white/30 mt-1">
                    <span>دقیق (0)</span>
                    <span>متعادل (1.0)</span>
                    <span>خلاق (2.0)</span>
                </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-sm text-white">استفاده از جستجوی گوگل</span>
                <input 
                    type="checkbox"
                    checked={settings.enableSearch}
                    onChange={(e) => handleChange('enableSearch', e.target.checked)}
                    className="w-5 h-5 accent-armin-secondary"
                />
            </div>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 text-center text-xs text-white/30">
            Armin AI v2.0.0 | Designed by Armin Dehghan
        </div>
      </div>
    </div>
  );
};

export default Settings;