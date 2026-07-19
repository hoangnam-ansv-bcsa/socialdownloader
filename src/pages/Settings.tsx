import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Settings as SettIcon, Save, HelpCircle, AlertTriangle, CheckCircle } from 'lucide-react';

export const Settings: React.FC = () => {
  const { settings, fetchSettings, updateSettings } = useAppStore();
  const isVi = settings?.language === 'vi';

  // Local form states
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const [language, setLanguage] = useState<'en' | 'vi'>('en');
  const [defaultFolder, setDefaultFolder] = useState('C:\\Users\\Hoang Nam\\Downloads');
  const [concurrency, setConcurrency] = useState(5);
  const [retries, setRetries] = useState(3);
  const [timeout, setTimeoutSecs] = useState(30);
  const [autoUpdate, setAutoUpdate] = useState(true);

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Sync local state when store loads settings
  useEffect(() => {
    if (settings) {
      setTheme(settings.theme);
      setLanguage(settings.language);
      setDefaultFolder(settings.defaultDownloadFolder);
      setConcurrency(settings.concurrentDownloads);
      setRetries(settings.retryCount);
      setTimeoutSecs(settings.timeoutSeconds);
      setAutoUpdate(settings.autoUpdateChecker);
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    updateSettings({
      ...settings,
      theme,
      language,
      defaultDownloadFolder: defaultFolder,
      concurrentDownloads: concurrency,
      retryCount: retries,
      timeoutSeconds: timeout,
      autoUpdateChecker: autoUpdate,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <SettIcon className="h-4 w-4 text-blue-500" />
          <span>{isVi ? 'Cấu hình ứng dụng' : 'System Configuration Panel'}</span>
        </h3>
        <p className="text-xs text-slate-400">
          {isVi
            ? 'Cá nhân hóa các tùy chọn tải xuống, vị trí lưu trữ tệp, giới hạn băng thông và giao diện người dùng'
            : 'Fine-tune local directory targets, network socket timeouts, auto update routines, and themes'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-lg">
        {savedSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-lg flex items-center space-x-2.5 text-xs animate-bounce">
            <CheckCircle className="h-4.5 w-4.5" />
            <span>
              {isVi ? 'Đã lưu cấu hình thành công!' : 'All configurations saved successfully offline.'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Theme option */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">{isVi ? 'Giao diện' : 'UI Theme'}</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value="dark">{isVi ? 'Tối (Khuyên dùng)' : 'Dark Slate (Default)'}</option>
              <option value="light">{isVi ? 'Sáng' : 'Light Soft'}</option>
              <option value="system">{isVi ? 'Hệ thống' : 'System Sync'}</option>
            </select>
          </div>

          {/* Language option */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">{isVi ? 'Ngôn ngữ' : 'Language'}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value="en">English (US)</option>
              <option value="vi">Tiếng Việt (Vietnam)</option>
            </select>
          </div>

          {/* Default download Folder */}
          <div className="col-span-2 space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              {isVi ? 'Thư mục tải xuống mặc định' : 'Default Target Download Folder'}
            </label>
            <input
              type="text"
              value={defaultFolder}
              onChange={(e) => setDefaultFolder(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              placeholder="e.g., C:\Users\Downloads"
            />
          </div>

          {/* Concurrency worker counts */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              {isVi ? 'Số luồng tải song song' : 'Concurrent Workers'}
            </label>
            <input
              type="number"
              min={1}
              max={25}
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value, 10) || 5)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Retry attempts count */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              {isVi ? 'Số lần thử lại khi lỗi' : 'Network Retries Limit'}
            </label>
            <input
              type="number"
              min={0}
              max={10}
              value={retries}
              onChange={(e) => setRetries(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Timeout limits */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              {isVi ? 'Thời gian chờ tối đa (giây)' : 'Request Timeout Limit (seconds)'}
            </label>
            <input
              type="number"
              min={5}
              max={300}
              value={timeout}
              onChange={(e) => setTimeoutSecs(parseInt(e.target.value, 10) || 30)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Auto check for updates */}
          <div className="flex items-center space-x-3.5 pt-6 select-none">
            <input
              type="checkbox"
              id="autoupdate"
              checked={autoUpdate}
              onChange={(e) => setAutoUpdate(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
            <label htmlFor="autoupdate" className="text-xs font-bold text-slate-300 cursor-pointer">
              {isVi ? 'Tự động kiểm tra bản cập nhật' : 'Check for engine updates automatically'}
            </label>
          </div>
        </div>

        {/* Submit button bar */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-6 py-2.5 rounded-lg flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-blue-900/30"
          >
            <Save className="h-4 w-4" />
            <span>{isVi ? 'Lưu cấu hình' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
