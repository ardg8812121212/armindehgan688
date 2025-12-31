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

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch(ext) {
            case 'pdf': return '📕';
            case 'doc': case 'docx': return '📘';
            case 'xls': case 'xlsx': case 'csv': return '📗';
            case 'ppt': case 'pptx': return '📙';
            case 'jpg': case 'png': return '🖼️';
            case 'js': case 'py': case 'html': case 'css': return '💻';
            case 'zip': case 'rar': return '🗄️';
            default: return '📄';
        }
    };

    const handleAnalyze = async () => {
        if (selectedFiles.length === 0) return;
        setLoading(true);
        try {
            const finalPrompt = prompt || `لطفا این ${selectedFiles.length} فایل را تحلیل و بررسی کن.`;
            const result = await analyzeFile(
                selectedFiles, 
                finalPrompt, 
                settings.model,
                persona.systemPrompt
            );
            setAnalysis(result);
        } catch (err: any) {
            onError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-armin-secondary flex items-center gap-2">
                📂 تحلیلگر هوشمند فایل (چندگانه)
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8 h-full">
                {/* Upload Section */}
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-armin-secondary/50 transition-colors bg-white/5 relative group">
                        <input 
                            type="file" 
                            onChange={handleFileChange} 
                            accept=".pdf,.txt,.csv,.json,.md,.html,.xml,.js,.py,.docx,.pptx"
                            className="hidden" 
                            id="file-upload"
                            multiple // Enable multiple files
                        />
                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2 w-full h-full">
                            <span className="text-4xl group-hover:scale-110 transition-transform">📥</span>
                            <span className="text-lg font-medium">
                                انتخاب فایل‌ها (چندتایی)
                            </span>
                            <span className="text-xs text-white/50">PDF, Word, Code, CSV...</span>
                        </label>
                    </div>

                    {/* File List */}
                    {selectedFiles.length > 0 && (
                        <div className="bg-black/20 rounded-xl p-3 max-h-32 overflow-y-auto border border-white/5 space-y-2">
                            {selectedFiles.map((f, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm text-white/80 bg-white/5 p-2 rounded animate-fade-in">
                                    <span className="text-xl">{getFileIcon(f.name)}</span>
                                    <span className="truncate flex-1">{f.name}</span>
                                    <span className="text-xs opacity-50">{(f.size/1024).toFixed(1)} KB</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="سوال خود را درباره فایل(ها) بپرسید..."
                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 h-32 focus:outline-none focus:border-armin-secondary text-white"
                    />

                    <button
                        onClick={handleAnalyze}
                        disabled={selectedFiles.length === 0 || loading}
                        className="w-full py-3 bg-armin-primary hover:bg-purple-700 disabled:opacity-50 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '🔍 شروع تحلیل'}
                    </button>
                </div>

                {/* Result Section */}
                <div className="bg-black/30 rounded-xl p-6 border border-white/5 overflow-y-auto max-h-[600px] prose prose-invert">
                    {analysis ? (
                        <div className="whitespace-pre-wrap leading-relaxed animate-slide-down">
                            {analysis}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-white/30 gap-4">
                            <div className="text-6xl opacity-20">📊</div>
                            <p>نتیجه تحلیل در اینجا نمایش داده می‌شود...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileAnalyzer;