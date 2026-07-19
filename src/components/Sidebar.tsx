import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  LayoutDashboard,
  Download,
  ListCollapse,
  Play,
  History,
  FolderOpen,
  Terminal,
  Settings,
  Info,
  Layers,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setTab, queue, settings } = useAppStore();

  const activeQueueCount = queue.filter(
    (item) => item.status === 'downloading' || item.status === 'pending'
  ).length;

  const isVi = settings?.language === 'vi';

  interface MenuItem {
    id: 'dashboard' | 'downloader' | 'queue' | 'media' | 'history' | 'logs' | 'settings' | 'about';
    label: string;
    icon: React.ComponentType<any>;
    badge?: number;
  }

  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: isVi ? 'Bảng điều khiển' : 'Dashboard', icon: LayoutDashboard },
    { id: 'downloader', label: isVi ? 'Tải hàng loạt' : 'Batch Downloader', icon: Download },
    {
      id: 'queue',
      label: isVi ? 'Hàng đợi tải' : 'Download Queue',
      icon: ListCollapse,
      badge: activeQueueCount > 0 ? activeQueueCount : undefined,
    },
    { id: 'media', label: isVi ? 'Thư viện phương tiện' : 'Media Library', icon: FolderOpen },
    { id: 'history', label: isVi ? 'Lịch sử tải' : 'Download History', icon: History },
    { id: 'logs', label: isVi ? 'Nhật ký hệ thống' : 'Developer Logs', icon: Terminal },
    { id: 'settings', label: isVi ? 'Cài đặt' : 'Settings', icon: Settings },
    { id: 'about', label: isVi ? 'Về ứng dụng' : 'About App', icon: Info },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between text-slate-300">
      <div>
        {/* Brand/Logo Area */}
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-none">Universal</h1>
            <p className="text-[10px] text-slate-400 font-mono mt-1">SOCIAL DOWNLOADER</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white text-blue-600' : 'bg-blue-600/20 text-blue-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-center text-xs text-slate-500 font-mono">
        <div>v2.1.4 • {isVi ? 'Bản Nội Bộ' : 'Standalone'}</div>
        <div className="mt-1 text-[10px] text-slate-600">Local DB Mode (SQLite-JSON)</div>
      </div>
    </aside>
  );
};
