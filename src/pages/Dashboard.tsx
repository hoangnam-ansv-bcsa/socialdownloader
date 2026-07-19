import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  Download,
  Gauge,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { stats, settings, setTab } = useAppStore();
  const isVi = settings?.language === 'vi';

  const statCards = [
    {
      title: isVi ? 'Tốc độ tải hiện tại' : 'Current Download Speed',
      value: stats?.currentSpeed || '0 KB/s',
      sub: stats?.queueStatus === 'running' ? (isVi ? 'Đang hoạt động' : 'Active queue processing') : (isVi ? 'Hàng đợi trống' : 'Queue idle'),
      color: 'from-blue-500 to-cyan-500',
      icon: Gauge,
    },
    {
      title: isVi ? 'Tải hôm nay' : "Today's Downloads",
      value: stats?.todayDownloads ?? 0,
      sub: isVi ? 'Mục hoàn thành hôm nay' : 'Items fully processed today',
      color: 'from-emerald-500 to-teal-500',
      icon: TrendingUp,
    },
    {
      title: isVi ? 'Hoàn thành' : 'Completed Downloads',
      value: stats?.completedDownloads ?? 0,
      sub: isVi ? 'Lưu trữ cục bộ an toàn' : 'Stored securely offline',
      color: 'from-indigo-500 to-purple-500',
      icon: CheckCircle2,
    },
    {
      title: isVi ? 'Số tác vụ thất bại' : 'Failed Tasks',
      value: stats?.failedDownloads ?? 0,
      sub: isVi ? 'Có thể thử lại tức thì' : 'Click to retry instantly',
      color: 'from-rose-500 to-orange-500',
      icon: AlertCircle,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles className="h-40 w-40 text-blue-400" />
        </div>
        <div className="relative z-10 max-w-xl">
          <h3 className="text-xl font-bold text-white tracking-tight">
            {isVi ? 'Chào mừng trở lại, người dùng!' : 'Welcome back, User!'}
          </h3>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            {isVi
              ? 'Tải hàng loạt không giới hạn hình ảnh, video chất lượng cao từ TikTok, Youtube, Bilibili, Instagram, Facebook và nhiều nền tảng khác. Quản lý tệp của bạn một cách tập trung và thông minh.'
              : 'Bulk download high-fidelity images, videos, and albums from TikTok, YouTube, Bilibili, Instagram, and more. Manage all downloaded media in one high-performance command station.'}
          </p>
          <div className="mt-5 flex items-center space-x-3">
            <button
              onClick={() => setTab('downloader')}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4.5 py-2.5 rounded-lg transition-all duration-150 shadow-md shadow-blue-900/30 cursor-pointer"
            >
              <span>{isVi ? 'Tải Tác Vụ Mới' : 'Start New Download'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setTab('about')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-4.5 py-2.5 rounded-lg border border-slate-700 transition-colors duration-150 cursor-pointer"
            >
              {isVi ? 'Xem Tài Liệu' : 'View Docs'}
            </button>
          </div>
        </div>
      </div>

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all duration-150 group flex items-start justify-between"
            >
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-400 font-sans">{card.title}</span>
                <div className="text-2xl font-bold text-white tracking-tight font-mono">{card.value}</div>
                <p className="text-[11px] text-slate-500">{card.sub}</p>
              </div>
              <div className={`bg-gradient-to-tr ${card.color} p-2.5 rounded-lg text-white`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Storage and Platform Support Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Storage card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <HardDrive className="h-4 w-4 text-blue-500" />
              <span>{isVi ? 'Dung lượng ổ đĩa' : 'Disk Storage usage'}</span>
            </h4>
            <span className="text-xs font-mono text-slate-400">
              {stats ? (100 - (stats.diskUsedGB / (stats.diskUsedGB + stats.diskFreeGB)) * 100).toFixed(0) : 86}%{' '}
              {isVi ? 'trống' : 'free'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{
                  width: `${stats ? (stats.diskUsedGB / (stats.diskUsedGB + stats.diskFreeGB)) * 100 : 14}%`,
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs font-mono text-slate-500">
              <span>Used: {stats?.diskUsedGB ?? 34.2} GB</span>
              <span>Total: 250.0 GB</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/60 space-y-2 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>{isVi ? 'Thư mục mặc định:' : 'Target Download Folder:'}</span>
              <span className="font-mono text-slate-500 text-[11px] text-right truncate max-w-[180px]">
                {settings?.defaultDownloadFolder || 'C:\\Users\\Downloads'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{isVi ? 'Hàng đợi tiến trình:' : 'Queue workers:'}</span>
              <span className="font-mono text-slate-300">
                {settings?.concurrentDownloads || 5} {isVi ? 'luồng song song' : 'concurrent threads'}
              </span>
            </div>
          </div>
        </div>

        {/* Support Platforms Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 lg:col-span-2 space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center space-x-2">
            <Download className="h-4 w-4 text-purple-500" />
            <span>{isVi ? 'Đang hỗ trợ tải từ' : 'Supported Media Platforms'}</span>
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              { name: 'TikTok', count: 'Videos, Images, MP3s' },
              { name: 'YouTube', count: 'Shorts, Videos' },
              { name: 'Instagram', count: 'Reels, Posts, Albums' },
              { name: 'Facebook', count: 'Watch, Stories' },
              { name: 'Bilibili', count: 'Anime, Shows' },
              { name: 'Xiaohongshu', count: 'High-res Images' },
              { name: 'Douyin', count: 'No-Watermark Video' },
              { name: 'Kuaishou', count: 'Creator Videos' },
              { name: 'Pinterest', count: 'Pins, Board Pins' },
            ].map((plat, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-850 rounded-lg p-2.5 hover:border-slate-800 transition-colors flex flex-col justify-center"
              >
                <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>{plat.name}</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5">{plat.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic Instruction tip */}
      <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-4 flex items-start space-x-3">
        <Sparkles className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h5 className="text-xs font-bold text-blue-400">
            {isVi ? 'Tính Năng Nổi Bật: Phân Tích Thông Minh Bằng Gemini AI' : 'Pro Tip: Intelligent Media Analysis via Gemini AI'}
          </h5>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isVi
              ? 'Khi bạn dán các liên kết vào trình tải hàng loạt, hệ thống sẽ sử dụng Gemini AI (hoạt động hoàn toàn trên máy chủ) để phân tích chi tiết dữ liệu: tên tác giả, tiêu đề bài viết, ảnh bìa sắc nét, thời lượng, độ phân giải và dung lượng dự kiến trước khi bắt đầu tải về!'
              : 'When pasting social media links in the batch downloader, our server-side Gemini AI model automatically analyzes and extracts highly accurate titles, clean author names, high-res thumbnails, durations, and estimates file sizes prior to committing storage!'}
          </p>
        </div>
      </div>
    </div>
  );
};
