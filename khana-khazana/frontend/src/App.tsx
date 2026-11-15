import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  extractTableIdFromPath,
  RestaurantProvider,
  useRestaurant,
} from './context/RestaurantContext';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { BookPage } from './pages/BookPage';
import { TableMenuPage } from './pages/TableMenuPage';
import { DashboardPage } from './pages/DashboardPage';
import { AlgorithmsPage } from './pages/AlgorithmsPage';
import { AlgorithmScenariosPage } from './pages/AlgorithmScenariosPage';
import { AgentsPage } from './pages/AgentsPage';
import { AssistantPage } from './pages/AssistantPage';

function AppShell() {
  const { currentPath, navigate } = useRestaurant();

  const renderPage = () => {
    const tableId = extractTableIdFromPath(currentPath);
    let pageContent: React.ReactNode;

    if (tableId) {
      pageContent = <TableMenuPage tableId={tableId} />;
    } else {
      switch (currentPath) {
        case '/book':
          pageContent = <BookPage />;
          break;
        case '/concierge':
        case '/admin/assistant':
          pageContent = <AssistantPage />;
          break;
        case '/admin/dashboard':
          pageContent = <DashboardPage />;
          break;
        case '/admin/algorithms':
          pageContent = <AlgorithmsPage />;
          break;
        case '/admin/scenarios':
          pageContent = <AlgorithmScenariosPage />;
          break;
        case '/admin/agents':
          pageContent = <AgentsPage />;
          break;
        case '/':
        default:
          pageContent = <HomePage />;
          break;
      }
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPath}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {pageContent}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5EFE6] text-[#111827]">
      <Navbar />

      <main className="flex-1">{renderPage()}</main>

      <footer className="bg-[#111827] border-t border-neutral-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
            <div>
              <h2 className="font-serif text-xl font-bold text-white">
                Khana-Khazana
              </h2>
              <p className="text-sm text-neutral-300 mt-2.5 max-w-xs leading-relaxed">
                Where Culinary Heritage Meets Autonomous Intelligence. Fine Indian
                dining powered by dual-portal hospitality orchestration.
              </p>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#FCA5A5] mb-3">
                Customer Portal
              </p>
              <div className="flex flex-col gap-2 text-sm text-neutral-300">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-left hover:text-white transition-colors"
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/book')}
                  className="text-left hover:text-white transition-colors"
                >
                  Book a Table
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/table/T3/menu')}
                  className="text-left hover:text-white transition-colors"
                >
                  Scan QR Menu (T3)
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/concierge')}
                  className="text-left hover:text-white transition-colors"
                >
                  AI Concierge
                </button>
              </div>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6EE7B7] mb-3">
                Admin Command
              </p>
              <div className="flex flex-col gap-2 text-sm text-neutral-300">
                <button
                  type="button"
                  onClick={() => navigate('/admin/dashboard')}
                  className="text-left hover:text-white transition-colors"
                >
                  Floor Command
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/algorithms')}
                  className="text-left hover:text-white transition-colors"
                >
                  AI Search & ML Lab
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/scenarios')}
                  className="text-left hover:text-white transition-colors"
                >
                  Algorithm Scenarios
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/agents')}
                  className="text-left hover:text-white transition-colors"
                >
                  Multi-Agent & Inventory
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/assistant')}
                  className="text-left hover:text-white transition-colors"
                >
                  Grounded Maître D’
                </button>
              </div>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3">
                Dining Hours & Zones
              </p>
              <p className="text-sm text-neutral-200">
                Open Daily: 11:30 – 23:30 (Kitchen closes 23:00)
              </p>
              <p className="font-mono text-xs text-neutral-400 mt-2">
                Zones: Window · Main Hall · VIP Lounge
              </p>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400 font-mono">
            <span>© {new Date().getFullYear()} Khana-Khazana Hospitality</span>
            <span>Deterministic Rules R1–R3 · Atomic Recipe Inventory Sync</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <RestaurantProvider>
      <AppShell />
    </RestaurantProvider>
  );
}
