import React, { useState } from 'react';
import { generateImageContent, analyzeImage } from '../services/geminiService';
import { AppSettings } from '../types';

interface Props {
    onError: (msg: string) => void;
}

const ImageGenerator: React.FC<Props> = ({ onError }) => {
    const [mode, setMode] = useState<'generate' | 'analyze'>('generate');
    const [prompt, setPrompt] = useState('');
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [analysisFile, setAnalysisFile] = useState<File | null>(null);
    const [analysisResult, setAnalysisResult] = useState('');
    
    // We need to access settings to get the API Key, but ImageGenerator props didn't have it in previous turn. 
    // Ideally App.tsx should pass settings here. I will assume it is passed or I'll retrieve from localStorage as fallback if props aren't updated.
    // However, to keep it clean, I will assume the parent passes it? No, App.tsx in user dump doesn't pass settings to ImageGenerator.
    // I will read from localStorage directly here for the API Key if needed, OR better, update App.tsx to pass settings.
    // Let's update App.tsx to pass settings to ImageGenerator.

    const getSettings = (): AppSettings => {
         const saved = localStorage.getItem('armin_settings');
         return saved ? JSON.parse(saved) : { model: 'gemini-3-flash-preview', temperature: 1, enableSearch: true, apiKey: '' };
    }

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        const settings = getSettings();
        if (!settings.apiKey && !process.env.API_KEY) { onError("کلید API یافت نشد."); return; }
        
        setLoading(true);
        setImageSrc(null);
        try {
            const result = await generateImageContent(prompt + " . photorealistic, 8k, cinematic, educational", settings);
            setImageSrc(result);
        } catch (err: any) { onError(err.message); } finally { setLoading(false); }
    };

    const handleAnalyze = async () => {
        if (!analysisFile) return;
        const settings = getSettings();
        if (!settings.apiKey && !process.env.API_KEY) { onError("کلید API یافت نشد."); return; }

        setLoading(true);
        setAnalysisResult('');
        try {
            const result = await analyzeImage(analysisFile, prompt || "توصیف تصویر", settings.model, settings);
            setAnalysisResult(result);
        } catch (err: any) { onError(err.message); } finally { setLoading(false); }
    };

    return (
        <div className="h-full flex flex-col p-6 items-center overflow-y-auto">
            <h2 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">🎨 استودیو تصویر</h2>
            <div className="flex bg-white/10 p-1 rounded-xl mb-8 w-full max-w-md">
                <button onClick={() => setMode('generate')} className={`flex-1 py-2 rounded-lg ${mode === 'generate' ? 'bg-orange-500' : 'text-white/50'}`}>تولید</button>
                <button onClick={() => setMode('analyze')} className={`flex-1 py-2 rounded-lg ${mode === 'analyze' ? 'bg-blue-500' : 'text-white/50'}`}>تحلیل</button>
            </div>
            <div className="w-full max-w-2xl space-y-4 animate-fade-in">
                {mode === 'generate' ? (
                    <>
                        <div className="flex gap-2">
                            <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="توصیف..." className="flex-1 bg-white/10 border border-white/20 rounded-xl p-4 text-white" />
                            <button onClick={handleGenerate} disabled={loading} className="px-6 bg-orange-500 rounded-xl font-bold shadow-lg disabled:opacity-50">{loading ? '...' : 'بساز'}</button>
                        </div>
                        <div className="aspect-video bg-black/40 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden relative min-h-[300px]">
                            {imageSrc ? <img src={imageSrc} className="w-full h-full object-contain animate-fade-in" /> : <div className="text-white/20">منتظر دستور...</div>}
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="border-2 border-dashed border-blue-500/30 rounded-xl p-8 text-center hover:border-blue-500 bg-blue-500/5">
                            <input type="file" onChange={(e) => setAnalysisFile(e.target.files?.[0] || null)} accept="image/*" className="hidden" id="image-upload" />
                            <label htmlFor="image-upload" className="cursor-pointer block text-blue-200">{analysisFile ? analysisFile.name : 'انتخاب تصویر'}</label>
                        </div>
                        <button onClick={handleAnalyze} disabled={loading || !analysisFile} className="w-full py-3 bg-blue-500 rounded-xl font-bold shadow-lg">{loading ? '...' : 'تحلیل'}</button>
                        {analysisResult && <div className="bg-slate-900/80 rounded-xl p-6 border border-blue-500/20 whitespace-pre-wrap">{analysisResult}</div>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageGenerator;