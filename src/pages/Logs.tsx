import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Terminal, Trash2, Download, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

export const Logs: React.FC = () => {
  const { logs, fetchLogs, clearLogs, settings } = useAppStore();
  const isVi = settings?.language === 'vi';

  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warning' | 'error'>('all');

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    if (levelFilter === 'all') return true;
    return log.level === levelFilter;
  });

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-rose-400 font-bold';
      case 'warning':
        return 'text-amber-400 font-semibold';
      case 'debug':
        return 'text-slate-500';
      default:
        return 'text-blue-400';
    }
  };

  // Export logs to TXT
  const exportLogs = () => {
    if (logs.length === 0) return;

    const logString = logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.module}] ${l.message}`)
      .join('\n');

    const element = document.createElement('a');
    const file = new Blob([logString], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `downloader_system_logs.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="p-6 space-y-6 flex-1 flex flex-col">
      {/* Top action layout */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Terminal className="h-4 w-4 text-emerald-500" />
            <span>{isVi ? 'Bảng điều khiển chẩn đoán hệ thống' : 'Developer Diagnostic Console'}</span>
          </h3>
          <p className="text-xs text-slate-400">
            {isVi
              ? 'Theo dõi tiến trình cào dữ liệu, xử lý phản hồi từ Gemini API và hoạt động của các luồng tải cục bộ'
              : 'Real-time telemetry feeds for scrapers, background task schedulers, and network triggers'}
          </p>
        </div>

        <div className="flex items-center space-x-3.5">
          {/* Level Filter select */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 px-3 py-1.5 rounded-lg focus:outline-none"
          >
            <option value="all">{isVi ? 'Tất cả nhật ký' : 'All Levels'}</option>
            <option value="info">Info</option>
            <option value="warning">Warnings</option>
            <option value="error">Errors</option>
          </select>

          <button
            onClick={exportLogs}
            disabled={logs.length === 0}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs px-3.5 py-1.5 rounded-lg border border-slate-700 flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>{isVi ? 'Tải tệp logs' : 'Export Logs'}</span>
          </button>

          <button
            onClick={clearLogs}
            disabled={logs.length === 0}
            className="p-1.5 text-rose-400 hover:bg-rose-950/25 border border-transparent hover:border-rose-900/30 rounded-lg transition-all cursor-pointer"
            title={isVi ? 'Xóa nhật ký' : 'Clear System Logs'}
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Terminal View area */}
      <div className="bg-black border border-slate-800 rounded-xl flex-1 flex flex-col font-mono text-xs overflow-hidden shadow-2xl min-h-[400px]">
        {/* Terminal Header */}
        <div className="bg-slate-950 border-b border-slate-850 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500"></span>
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500"></span>
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500"></span>
          </div>
          <span className="text-[10px] text-slate-500 tracking-wider font-bold">SYSTEM TERMINAL CORE</span>
          <button
            onClick={fetchLogs}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Output lines */}
        <div className="p-5 overflow-y-auto flex-1 space-y-2 select-text selection:bg-slate-700 selection:text-white max-h-[500px]">
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 text-center py-12">
              *** {isVi ? 'KHÔNG CÓ DỮ LIỆU NHẬT KÝ' : 'NO LOG ENTRIES CAPTURED'} ***
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="leading-relaxed hover:bg-slate-950/40 p-1 rounded transition-colors flex items-start space-x-2">
                <span className="text-slate-600 shrink-0 select-none">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span className={`uppercase font-bold shrink-0 select-none ${getLevelStyle(log.level)}`}>
                  [{log.level}]
                </span>
                <span className="text-emerald-500 shrink-0 font-bold select-none">
                  [{log.module}]
                </span>
                <span className="text-slate-300 break-all flex-1">
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
