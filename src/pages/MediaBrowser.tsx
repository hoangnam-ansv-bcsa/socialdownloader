import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  Search,
  Filter,
  Play,
  Image,
  FolderOpen,
  Eye,
  ExternalLink,
  X,
  FileCheck2,
} from 'lucide-react';
import { MediaItem, PlatformType } from '../types';

export const MediaBrowser: React.FC = () => {
  const { history, fetchHistory, settings } = useAppStore();
  const isVi = settings?.language === 'vi';

  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformType | 'All'>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'video' | 'photo' | 'album' | 'audio'>('All');

  // Modal detail viewer
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Filters logic
  const filtered = history.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.author.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = platformFilter === 'All' || item.platform === platformFilter;
    const matchesType = typeFilter === 'All' || item.mediaType === typeFilter;
    return matchesSearch && matchesPlatform && matchesType;
  });

  const platforms: (PlatformType | 'All')[] = [
    'All',
    'TikTok',
    'YouTube',
    'Instagram',
    'Facebook',
    'Bilibili',
    'Xiaohongshu',
    'Douyin',
    'Kuaishou',
    'Pinterest',
  ];

  const types = [
    { value: 'All', label: isVi ? 'Tất cả dạng' : 'All Types' },
    { value: 'video', label: isVi ? 'Video' : 'Videos' },
    { value: 'photo', label: isVi ? 'Hình ảnh' : 'Photos' },
    { value: 'album', label: isVi ? 'Album ảnh' : 'Albums' },
    { value: 'audio', label: isVi ? 'Âm thanh' : 'Audios' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header and Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">
              {isVi ? 'Thư viện phương tiện cục bộ' : 'Local Media Catalog'}
            </h3>
            <p className="text-xs text-slate-400">
              {isVi
                ? 'Duyệt các video, hình ảnh chất lượng cao đã tải về thành công'
                : 'Browse offline videos, photos, and albums downloaded from your social streams'}
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-72">
            <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isVi ? 'Tìm kiếm theo từ khóa, tác giả...' : 'Search by title, author...'}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder-slate-600"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/50">
          <span className="text-[11px] font-bold text-slate-500 mr-2 uppercase tracking-wider">
            {isVi ? 'Nền tảng:' : 'Platform:'}
          </span>
          {platforms.map((plat) => (
            <button
              key={plat}
              onClick={() => setPlatformFilter(plat)}
              className={`px-3 py-1 text-xs rounded-full border transition-all duration-100 cursor-pointer ${
                platformFilter === plat
                  ? 'bg-blue-600 border-blue-500 text-white font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {plat}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 mr-2 uppercase tracking-wider">
            {isVi ? 'Định dạng:' : 'Format:'}
          </span>
          {types.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value as any)}
              className={`px-3 py-1 text-xs rounded-full border transition-all duration-100 cursor-pointer ${
                typeFilter === t.value
                  ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Media Items Visual Grid */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center text-slate-500">
          <FolderOpen className="h-10 w-10 text-slate-600 mx-auto mb-3 animate-pulse" />
          <p className="text-sm font-semibold">
            {isVi ? 'Thư viện trống' : 'No offline media matching your filters'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {isVi ? 'Hãy tải xuống một số tệp trước!' : 'Go to Batch Downloader to fetch some high-res links!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group cursor-pointer hover:border-slate-700 transition-all duration-150 relative shadow-md"
            >
              {/* Media image container */}
              <div className="aspect-video w-full bg-slate-950 relative overflow-hidden">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                  <span className="bg-blue-600 p-2 rounded-full text-white">
                    <Eye className="h-4.5 w-4.5" />
                  </span>
                </div>

                {/* Tag Overlay type */}
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-black/60 backdrop-blur text-white flex items-center space-x-1">
                  {item.mediaType === 'video' ? <Play className="h-3 w-3 fill-current" /> : <Image className="h-3 w-3" />}
                  <span>{item.mediaType.toUpperCase()}</span>
                </span>

                {/* Duration Badge */}
                {item.duration && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-600 text-white">
                    {item.duration}
                  </span>
                )}

                {/* Platform tag */}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-200">
                  {item.platform}
                </span>
              </div>

              {/* Text label details */}
              <div className="p-3.5 space-y-1">
                <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-blue-400 transition-colors">
                  {item.title}
                </h4>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>@{item.author}</span>
                  <span>{(item.estimatedSize / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Detail overlay view */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full overflow-hidden relative shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-950/80 border border-slate-800 hover:text-white text-slate-400 rounded-full transition-colors z-10 cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {/* Media visualization layout */}
            <div className="aspect-video w-full bg-slate-950 relative">
              {selectedItem.mediaType === 'video' ? (
                /* Video mockup */
                <div className="w-full h-full flex flex-col items-center justify-center relative">
                  <img
                    src={selectedItem.thumbnail}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-45 filter blur-[2px]"
                  />
                  <div className="relative z-10 flex flex-col items-center space-y-2">
                    <span className="bg-blue-600 p-4.5 rounded-full text-white animate-bounce cursor-pointer">
                      <Play className="h-7 w-7 fill-current" />
                    </span>
                    <span className="text-xs font-bold bg-black/60 px-3 py-1 rounded text-white font-mono">
                      MOCK VIDEO STREAM ({selectedItem.resolution})
                    </span>
                  </div>
                </div>
              ) : (
                /* Photo visual */
                <img src={selectedItem.thumbnail} alt="" className="w-full h-full object-contain" />
              )}
            </div>

            {/* Detail descriptors */}
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-600/10 text-blue-400 border border-blue-500/20">
                    {selectedItem.platform}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">@{selectedItem.author}</span>
                </div>
                <h3 className="text-sm font-bold text-white leading-snug">{selectedItem.title}</h3>
              </div>

              {/* Key metadata grid */}
              <div className="grid grid-cols-2 gap-3.5 bg-slate-950 border border-slate-850 p-3.5 rounded-lg text-xs font-mono text-slate-400">
                <div>
                  <span className="text-slate-600 block">{isVi ? 'Độ phân giải:' : 'Resolution:'}</span>
                  <span className="text-slate-300 font-bold">{selectedItem.resolution}</span>
                </div>
                <div>
                  <span className="text-slate-600 block">{isVi ? 'Kích thước tệp:' : 'File Size:'}</span>
                  <span className="text-slate-300 font-bold">
                    {(selectedItem.estimatedSize / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 block">{isVi ? 'Loại nội dung:' : 'Media Type:'}</span>
                  <span className="text-slate-300 font-bold capitalize">{selectedItem.mediaType}</span>
                </div>
                <div>
                  <span className="text-slate-600 block">{isVi ? 'Thời gian hoàn thành:' : 'Completed on:'}</span>
                  <span className="text-slate-300">{selectedItem.publishDate}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-600 block">{isVi ? 'Vị trí lưu trữ cục bộ:' : 'Local Saved Destination:'}</span>
                  <span className="text-slate-400 break-all text-[11px]">
                    {selectedItem.filePath || 'C:\\Users\\Downloads\\media_item.mp4'}
                  </span>
                </div>
              </div>

              {/* Actions panel */}
              <div className="flex items-center space-x-3 pt-2">
                <a
                  href={selectedItem.thumbnail}
                  download={selectedItem.title}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <FileCheck2 className="h-4 w-4" />
                  <span>{isVi ? 'Mở tệp đã tải' : 'Open / Export File'}</span>
                </a>

                <button
                  onClick={() => {
                    alert(isVi ? `Đang mở thư mục: ${selectedItem.filePath}` : `Opening directory: ${selectedItem.filePath}`);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold px-5 py-2.5 rounded-lg flex items-center space-x-2 transition-colors cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>{isVi ? 'Xem thư mục' : 'Show in Folder'}</span>
                </button>

                <a
                  href={selectedItem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 p-2.5 rounded-lg transition-colors border border-slate-850"
                  title={isVi ? 'Mở liên kết gốc' : 'Open Source Link'}
                >
                  <ExternalLink className="h-4.5 w-4.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
