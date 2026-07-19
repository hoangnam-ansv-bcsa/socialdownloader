import React, { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  Pause,
  Play,
  Trash2,
  ListRestart,
  Loader,
  PlayCircle,
  FileCheck2,
  XOctagon,
  Sliders,
  Sparkles,
} from 'lucide-react';

export const Queue: React.FC = () => {
  const { queue, queueAction, clearCompletedQueue, settings, updateSettings, fetchQueue } = useAppStore();

  const isVi = settings?.language === 'vi';

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const activeDownloads = queue.filter(
    (item) => item.status === 'downloading' || item.status === 'pending' || item.status === 'paused'
  );
  const finishedDownloads = queue.filter(
    (item) => item.status === 'completed' || item.status === 'failed'
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'downloading':
        return (
          <span className="flex items-center space-x-1.5 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
            <Loader className="h-3.5 w-3.5 animate-spin" />
            <span>{isVi ? 'Đang tải' : 'Downloading'}</span>
          </span>
        );
      case 'paused':
        return (
          <span className="flex items-center space-x-1.5 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
            <Pause className="h-3.5 w-3.5" />
            <span>{isVi ? 'Tạm dừng' : 'Paused'}</span>
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
            <FileCheck2 className="h-3.5 w-3.5" />
            <span>{isVi ? 'Hoàn thành' : 'Completed'}</span>
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center space-x-1.5 text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
            <XOctagon className="h-3.5 w-3.5" />
            <span>{isVi ? 'Thất bại' : 'Failed'}</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1.5 text-xs text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-md border border-slate-500/20">
            <PlayCircle className="h-3.5 w-3.5 animate-pulse" />
            <span>{isVi ? 'Chờ tải' : 'Queued'}</span>
          </span>
        );
    }
  };

  const handleConcurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!settings) return;
    updateSettings({
      ...settings,
      concurrentDownloads: parseInt(e.target.value, 10),
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Controls & Queue configuration section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Sliders className="h-4 w-4 text-blue-500" />
            <span>{isVi ? 'Cấu hình luồng tải đồng thời' : 'Concurrent Workers Configuration'}</span>
          </h3>
          <p className="text-xs text-slate-400">
            {isVi
              ? 'Tăng tốc độ tải bằng việc sử dụng nhiều luồng tải đồng thời cho các tác vụ'
              : 'Maximize bandwidth efficiency by tuning parallel download workers'}
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">{isVi ? 'Tải đồng thời:' : 'Workers:'}</span>
            <select
              value={settings?.concurrentDownloads ?? 5}
              onChange={handleConcurrencyChange}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-600"
            >
              {[1, 2, 3, 5, 8, 10, 15].map((val) => (
                <option key={val} value={val}>
                  {val} {isVi ? 'luồng' : 'threads'}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={clearCompletedQueue}
            disabled={finishedDownloads.length === 0}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 text-slate-300 text-xs px-4 py-2 rounded-lg border border-slate-700 transition-colors duration-150 cursor-pointer"
          >
            {isVi ? 'Xóa tác vụ đã xong' : 'Clear Finished'}
          </button>
        </div>
      </div>

      {/* Main Queue items list */}
      <div className="space-y-4">
        {/* Active items section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isVi ? 'Tiến trình tải hoạt động' : 'Active download tasks'} ({activeDownloads.length})
            </h4>
          </div>

          {activeDownloads.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              {isVi ? 'Không có tác vụ tải nào đang chạy' : 'No active download workers currently running.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {activeDownloads.map((item) => (
                <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Item metadata */}
                  <div className="flex items-start space-x-3.5 min-w-[280px] max-w-[400px]">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-12 h-12 object-cover rounded-lg border border-slate-800 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold font-mono bg-blue-600/10 text-blue-400 px-1.5 py-0.5 rounded">
                          {item.platform}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {item.author}
                        </span>
                      </div>
                      <h5 className="text-xs font-semibold text-white line-clamp-1">{item.title}</h5>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Type: {item.mediaType} • {item.resolution}
                      </p>
                    </div>
                  </div>

                  {/* Progress panel */}
                  <div className="flex-1 max-w-md space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">
                        {item.downloadSpeed ? `Speed: ${item.downloadSpeed}` : ''}
                      </span>
                      <span className="text-slate-300 font-bold">{item.progress}%</span>
                      <span className="text-slate-400">
                        {item.eta ? `ETA: ${item.eta}` : ''}
                      </span>
                    </div>

                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.status === 'paused' ? 'bg-amber-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center space-x-3.5 justify-end">
                    {getStatusBadge(item.status)}

                    <div className="flex items-center space-x-1.5">
                      {item.status === 'downloading' || item.status === 'pending' ? (
                        <button
                          onClick={() => queueAction(item.id, 'pause')}
                          className="p-1.5 text-amber-400 hover:text-white hover:bg-amber-600/10 rounded-md transition-colors cursor-pointer"
                          title={isVi ? 'Tạm dừng tác vụ' : 'Pause Task'}
                        >
                          <Pause className="h-4 w-4" />
                        </button>
                      ) : item.status === 'paused' ? (
                        <button
                          onClick={() => queueAction(item.id, 'resume')}
                          className="p-1.5 text-emerald-400 hover:text-white hover:bg-emerald-600/10 rounded-md transition-colors cursor-pointer"
                          title={isVi ? 'Tiếp tục tải' : 'Resume Task'}
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      ) : null}

                      <button
                        onClick={() => queueAction(item.id, 'delete')}
                        className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-600/10 rounded-md transition-colors cursor-pointer"
                        title={isVi ? 'Hủy / Xóa tác vụ' : 'Delete Task'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed queue items visual check list */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-900">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isVi ? 'Tác vụ đã hoàn thành / lỗi' : 'Finished queue jobs'} ({finishedDownloads.length})
            </h4>
          </div>

          {finishedDownloads.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              {isVi ? 'Không có tác vụ hoàn thành gần đây' : 'No recently completed or failed tasks in active memory.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 max-h-[300px] overflow-y-auto">
              {finishedDownloads.map((item) => (
                <div key={item.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3.5">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-10 h-10 object-cover rounded-md border border-slate-800 shrink-0"
                    />
                    <div>
                      <h5 className="text-xs font-semibold text-white line-clamp-1">{item.title}</h5>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {item.platform} • {item.author}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 justify-end">
                    {getStatusBadge(item.status)}

                    {item.status === 'failed' && (
                      <button
                        onClick={() => queueAction(item.id, 'restart')}
                        className="p-1.5 text-blue-400 hover:text-white hover:bg-blue-600/10 rounded-md transition-colors cursor-pointer"
                        title={isVi ? 'Thử lại tác vụ' : 'Retry Task'}
                      >
                        <ListRestart className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      onClick={() => queueAction(item.id, 'delete')}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-rose-600/10 rounded-md transition-colors cursor-pointer"
                      title={isVi ? 'Xóa' : 'Delete'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
