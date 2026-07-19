import React, { useState, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  Folder,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  HelpCircle,
  Info,
  Sliders,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { MediaItem } from '../types';

export const Downloader: React.FC = () => {
  const {
    settings,
    updateSettings,
    isAnalyzing,
    analyzedItems,
    analyzeUrls,
    toggleAnalyzedSelection,
    toggleAllAnalyzedSelection,
    clearAnalyzedItems,
    addToQueue,
    setTab,
  } = useAppStore();

  const isVi = settings?.language === 'vi';

  // Sub tabs mirroring the screenshot
  const [subTab, setSubTab] = useState<'batch' | 'multi'>('batch');

  // Input states
  const [username, setUsername] = useState('');
  const [intervalSecs, setIntervalSecs] = useState('0');
  const [pastedUrls, setPastedUrls] = useState('');

  // Search inside analyzed items table
  const [descSearch, setDescSearch] = useState('');

  // Pagination states
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Checkbox selection stats
  const selectedItems = analyzedItems.filter((item) => item.selected);
  const isAllSelected = analyzedItems.length > 0 && selectedItems.length === analyzedItems.length;

  // Handle Fetching creator publications ("Tải hàng loạt")
  const handleFetchCreatorData = () => {
    if (!username.trim()) return;

    // Simulate scraping a channel/user profile by generating representative links
    const mockUrls = [
      `https://www.tiktok.com/@${username}/video/${Math.floor(Math.random() * 900000) + 100000}`,
      `https://www.tiktok.com/@${username}/video/${Math.floor(Math.random() * 900000) + 100000}`,
      `https://www.tiktok.com/@${username}/video/${Math.floor(Math.random() * 900000) + 100000}`,
      `https://www.instagram.com/reel/${Math.random().toString(36).substring(2, 9)}`,
      `https://www.instagram.com/p/${Math.random().toString(36).substring(2, 9)}`,
    ];
    analyzeUrls(mockUrls);
  };

  // Handle Multi URLs Paste
  const handleAnalyzePastedUrls = () => {
    const urls = pastedUrls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

    if (urls.length === 0) return;
    analyzeUrls(urls);
  };

  // File Upload importer (CSV / TXT)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const urls = text
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

      if (urls.length > 0) {
        analyzeUrls(urls);
      }
    };
    reader.readAsText(file);
  };

  // Submit selected items to Queue
  const handleStartDownloads = () => {
    if (selectedItems.length === 0) return;
    addToQueue(selectedItems);
    clearAnalyzedItems();
    setTab('queue'); // Switch to active Queue viewer
  };

  const handleFolderPick = () => {
    if (!settings) return;
    // Simulate folder selection
    const folder = prompt(
      isVi ? 'Nhập đường dẫn thư mục tải xuống mới:' : 'Enter absolute target folder path:',
      settings.defaultDownloadFolder
    );
    if (folder) {
      updateSettings({ ...settings, defaultDownloadFolder: folder });
    }
  };

  // Filter items based on local search box inside the table
  const filteredItems = analyzedItems.filter((item) => {
    if (!descSearch) return true;
    return item.title.toLowerCase().includes(descSearch.toLowerCase()) ||
           item.author.toLowerCase().includes(descSearch.toLowerCase());
  });

  // Paginated items
  const totalItems = filteredItems.length;
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="p-6 space-y-6">
      {/* Sub tabs mirroring the Vietnamese screenshot exactly */}
      <div className="border-b border-slate-800 flex space-x-6 text-sm font-semibold">
        <button
          onClick={() => {
            setSubTab('batch');
            clearAnalyzedItems();
          }}
          className={`pb-3 border-b-2 transition-all duration-150 cursor-pointer ${
            subTab === 'batch'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          {isVi ? 'Tải hàng loạt' : 'Channel Batch Download'}
        </button>
        <button
          onClick={() => {
            setSubTab('multi');
            clearAnalyzedItems();
          }}
          className={`pb-3 border-b-2 transition-all duration-150 cursor-pointer ${
            subTab === 'multi'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          {isVi ? 'Tải nhiều URL' : 'Load Multiple URLs'}
        </button>
      </div>

      {/* Input panel block */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
        {subTab === 'batch' ? (
          /* Tải hàng loạt (Batch Creator Mode) layout */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                {isVi ? 'Tên người dùng hoặc Kênh' : 'Username / Channel link'}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isVi ? 'Nhập tên người dùng (ví dụ: @hoangnam)' : 'Enter username or channel handle'}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all font-mono"
              />
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>{isVi ? 'Khoảng cách giữa các yêu cầu (giây)' : 'Request Interval (seconds)'}</span>
                <HelpCircle className="h-3.5 w-3.5 text-slate-500" title="Delay between calls to prevent rate limiting" />
              </label>
              <input
                type="number"
                value={intervalSecs}
                onChange={(e) => setIntervalSecs(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="md:col-span-3">
              <button
                onClick={handleFetchCreatorData}
                disabled={!username.trim() || isAnalyzing}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                {isAnalyzing ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    <span>{isVi ? 'Lấy dữ liệu' : 'Fetch Data'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Tải nhiều URL (Bulk link lists paste / import) layout */
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                {isVi ? 'Dán danh sách URL (Mỗi liên kết một dòng)' : 'Paste URLs List (One link per line)'}
              </label>
              <textarea
                value={pastedUrls}
                onChange={(e) => setPastedUrls(e.target.value)}
                rows={4}
                placeholder={isVi ? 'https://www.tiktok.com/...\nhttps://www.youtube.com/shorts/...' : 'https://...'}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all font-mono"
              />
            </div>

            {/* Drag & drop file layout / import layout */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs px-3 py-1.5 rounded border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Import TXT</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs px-3 py-1.5 rounded border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Import CSV</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.csv"
                  className="hidden"
                />
              </div>

              <button
                onClick={handleAnalyzePastedUrls}
                disabled={!pastedUrls.trim() || isAnalyzing}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-6 py-2 rounded-lg flex items-center space-x-2 transition-all cursor-pointer"
              >
                {isAnalyzing ? (
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                ) : (
                  <>
                    <Sliders className="h-3.5 w-3.5" />
                    <span>{isVi ? 'Phân tích liên kết' : 'Analyze Links'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Downloader choices layout mirroring screenshot "Tùy chọn tải" */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {isVi ? 'Tùy chọn tải' : 'Download Settings'}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Target path */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 block">
              {isVi ? 'Vị trí lưu' : 'Save Path'} <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={settings?.defaultDownloadFolder || 'C:\\Users\\Downloads'}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 font-mono focus:outline-none"
              />
              <button
                onClick={handleFolderPick}
                className="p-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <Folder className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filename format selection */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 block">
              {isVi ? 'Định dạng tên file' : 'File naming template'} <span className="text-rose-500">*</span>
            </label>
            <select
              value={settings?.fileNameTemplate || '{platform}_{author}_{id}_{title}'}
              onChange={(e) => {
                if (!settings) return;
                updateSettings({ ...settings, fileNameTemplate: e.target.value });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value="{platform}_{author}_{id}_{title}">{isVi ? 'Platform - Tác giả - ID - Tiêu đề' : 'Platform_Author_ID_Title'}</option>
              <option value="{id}_{title}">{isVi ? 'Chỉ ID - Tiêu đề' : 'ID_Title'}</option>
              <option value="{author}_{title}">{isVi ? 'Tác giả - Tiêu đề' : 'Author_Title'}</option>
              <option value="{title}">{isVi ? 'Chỉ tiêu đề' : 'Only Title'}</option>
            </select>
          </div>

          {/* Worker count */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 block">
              {isVi ? 'Số lượng tải đồng thời' : 'Parallel downloads count'}
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={settings?.concurrentDownloads ?? 15}
              onChange={(e) => {
                if (!settings) return;
                updateSettings({ ...settings, concurrentDownloads: parseInt(e.target.value, 10) || 1 });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Primary Download trigger bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleStartDownloads}
          disabled={selectedItems.length === 0}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-6 py-3 rounded-lg flex items-center space-x-2.5 transition-all shadow-md shadow-blue-900/30 cursor-pointer"
        >
          <Download className="h-4.5 w-4.5" />
          <span>
            {isVi ? `Tải (${selectedItems.length})` : `Download Selected (${selectedItems.length})`}
          </span>
        </button>

        {analyzedItems.length > 0 && (
          <button
            onClick={clearAnalyzedItems}
            className="text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {isVi ? 'Xóa danh sách' : 'Clear List'}
          </button>
        )}
      </div>

      {/* Discovery Table mirroring the provided screenshot layout */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            {isVi ? 'Kết quả phân tích liên kết' : 'Media Discovery list'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-850 select-none">
                <th className="py-3 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    disabled={analyzedItems.length === 0}
                    onChange={(e) => toggleAllAnalyzedSelection(e.target.checked)}
                    className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 w-16 text-center font-semibold">ID</th>
                <th className="py-3 px-3 w-32 font-semibold">
                  <div className="flex items-center space-x-1.5">
                    <span>{isVi ? 'Nền tảng' : 'Platform'}</span>
                    <Filter className="h-3 w-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3 font-semibold">URL</th>
                <th className="py-3 px-4 font-semibold">
                  <div className="flex items-center space-x-2">
                    <span>{isVi ? 'Mô tả / Tiêu đề' : 'Title / Description'}</span>
                    <div className="relative">
                      <Search className="h-3 w-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={descSearch}
                        onChange={(e) => setDescSearch(e.target.value)}
                        placeholder="Search..."
                        className="bg-slate-900 border border-slate-800 text-[10px] pl-5 pr-1.5 py-0.5 rounded focus:outline-none focus:border-blue-600 text-white font-mono placeholder-slate-600 max-w-[100px]"
                      />
                    </div>
                  </div>
                </th>
                <th className="py-3 px-3 w-28 text-center font-semibold">{isVi ? 'Ngày tạo' : 'Publish Date'}</th>
                <th className="py-3 px-3 w-24 text-center font-semibold">{isVi ? 'Độ phân giải' : 'Resolution'}</th>
                <th className="py-3 px-3 w-28 text-center font-semibold">{isVi ? 'Dung lượng' : 'Est. Size'}</th>
              </tr>
            </thead>

            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertCircle className="h-8 w-8 text-slate-600 animate-pulse" />
                      <p className="text-sm font-medium">
                        {isVi ? 'Không tìm thấy kết quả' : 'No results found'}
                      </p>
                      <p className="text-xs text-slate-600">
                        {isVi
                          ? 'Nhập tên người dùng hoặc dán URL để tiến hành phân tích tìm kiếm nội dung'
                          : 'Paste video/image links or enter profile handle to begin smart analysis'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    onClick={() => toggleAnalyzedSelection(item.id)}
                    className="border-b border-slate-800/50 hover:bg-slate-850/40 transition-colors duration-100 cursor-pointer text-slate-300"
                  >
                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={item.selected || false}
                        onChange={() => toggleAnalyzedSelection(item.id)}
                        className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-500 font-mono text-[10px]">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-600/10 text-blue-400 border border-blue-500/15">
                        {item.platform}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-500 text-[10px] max-w-[150px] truncate" title={item.url}>
                      {item.url}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="w-8 h-8 object-cover rounded border border-slate-800 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-white line-clamp-1 text-[11px]">{item.title}</span>
                          <span className="text-[9px] text-slate-500 font-mono">@{item.author}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-400 font-mono text-[10px]">{item.publishDate}</td>
                    <td className="py-3.5 px-3 text-center font-mono">
                      <span className="text-slate-400">{item.resolution}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-400 font-mono text-[10px]">
                      {(item.estimatedSize / (1024 * 1024)).toFixed(1)} MB
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginations block mimicking screenshot exactly */}
        {totalItems > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-400 select-none">
            <span className="text-xs font-mono">
              {isVi ? `Tổng ${totalItems} mục` : `Total ${totalItems} items`}
            </span>

            <div className="flex items-center space-x-4">
              {/* Pagination controls */}
              <div className="flex items-center space-x-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((c) => Math.max(c - 1, 1))}
                  className="p-1.5 bg-slate-900 border border-slate-800 hover:text-white rounded disabled:opacity-40 disabled:hover:text-slate-400 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs font-mono px-3">
                  {currentPage} / {Math.ceil(totalItems / pageSize)}
                </span>
                <button
                  disabled={currentPage >= Math.ceil(totalItems / pageSize)}
                  onClick={() => setCurrentPage((c) => Math.min(c + 1, Math.ceil(totalItems / pageSize)))}
                  className="p-1.5 bg-slate-900 border border-slate-800 hover:text-white rounded disabled:opacity-40 disabled:hover:text-slate-400 cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Page size toggle */}
              <div className="flex items-center space-x-1.5">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value, 10));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-900 border border-slate-800 text-xs text-slate-300 px-2.5 py-1 rounded focus:outline-none"
                >
                  <option value={5}>5 / {isVi ? 'trang' : 'page'}</option>
                  <option value={10}>10 / {isVi ? 'trang' : 'page'}</option>
                  <option value={20}>20 / {isVi ? 'trang' : 'page'}</option>
                  <option value={50}>50 / {isVi ? 'trang' : 'page'}</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* API Key guidance strip based on constraints */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start space-x-3 text-slate-400">
        <Info className="h-4.5 w-4.5 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-[11px] leading-relaxed">
          {isVi
            ? 'Ứng dụng hoạt động hoàn toàn cục bộ (Local Standalone). Để sử dụng khả năng phân tích nâng cao của Gemini AI, bạn chỉ cần cấu hình khóa API trong mục Cài đặt hoặc thông qua bảng quản lý Secrets của hệ thống.'
            : 'This applet is fully operational locally in Standalone mode. Gemini-powered content discovery runs server-side out-of-the-box. To customize or add keys, manage them securely inside your Settings panel.'}
        </p>
      </div>
    </div>
  );
};
