import React, { useEffect } from 'react';
import { useAppStore } from './stores/useAppStore';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Downloader } from './pages/Downloader';
import { Queue } from './pages/Queue';
import { MediaBrowser } from './pages/MediaBrowser';
import { History } from './pages/History';
import { Logs } from './pages/Logs';
import { Settings } from './pages/Settings';
import { About } from './pages/About';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const {
    activeTab,
    fetchSettings,
    fetchStats,
    fetchQueue,
    fetchHistory,
    fetchLogs,
    settings,
  } = useAppStore();

  useEffect(() => {
    fetchSettings();
    fetchStats();
    fetchQueue();
    fetchHistory();
    fetchLogs();
  }, [fetchSettings, fetchStats, fetchQueue, fetchHistory, fetchLogs]);

  // Set initial theme classes on boot
  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      if (settings.theme === 'dark') {
        root.classList.add('dark');
      } else if (settings.theme === 'light') {
        root.classList.remove('dark');
      } else {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemDark) root.classList.add('dark');
        else root.classList.remove('dark');
      }
    }
  }, [settings]);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'downloader':
        return <Downloader />;
      case 'queue':
        return <Queue />;
      case 'media':
        return <MediaBrowser />;
      case 'history':
        return <History />;
      case 'logs':
        return <Logs />;
      case 'settings':
        return <Settings />;
      case 'about':
        return <About />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main workspace area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {/* Header toolbar */}
        <Header />

        {/* Dynamic page container with slide-fade transition */}
        <main className="flex-1 overflow-y-auto bg-slate-950">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="h-full flex flex-col"
            >
              {renderActiveTab()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
