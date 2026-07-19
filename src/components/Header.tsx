import React, { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Sun, Moon, RefreshCw, Radio, Globe } from 'lucide-react';

export const Header: React.FC = () => {
  const { settings, updateSettings, fetchStats, fetchQueue, fetchHistory, stats } = useAppStore();

  const isVi = settings?.language === 'vi';

  const toggleLanguage = () => {
    if (!settings) return;
    updateSettings({
      ...settings,
      language: settings.language === 'en' ? 'vi' : 'en',
    });
  };

  const toggleTheme = () => {
    if (!settings) return;
    updateSettings({
      ...settings,
      theme: settings.theme === 'dark' ? 'light' : 'dark',
    });
  };

  const handleManualRefresh = () => {
    fetchStats();
    fetchQueue();
    fetchHistory();
  };

  // Sync background refresh every 3 seconds to update speed gauges and queue progression
  useEffect(() => {
    const timer = setInterval(() => {
      fetchStats();
      fetchQueue();
    }, 3000);
    return () => clearInterval(timer);
  }, [fetchStats, fetchQueue]);

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 text-slate-300">
      {/* Platform Title */}
      <div className="flex items-center space-x-3">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
          <span>{isVi ? 'Trình Tải Phương Tiện Đa Nền Tảng' : 'Universal Social Media Downloader'}</span>
          <span className="text-xs bg-blue-600/20 text-blue-400 font-mono font-medium px-2 py-0.5 rounded-full border border-blue-500/20">
            v2.1.4
          </span>
        </h2>
        {stats?.queueStatus === 'running' && (
          <div className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
            <Radio className="h-3.5 w-3.5" />
            <span>{isVi ? 'Đang tải...' : 'Downloading...'}</span>
          </div>
        )}
      </div>

      {/* Toolbar controls mirroring user screenshot */}
      <div className="flex items-center space-x-3">
        {/* Network speed indicator */}
        {stats && stats.currentSpeed !== '0 KB/s' && (
          <div className="text-xs font-mono bg-slate-800 border border-slate-700 px-3 py-1 rounded-lg flex items-center space-x-1.5 text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            <span>Speed: {stats.currentSpeed}</span>
          </div>
        )}

        {/* Manual Refresh */}
        <button
          onClick={handleManualRefresh}
          title={isVi ? 'Tải lại dữ liệu' : 'Refresh Data'}
          className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition-colors duration-150 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Language selector toggle with flags or text */}
        <button
          onClick={toggleLanguage}
          title={isVi ? 'Chuyển sang tiếng Anh' : 'Switch to Vietnamese'}
          className="flex items-center space-x-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition-colors duration-150 cursor-pointer"
        >
          {settings?.language === 'vi' ? (
            <>
              <span className="text-base">🇻🇳</span>
              <span>VI</span>
            </>
          ) : (
            <>
              <span className="text-base">🇺🇸</span>
              <span>EN</span>
            </>
          )}
        </button>

        {/* Theme select Sun/Moon */}
        <button
          onClick={toggleTheme}
          title={isVi ? 'Đổi giao diện' : 'Toggle Theme'}
          className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition-colors duration-150 cursor-pointer"
        >
          {settings?.theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
};
