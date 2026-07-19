import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Info, Database, Layers, CheckCircle2, Cpu, HelpCircle } from 'lucide-react';

export const About: React.FC = () => {
  const { settings } = useAppStore();
  const isVi = settings?.language === 'vi';

  return (
    <div className="p-6 space-y-6 max-w-4xl select-text">
      {/* Brand & core metadata */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
        <div className="flex items-center space-x-4">
          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/20">
            <Layers className="h-8 w-8 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-white tracking-tight">
              Universal Social Media Downloader
            </h3>
            <p className="text-xs text-slate-400">
              {isVi
                ? 'Trình quản lý & tải xuống phương tiện truyền thông đa nền tảng chất lượng cao'
                : 'Enterprise-grade standalone bulk download engine for public media streams.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[10px] font-mono font-bold bg-slate-950 text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-850">
                Engine Version v2.1.4
              </span>
              <span className="text-[10px] font-mono font-bold bg-blue-600/10 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                Standalone Mode
              </span>
              <span className="text-[10px] font-mono font-bold bg-emerald-600/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Local SQLite Database
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of technical specifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Architecture Diagram Layout */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center space-x-2">
            <Cpu className="h-4 w-4 text-purple-500" />
            <span>{isVi ? 'Kiến trúc hệ thống' : 'System Architectural Pipeline'}</span>
          </h4>

          <div className="space-y-3.5 text-xs">
            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-850 relative">
              <span className="absolute -top-2 left-3 bg-blue-600 text-[9px] text-white px-2 py-0.5 rounded font-mono font-bold">
                PHASE 1
              </span>
              <div className="font-bold text-slate-300 font-sans">Scraper Manager & link analyzer</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Supported: TikTokModule, YouTubeModule, InstagramModule, FacebookModule, REDModule, etc.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-850 relative">
              <span className="absolute -top-2 left-3 bg-purple-600 text-[9px] text-white px-2 py-0.5 rounded font-mono font-bold">
                PHASE 2
              </span>
              <div className="font-bold text-slate-300 font-sans">Gemini AI / offline Heuristics</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Performs deep semantic link parsing to find creators, durations, size, and high-res thumbnails.
              </p>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-850 relative">
              <span className="absolute -top-2 left-3 bg-emerald-600 text-[9px] text-white px-2 py-0.5 rounded font-mono font-bold">
                PHASE 3
              </span>
              <div className="font-bold text-slate-300 font-sans">Concurrent Task Scheduler</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Drives non-blocking download queues in parallel, writing logs & saving files locally.
              </p>
            </div>
          </div>
        </div>

        {/* Database Schema representation */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center space-x-2">
            <Database className="h-4 w-4 text-emerald-500" />
            <span>{isVi ? 'Cấu trúc Cơ sở Dữ liệu' : 'SQLite Relational Database Schema'}</span>
          </h4>

          <div className="space-y-3 font-mono text-[11px] max-h-[300px] overflow-y-auto">
            {/* Table Downloads */}
            <div className="p-3 bg-slate-950 rounded border border-slate-850">
              <span className="text-blue-400 font-bold font-mono">TABLE downloads</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-400 mt-1">
                <li>id TEXT PRIMARY KEY</li>
                <li>url TEXT NOT NULL</li>
                <li>platform TEXT NOT NULL</li>
                <li>title TEXT</li>
                <li>author TEXT</li>
                <li>resolution TEXT</li>
                <li>estimated_size INTEGER</li>
              </ul>
            </div>

            {/* Table Queue */}
            <div className="p-3 bg-slate-950 rounded border border-slate-850">
              <span className="text-purple-400 font-bold font-mono">TABLE queue</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-400 mt-1">
                <li>id TEXT PRIMARY KEY</li>
                <li>status TEXT (pending | downloading | paused)</li>
                <li>progress INTEGER DEFAULT 0</li>
                <li>priority INTEGER DEFAULT 1</li>
              </ul>
            </div>

            {/* Table History */}
            <div className="p-3 bg-slate-950 rounded border border-slate-850">
              <span className="text-emerald-400 font-bold font-mono">TABLE history</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-400 mt-1">
                <li>id TEXT PRIMARY KEY</li>
                <li>file_path TEXT NOT NULL</li>
                <li>completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP</li>
                <li>elapsed_time INTEGER</li>
              </ul>
            </div>

            {/* Table Settings */}
            <div className="p-3 bg-slate-950 rounded border border-slate-850">
              <span className="text-amber-400 font-bold font-mono">TABLE settings</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-400 mt-1">
                <li>key TEXT PRIMARY KEY</li>
                <li>value TEXT NOT NULL</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Installation & Guide Documentation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5">
        <h4 className="text-sm font-bold text-white flex items-center space-x-2">
          <HelpCircle className="h-4 w-4 text-blue-500" />
          <span>{isVi ? 'Hướng dẫn cài đặt & tích hợp Tauri Desktop' : 'Installation & Tauri v2 Desktop Build Guide'}</span>
        </h4>

        <div className="space-y-2 text-xs text-slate-400 leading-relaxed font-sans">
          <p>
            This application is designed to compile seamlessly as a native multi-platform desktop application using <strong>Tauri v2</strong> and <strong>Rust</strong>. To compile it on your local developer machine, follow these simple steps:
          </p>

          <ol className="list-decimal pl-5 space-y-1 text-slate-300 font-mono text-[11px] bg-slate-950 p-3 rounded border border-slate-850">
            <li>npm install</li>
            <li>npm run tauri dev <span className="text-slate-500"># Launches desktop preview immediately</span></li>
            <li>npm run tauri build <span className="text-slate-500"># Compiles self-contained production installer (MSI/DMG/AppImage)</span></li>
          </ol>

          <p className="pt-2">
            The background rust compiler binds our SQLite schema directly to local user document directories, routing non-blocking asynchronous threads to handle parallel downloads without freezing the React web view.
          </p>
        </div>
      </div>
    </div>
  );
};
