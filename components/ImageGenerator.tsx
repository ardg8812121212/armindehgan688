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
    
    // Analysis states
    const [analysisFile, setAnalysisFile] = useState<File | null>(null);
    const [analysisResult, setAnalysisResult] = useState('');

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setImageSrc(null);
        try {
            // User requested "No bananas", "Real", "Supernatural/Educational"
            const finalPrompt = `${prompt} . Style: Photorealistic, 8k, Cinematic, Educational, Highly Detailed, No distortion.`;
            const result = await generateImageContent(finalPrompt);
            setImageSrc(result);
        } catch (err: any) {
            onError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyze = async () => {
        if (!analysisFile) return;
        setLoading(true);
        setAnalysisResult('');
        try {
            const promptText = prompt || "لطفا این تصویر را با جزئیات توصیف کن و نکات آموزشی یا کلیدی آن را بگو.";
            const result = await analyzeImage(analysisFile, promptText, 'gemini-3-flash-preview');
            setAnalysisResult(result);
        } catch (err: any) {
            onError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 items-center overflow-y-auto">
            <h2 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                🎨 استودیو تصویر
            </h2>
            <p className="text-white/60 mb-6">تولید تصاویر خلاقانه یا تحلیل تصاویر آموزشی</p>

            {/* Mode Switcher */}
            <div className="flex bg-white/10 p-1 rounded-xl mb-8 w-full max-w-md">
                <button 
                    onClick={() => setMode('generate')}
                    className={`flex-1 py-2 px-4 rounded-lg transition-all text-sm font-bold ${mode === 'generate' ? 'bg-orange-500 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}
                >
                    ✨ تولید تصویر
                </button>
                <button 
                    onClick={() => setMode('analyze')}
                    className={`flex-1 py-2 px-4 rounded-lg transition-all text-sm font-bold ${mode === 'analyze' ? 'bg-blue-500 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}
                >
                    🔍 تحلیل تصویر
                </button>
            </div>

            <div className="w-full max-w-2xl space-y-4 animate-fade-in">
                {mode === 'generate' ? (
                    <>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="توصیف تصویر (مثلاً: ساختار اتم...)"
                                className="flex-1 bg-white/10 border border-white/20 rounded-xl p-4 focus:outline-none focus:border-orange-500 text-white placeholder-white/40"
                            />
                            <button
                                onClick={handleGenerate}
                                disabled={loading || !prompt.trim()}
                                className="px-6 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
                            >
                                {loading ? '...' : 'بساز'}
                            </button>
                        </div>

                        <div className="aspect-video bg-black/40 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden relative min-h-[300px]">
                            {loading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                    <p className="text-orange-500 animate-pulse">در حال نقاشی...</p>
                                </div>
                            )}
                            
                            {imageSrc ? (
                                <img src={imageSrc} alt="Generated" className="w-full h-full object-contain animate-fade-in" />
                            ) : (
                                <div className="text-center text-white/20">
                                    <span className="text-6xl block mb-2">🖼️</span>
                                    <p>توصیف کنید تا بسازم</p>
                                </div>
                            )}
                        </div>
                         {imageSrc && (
                            <a 
                                href={imageSrc} 
                                download={`armin-ai-gen-${Date.now()}.png`}
                                className="block text-center text-sm text-orange-400 hover:text-orange-300 underline"
                            >
                                دانلود تصویر اصلی
                            </a>
                        )}
                    </>
                ) : (
                    /* Analysis Mode */
                    <div className="space-y-4">
                        <div className="border-2 border-dashed border-blue-500/30 rounded-xl p-8 text-center hover:border-blue-500 transition-colors bg-blue-500/5">
                            <input 
                                type="file" 
                                onChange={(e) => setAnalysisFile(e.target.files?.[0] || null)} 
                                accept="image/*"
                                className="hidden" 
                                id="image-upload"
                            />
                            <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                <span className="text-4xl">📸</span>
                                <span className="text-lg font-medium text-blue-200">
                                    {analysisFile ? analysisFile.name : 'انتخاب تصویر برای تحلیل'}
                                </span>
                                <span className="text-xs text-blue-200/50">برای آپلود کلیک کنید</span>
                            </label>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="چه سوالی درباره این تصویر دارید؟ (اختیاری)"
                                className="flex-1 bg-white/10 border border-white/20 rounded-xl p-4 focus:outline-none focus:border-blue-500 text-white placeholder-white/40"
                            />
                            <button
                                onClick={handleAnalyze}
                                disabled={loading || !analysisFile}
                                className="px-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
                            >
                                {loading ? '...' : 'تحلیل'}
                            </button>
                        </div>

                        {loading && (
                             <div className="p-4 text-center text-blue-300 animate-pulse">
                                 در حال بررسی دقیق تصویر...
                             </div>
                        )}

                        {analysisResult && (
                            <div className="bg-slate-900/80 rounded-xl p-6 border border-blue-500/20 prose prose-invert max-w-none animate-slide-down">
                                <h3 className="text-blue-400 font-bold mb-2">نتایج تحلیل:</h3>
                                <div className="whitespace-pre-wrap leading-relaxed text-sm">
                                    {analysisResult}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageGenerator;