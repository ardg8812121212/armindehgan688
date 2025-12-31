import React, { useState } from 'react';
import { analyzeFile } from '../services/geminiService';
import { AppSettings, Persona } from '../types';

interface Props {
    persona: Persona;
    settings: AppSettings;
    onError: (msg: string) => void;
}

const FileAnalyzer: React.FC<Props> = ({ persona, settings, onError }) => {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [prompt, setPrompt] = useState('');
    const [analysis, setAnalysis] = useState('');
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFiles(Array.from(e.target.files));
            setAnalysis('');
        }
    };

    const handleAnalyze = async () => {
        if (!settings.apiKey && !process.env.API_KEY) {
            onError("کلید API یافت نشد. به تنظیمات بروید.");
            return;
        }
        if (selectedFiles.length === 0) return;
        setLoading(true);
        try {
            const finalPrompt = prompt || `لطفا این ${selectedFiles.length} فایل را تحلیل کن.`;
            const result = await analyzeFile(selectedFiles, finalPrompt, settings.model, persona.systemPrompt, settings);
            setAnalysis(result);
        } catch (err: any) {
            onError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-armin-secondary">📂 تحلیلگر فایل</h2>
            <div className="grid md:grid-cols-2 gap-8 h-full">
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-armin-secondary/50 bg-white/5 relative">
                        <input type="file" onChange={handleFileChange} accept=".pdf,.txt,.csv,.json,.js,.py,.docx" className="hidden" id="file-upload" multiple />
                        <label htmlFor="file-upload" className="cursor-pointer block">
                            <span className="text-4xl block mb-2">📥</span>
                            <span className="text-lg">انتخاب فایل‌ها</span>
                        </label>
                    </div>
                    {selectedFiles.length > 0 && <div className="bg-white/5 p-3 rounded-xl">{selectedFiles.map((f,i) => <div key={i} className="text-sm text-white/70">{f.name}</div>)}</div>}
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="سوال..." className="w-full bg-black/20 border border-white/10 rounded-xl p-3 h-32 focus:border-armin-secondary text-white" />
                    <button onClick={handleAnalyze} disabled={selectedFiles.length === 0 || loading} className="w-full py-3 bg-armin-primary rounded-xl font-bold shadow-lg disabled:opacity-50">
                        {loading ? '...' : 'شروع تحلیل'}
                    </button>
                </div>
                <div className="bg-black/30 rounded-xl p-6 border border-white/5 overflow-y-auto max-h-[600px] prose prose-invert">
                    {analysis ? <div className="whitespace-pre-wrap">{analysis}</div> : <div className="text-center text-white/30 pt-20">نتیجه اینجا نمایش داده می‌شود</div>}
                </div>
            </div>
        </div>
    );
};

export default FileAnalyzer;