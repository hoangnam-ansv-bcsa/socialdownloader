import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  Settings as SettIcon,
  Save,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  Link2,
} from 'lucide-react';

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

  const [pairingLoading, setPairingLoading] =
    useState(false);

  const [pairingConfigured, setPairingConfigured] =
    useState(false);

  const [pairingBackendUrl, setPairingBackendUrl] =
    useState('');

  const [pairingKey, setPairingKey] =
    useState('');

  const [showPairingKey, setShowPairingKey] =
    useState(false);

  const [pairingStatus, setPairingStatus] =
    useState('');

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

  const loadPairingInfo = async () => {
    setPairingLoading(true);
    setPairingStatus('');

    try {
      const response = await fetch(
        '/api/facebook-helper/pairing-info',
        {
          cache: 'no-store',
        },
      );

      const data: unknown =
        await response.json();

      if (
        !response.ok ||
        typeof data !== 'object' ||
        data === null
      ) {
        throw new Error(
          isVi
            ? 'Không thể lấy thông tin ghép nối.'
            : 'Unable to load pairing information.',
        );
      }

      const backendUrl =
        'backendUrl' in data &&
        typeof data.backendUrl === 'string'
          ? data.backendUrl
          : '';

      const helperKey =
        'helperKey' in data &&
        typeof data.helperKey === 'string'
          ? data.helperKey
          : '';

      const configured =
        'configured' in data &&
        data.configured === true;

      setPairingBackendUrl(backendUrl);
      setPairingKey(helperKey);
      setPairingConfigured(configured);

      setPairingStatus(
        configured
          ? (
            isVi
              ? 'Đã lấy thông tin ghép nối.'
              : 'Pairing information loaded.'
          )
          : (
            isVi
              ? 'Backend chưa có mã ghép nối.'
              : 'No pairing code is configured.'
          ),
      );
    } catch (error) {
      setPairingStatus(
        error instanceof Error
          ? error.message
          : (
            isVi
              ? 'Không thể lấy thông tin ghép nối.'
              : 'Unable to load pairing information.'
          ),
      );
    } finally {
      setPairingLoading(false);
    }
  };

  const copyPairingText = async (
    value: string,
    successMessage: string,
  ) => {
    if (!value) {
      setPairingStatus(
        isVi
          ? 'Chưa có dữ liệu để sao chép.'
          : 'There is no data to copy.',
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(
        value,
      );

      setPairingStatus(successMessage);
    } catch {
      setPairingStatus(
        isVi
          ? 'Không thể sao chép vào clipboard.'
          : 'Unable to copy to clipboard.',
      );
    }
  };

  const copyAllPairingInfo = async () => {
    if (
      !pairingBackendUrl ||
      !pairingKey
    ) {
      setPairingStatus(
        isVi
          ? 'Hãy lấy đầy đủ thông tin ghép nối trước.'
          : 'Load the pairing information first.',
      );
      return;
    }

    const text = [
      'SocialDownloader Facebook Helper',
      `Backend URL: ${pairingBackendUrl}`,
      `Pairing code: ${pairingKey}`,
    ].join('\n');

    await copyPairingText(
      text,
      isVi
        ? 'Đã sao chép toàn bộ thông tin ghép nối.'
        : 'All pairing information copied.',
    );
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

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-lg">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Link2 className="h-4 w-4 text-blue-500" />
            <span>
              {isVi
                ? 'Ghép nối Facebook Helper'
                : 'Facebook Helper Pairing'}
            </span>
          </h3>

          <p className="text-xs text-slate-400">
            {isVi
              ? 'Lấy địa chỉ backend và mã ghép nối để nhập vào extension trên máy khác.'
              : 'Get the backend URL and pairing code for the extension on another computer.'}
          </p>
        </div>

        {!pairingBackendUrl && (
          <button
            type="button"
            onClick={loadPairingInfo}
            disabled={pairingLoading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-all cursor-pointer"
          >
            {pairingLoading
              ? (
                isVi
                  ? 'Đang lấy thông tin...'
                  : 'Loading...'
              )
              : (
                isVi
                  ? 'Lấy thông tin ghép nối'
                  : 'Get pairing information'
              )}
          </button>
        )}

        {pairingBackendUrl && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                {isVi
                  ? 'Địa chỉ backend'
                  : 'Backend URL'}
              </label>

              <div className="flex gap-2">
                <input
                  readOnly
                  value={pairingBackendUrl}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />

                <button
                  type="button"
                  onClick={() =>
                    copyPairingText(
                      pairingBackendUrl,
                      isVi
                        ? 'Đã sao chép địa chỉ backend.'
                        : 'Backend URL copied.',
                    )
                  }
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 rounded-lg"
                  title={
                    isVi
                      ? 'Sao chép backend'
                      : 'Copy backend URL'
                  }
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                {isVi
                  ? 'Mã ghép nối'
                  : 'Pairing code'}
              </label>

              <div className="flex gap-2">
                <input
                  readOnly
                  type={
                    showPairingKey
                      ? 'text'
                      : 'password'
                  }
                  value={pairingKey}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPairingKey(
                      (current) => !current,
                    )
                  }
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 rounded-lg"
                  title={
                    showPairingKey
                      ? (
                        isVi
                          ? 'Ẩn mã'
                          : 'Hide code'
                      )
                      : (
                        isVi
                          ? 'Hiện mã'
                          : 'Show code'
                      )
                  }
                >
                  {showPairingKey
                    ? (
                      <EyeOff className="h-4 w-4" />
                    )
                    : (
                      <Eye className="h-4 w-4" />
                    )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    copyPairingText(
                      pairingKey,
                      isVi
                        ? 'Đã sao chép mã ghép nối.'
                        : 'Pairing code copied.',
                    )
                  }
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 rounded-lg"
                  title={
                    isVi
                      ? 'Sao chép mã'
                      : 'Copy pairing code'
                  }
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copyAllPairingInfo}
                disabled={!pairingConfigured}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-lg"
              >
                {isVi
                  ? 'Sao chép cả hai để chia sẻ'
                  : 'Copy both to share'}
              </button>

              <button
                type="button"
                onClick={loadPairingInfo}
                disabled={pairingLoading}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-5 py-2.5 rounded-lg"
              >
                {isVi
                  ? 'Làm mới'
                  : 'Refresh'}
              </button>
            </div>
          </div>
        )}

        {pairingStatus && (
          <div className="text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
            {pairingStatus}
          </div>
        )}

        <p className="text-[11px] leading-5 text-amber-400/90">
          {isVi
            ? 'Chỉ chia sẻ mã này với người bạn tin tưởng. Người có mã có thể gửi phiên Facebook tới backend của bạn.'
            : 'Only share this code with trusted people. Anyone with the code can send a Facebook session to your backend.'}
        </p>
      </section>
    </div>
  );
};
