import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Menu, Shield, UserCheck, X } from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';

interface NavLinkItem {
  label: string;
  path: string;
  matchPrefix?: string;
}

const CUSTOMER_LINKS: NavLinkItem[] = [
  { label: 'Home', path: '/' },
  { label: 'Book a Table', path: '/book' },
  { label: 'Scan QR Menu', path: '/table/T3/menu', matchPrefix: '/table/' },
  { label: 'AI Concierge', path: '/concierge' },
];

const ADMIN_LINKS: NavLinkItem[] = [
  { label: 'Floor Command', path: '/admin/dashboard' },
  { label: 'Search & ML Lab', path: '/admin/algorithms' },
  { label: 'Algo Scenarios', path: '/admin/scenarios' },
  { label: 'Agents & Inventory', path: '/admin/agents' },
  { label: "Grounded Maître D'", path: '/admin/assistant' },
];

export function Navbar() {
  const {
    currentPath,
    portalMode,
    setPortalMode,
    navigate,
    dbConnected,
    isDbLoading,
    lastLatencyMs,
  } = useRestaurant();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 60);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isLightHeader = currentPath !== '/' || isScrolled || mobileOpen;
  const activeLinks = portalMode === 'admin' ? ADMIN_LINKS : CUSTOMER_LINKS;

  const isLinkActive = (item: NavLinkItem) => {
    if (item.matchPrefix && currentPath.startsWith(item.matchPrefix)) {
      return true;
    }
    return currentPath === item.path;
  };

  const handleNavClick = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isLightHeader
          ? 'bg-[#F5EFE6]/95 backdrop-blur-md border-b border-[#DCD0BE]'
          : 'bg-transparent border-b border-white/15'
      }`}
    >
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-2 xl:gap-3">
        {/* Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick(portalMode === 'admin' ? '/admin/dashboard' : '/')}
          className="text-left group shrink-0 whitespace-nowrap"
          aria-label="Khana-Khazana Home"
        >
          <span
            className={`font-serif text-lg xl:text-xl font-bold tracking-tight transition-colors ${
              isLightHeader ? 'text-[#111827]' : 'text-white'
            }`}
          >
            Khana-Khazana
          </span>
        </button>

        {/* Portal Switcher Control */}
        <div
          role="group"
          aria-label="Portal Switcher"
          className={`hidden md:inline-flex items-center p-0.5 rounded-full border shrink-0 transition-colors ${
            isLightHeader
              ? 'bg-[#ECE3D3] border-[#DCD0BE]'
              : 'bg-black/35 border-white/25 backdrop-blur-md'
          }`}
        >
          <button
            type="button"
            onClick={() => setPortalMode('customer')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
              portalMode === 'customer'
                ? 'bg-[#DC2626] text-white'
                : isLightHeader
                ? 'text-neutral-600 hover:text-[#111827]'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <UserCheck className="w-3 h-3" />
            Customer Portal
          </button>
          <button
            type="button"
            onClick={() => setPortalMode('admin')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
              portalMode === 'admin'
                ? 'bg-[#DC2626] text-white'
                : isLightHeader
                ? 'text-neutral-600 hover:text-[#111827]'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Shield className="w-3 h-3" />
            Admin Command
          </button>
        </div>

        {/* Clean Typographic Navigation Links with Crimson Active Underline */}
        <nav
          aria-label="Primary Navigation"
          className="hidden xl:flex items-center gap-3.5"
        >
          {activeLinks.map((item) => {
            const active = isLinkActive(item);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNavClick(item.path)}
                className={`relative px-0.5 py-2 text-[12.5px] font-medium whitespace-nowrap transition-colors ${
                  active
                    ? isLightHeader
                      ? 'text-[#DC2626] font-semibold'
                      : 'text-white font-semibold'
                    : isLightHeader
                    ? 'text-neutral-600 hover:text-[#111827]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {item.label}
                {active && (
                  <motion.span
                    layoutId="activeNavUnderline"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[#DC2626]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Emerald Live Sync Indicator + Mobile Drawer Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`hidden lg:inline-flex items-center gap-1.5 font-mono text-[10px] xl:text-[10.5px] font-medium whitespace-nowrap tabular-nums ${
              dbConnected
                ? isLightHeader
                  ? 'text-[#047857]'
                  : 'text-emerald-300'
                : isLightHeader
                ? 'text-amber-700'
                : 'text-amber-300'
            }`}
          >
            <span
              aria-hidden="true"
              className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
                dbConnected
                  ? 'bg-[#059669]'
                  : isDbLoading
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-[#DC2626]'
              }`}
            />
            {isDbLoading
              ? 'Connecting NeonDB... | Groq GPT-OSS-120B'
              : dbConnected
              ? `NeonDB: ${lastLatencyMs ?? 0}ms | Groq GPT-OSS-120B`
              : 'NeonDB Offline | Groq GPT-OSS-120B'}
          </span>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className={`xl:hidden p-2 border transition-colors ${
              isLightHeader
                ? 'border-[#DCD0BE] bg-[#FBF8F2] text-[#111827] hover:border-[#DC2626]'
                : 'border-white/25 bg-black/30 text-white hover:border-white'
            }`}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Responsive Tablet / Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="xl:hidden bg-[#F5EFE6] border-t border-[#DCD0BE] px-4 py-4 space-y-3 shadow-lg">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPortalMode('customer');
                setMobileOpen(false);
              }}
              className={`flex-1 py-2.5 px-3 text-xs font-semibold border transition-colors ${
                portalMode === 'customer'
                  ? 'bg-[#DC2626] border-[#DC2626] text-white'
                  : 'bg-[#ECE3D3] border-[#DCD0BE] text-neutral-700'
              }`}
            >
              Customer Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalMode('admin');
                setMobileOpen(false);
              }}
              className={`flex-1 py-2.5 px-3 text-xs font-semibold border transition-colors ${
                portalMode === 'admin'
                  ? 'bg-[#DC2626] border-[#DC2626] text-white'
                  : 'bg-[#ECE3D3] border-[#DCD0BE] text-neutral-700'
              }`}
            >
              Admin Command
            </button>
          </div>

          <div className="divide-y divide-[#DCD0BE] border-t border-[#DCD0BE]">
            {activeLinks.map((item) => {
              const active = isLinkActive(item);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNavClick(item.path)}
                  className={`w-full text-left py-3 px-2 text-sm font-medium transition-colors flex items-center justify-between ${
                    active ? 'text-[#DC2626] font-semibold' : 'text-[#111827]'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#DC2626]">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
