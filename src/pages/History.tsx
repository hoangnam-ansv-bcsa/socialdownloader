import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  History as HistIcon,
  Search,
  Trash2,
  Download,
  ExternalLink,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { MediaItem } from '../types';

export const History: React.FC = () => {
  const { history, fetchHistory, clearHistory, deleteHistoryItem, settings } = useAppStore();
  const isVi = settings?.language === 'vi';

  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredHistory = history.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.author.toLowerCase().includes(search.toLowerCase()) ||
      item.platform.toLowerCase().includes(search.toLowerCase())
  );

  // Export history to CSV as requested
  const exportToCSV = () => {
    if (history.length === 0) return;

    const headers = ['Platform', 'Author', 'Title', 'URL', 'File Path', 'Resolution', 'Size (MB)', 'Download Date'];
    const rows = history.map((item) => [
      item.platform,
      item.author,
      `"${item.title.replace(/"/g, '""')}"`,
      item.url,
      item.filePath || '',
      item.resolution,
      (item.estimatedSize / (1024 * 1024)).toFixed(2),
      item.publishDate,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'downloader_history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top action toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <HistIcon className="h-4 w-4 text-blue-500" />
            <span>{isVi ? 'Nhật ký lịch sử tải xuống' : 'Download History Log'}</span>
          </h3>
          <p className="text-xs text-slate-400">
            {isVi
              ? 'Lưu trữ cục bộ tất cả tệp phương tiện đã tải thành công để tham chiếu và xuất báo cáo'
              : 'Complete trace history of all successful transfers. Export report details anytime.'}
          </p>
        </div>

        <div className="flex items-center space-x-3.5">
          <button
            onClick={exportToCSV}
            disabled={history.length === 0}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>{isVi ? 'Xuất báo cáo CSV' : 'Export CSV'}</span>
          </button>

          <button
            onClick={clearHistory}
            disabled={history.length === 0}
            className="bg-slate-800 hover:bg-rose-950 hover:text-rose-400 disabled:opacity-50 text-slate-300 text-xs px-4 py-2 rounded-lg border border-slate-700 transition-all cursor-pointer"
          >
            {isVi ? 'Xóa toàn bộ' : 'Clear All History'}
          </button>
        </div>
      </div>

      {/* Search and Table box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="relative w-72">
            <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isVi ? 'Tìm kiếm lịch sử...' : 'Search completed logs...'}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={fetchHistory}
            className="text-slate-400 hover:text-white p-2 rounded hover:bg-slate-850 transition-colors cursor-pointer"
            title={isVi ? 'Làm mới' : 'Refresh'}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs select-none">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-850">
                <th className="py-3.5 px-4 font-semibold">{isVi ? 'Nền tảng' : 'Platform'}</th>
                <th className="py-3.5 px-4 font-semibold">{isVi ? 'Mô tả tệp' : 'Media Info'}</th>
                <th className="py-3.5 px-4 font-semibold">{isVi ? 'Tác giả' : 'Author'}</th>
                <th className="py-3.5 px-4 font-semibold text-center">{isVi ? 'Dung lượng' : 'Size'}</th>
                <th className="py-3.5 px-4 font-semibold text-center">{isVi ? 'Ngày tải' : 'Download Date'}</th>
                <th className="py-3.5 px-4 font-semibold text-center">{isVi ? 'Hành động' : 'Actions'}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/40">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    {isVi ? 'Lịch sử trống hoặc không có kết quả phù hợp.' : 'No completed history found matching query.'}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-850/30 text-slate-300">
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-indigo-600/10 text-indigo-400 border border-indigo-500/15">
                        {item.platform}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="w-8 h-8 object-cover rounded border border-slate-800 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <h4 className="font-semibold text-white truncate text-[11px] max-w-[220px]" title={item.title}>
                            {item.title}
                          </h4>
                          <span className="text-[9px] text-slate-500 font-mono capitalize">
                            {item.mediaType} • {item.resolution}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">@{item.author}</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-400">
                      {(item.estimatedSize / (1024 * 1024)).toFixed(1)} MB
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-500">{item.publishDate}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => {
                            alert(isVi ? `Đang mở: ${item.filePath}` : `Opening: ${item.filePath}`);
                          }}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          title={isVi ? 'Mở tệp' : 'Open file location'}
                        >
                          <FolderOpen className="h-4 w-4" />
                        </button>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                          title={isVi ? 'Liên kết gốc' : 'Open raw URL'}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => deleteHistoryItem(item.id)}
                          className="p-1 text-rose-400 hover:text-white hover:bg-rose-950/25 rounded transition-colors cursor-pointer"
                          title={isVi ? 'Xóa lịch sử' : 'Delete log entry'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
