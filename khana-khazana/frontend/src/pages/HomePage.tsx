import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  MessageSquareText,
  QrCode,
  Users,
  Utensils,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { AI_PILLARS } from '../../../backend/engine/data';
import type { ZonePreference } from '../../../backend/engine/types';
import { CulinaryHeroCarousel } from '../components/CulinaryHeroCarousel';
import { LateralSlideCard, RaindropHeader } from '../components/MotionPrimitives';
import { QRCodeSvg } from '../components/QRCodeSvg';

export function HomePage() {
  const {
    navigate,
    tables,
    orders,
    floorEfficiency,
    fairnessAudit,
    benchmarks,
  } = useRestaurant();

  const [quickGuests, setQuickGuests] = useState(4);
  const [quickZone, setQuickZone] = useState<ZonePreference>('Main Hall');
  const [quickWheelchair, setQuickWheelchair] = useState(false);
  const [expandedPillarId, setExpandedPillarId] = useState<string>(
    AI_PILLARS[0].id,
  );
  const [heroPlateFailed, setHeroPlateFailed] = useState(false);

  const freeCount = tables.filter((t) => t.status === 'Free').length;
  const payingCount = tables.filter((t) => t.status === 'Paying').length;
  const activeOrdersCount = orders.filter((o) => o.status !== 'Served').length;
  const tableT3 = tables.find((t) => t.id === 'T3');
  const t3BookingId = tableT3?.activeBookingId ?? null;

  const maxExpandedNodes = Math.max(
    1,
    ...benchmarks.map((b) => b.nodesExpanded),
  );

  const handleQuickBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        'kk_quick_booking_prefill',
        JSON.stringify({
          partySize: quickGuests,
          preferredZone: quickZone,
          needsWheelchair: quickWheelchair,
        }),
      );
    }
    navigate('/book');
  };

  return (
    <div className="overflow-x-clip bg-[#F5EFE6] text-[#111827]">
      {/* Full-Bleed 4K 5-Dish Cinematic Hero Carousel */}
      <CulinaryHeroCarousel />

      {/* Continuous Single-Line Pill Quick Booking Bar */}
      <section className="relative z-30 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 mb-12">
        <form
          onSubmit={handleQuickBook}
          className="rounded-3xl md:rounded-full shadow-xl bg-[#FBF8F2] border border-[#DCD0BE] px-4 py-3 md:px-3 md:py-2 flex flex-col md:flex-row items-stretch md:items-center divide-y md:divide-y-0 md:divide-x divide-[#DCD0BE] gap-3 md:gap-0"
        >
          <div className="md:flex-1 px-2 md:px-4 pt-1 md:pt-0">
            <label
              htmlFor="quick-guests"
              className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#DC2626] font-semibold"
            >
              Party Size
            </label>
            <select
              id="quick-guests"
              value={quickGuests}
              onChange={(e) => setQuickGuests(Number(e.target.value))}
              className="w-full bg-transparent text-sm font-medium text-[#111827] py-1 focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'Guest' : 'Guests'}
                </option>
              ))}
            </select>
          </div>

          <div className="md:flex-1 px-2 md:px-4 pt-2 md:pt-0">
            <label
              htmlFor="quick-zone"
              className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#DC2626] font-semibold"
            >
              Dining Zone
            </label>
            <select
              id="quick-zone"
              value={quickZone}
              onChange={(e) => setQuickZone(e.target.value as ZonePreference)}
              className="w-full bg-transparent text-sm font-medium text-[#111827] py-1 focus:outline-none"
            >
              <option value="Main Hall">Main Hall</option>
              <option value="Window">Window Seating</option>
              <option value="VIP Lounge">VIP Lounge</option>
              <option value="ANY">Any Optimal Zone</option>
            </select>
          </div>

          <div className="md:flex-1 px-2 md:px-4 pt-2 md:pt-0 flex items-center justify-between">
            <div>
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#059669] font-semibold">
                Accessibility
              </span>
              <span className="text-sm font-medium text-[#111827]">
                Step-Free Table
              </span>
            </div>
            <button
              type="button"
              onClick={() => setQuickWheelchair((prev) => !prev)}
              aria-pressed={quickWheelchair}
              aria-label="Toggle step-free wheelchair seating"
              className={`px-3 py-1 rounded-full font-mono text-xs font-semibold transition-colors ${
                quickWheelchair
                  ? 'bg-[#059669] text-white'
                  : 'bg-[#ECE3D3] text-neutral-700 border border-[#DCD0BE] hover:border-[#059669]'
              }`}
            >
              {quickWheelchair ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="pt-3 md:pt-0 md:pl-3 shrink-0">
            <button
              type="submit"
              className="w-full md:w-auto px-6 py-3 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Users className="w-4 h-4" />
              Check Live Availability
            </button>
          </div>
        </form>
      </section>

      {/* 1. Architectural Hairline Telemetry Ribbon (Zero Box Cards) */}
      <section
        aria-label="Live Floor Telemetry"
        className="border-y border-[#DCD0BE] bg-[#F5EFE6]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#DCD0BE]">
            {[
              {
                label: 'Tables Free Now',
                value: `${freeCount} / ${tables.length}`,
                status: `${floorEfficiency.accessibleAvailableCount} step-free ready`,
              },
              {
                label: 'Paying Pre-Alloc',
                value: `${payingCount} Tables`,
                status: 'P(Free₁₀ | Billing) ≥ 75%',
              },
              {
                label: 'Orders in Kitchen',
                value: `${activeOrdersCount} Active`,
                status: 'Atomic pantry stock verified',
              },
              {
                label: 'Fairness Parity',
                value: `${fairnessAudit.fairnessScorePct}%`,
                status: `Δ ${fairnessAudit.deltaFairnessMins}m ≤ 8.0m threshold`,
              },
            ].map((stat, idx) => (
              <LateralSlideCard key={stat.label} index={idx}>
                <div className="py-8 px-4 sm:px-6 lg:px-8">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
                    {stat.label}
                  </p>
                  <p className="font-serif text-4xl sm:text-5xl font-bold text-[#111827] mt-2 tabular-nums">
                    {stat.value}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-[#047857]">
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full bg-[#059669] inline-block shrink-0"
                    />
                    <span>{stat.status}</span>
                  </p>
                </div>
              </LateralSlideCard>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Full-Bleed 50/50 Split Editorial Band: In-Dining QR Experience */}
      <section className="border-b border-[#DCD0BE] bg-[#F5EFE6]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 items-stretch">
          <LateralSlideCard index={0} className="px-4 sm:px-8 lg:px-12 py-16 lg:py-20 flex flex-col justify-between">
            <div className="space-y-5">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#DC2626] font-semibold">
                01 — In-Dining QR Experience · Table T3
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#111827] leading-[1.15] text-balance">
                Scan Table QR Code to Order with Real-Time Kitchen Stock Protection
              </h2>
              <p className="text-base text-neutral-600 leading-relaxed max-w-xl">
                Every seated guest scans their table-bound QR code to browse dishes and
                place orders directly. Our kitchen engine verifies exact recipe
                ingredient quantities in under 1.2 seconds—never letting a guest wait
                for an unavailable dish.
              </p>
            </div>

            <div className="pt-8 mt-8 border-t border-[#DCD0BE] flex flex-wrap items-center gap-6">
              <button
                type="button"
                onClick={() => navigate('/table/T3/menu')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold text-sm transition-colors"
              >
                <QrCode className="w-4 h-4" />
                Order at Table T3 (QR Menu)
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/concierge')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#047857] hover:text-[#059669] border-b border-[#059669]/40 pb-1 transition-colors"
              >
                <MessageSquareText className="w-4 h-4" />
                Ask AI Concierge
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </LateralSlideCard>

          <LateralSlideCard
            index={1}
            className="bg-[#ECE3D3] border-t lg:border-t-0 lg:border-l border-[#DCD0BE] flex flex-col"
          >
            <div className="relative flex-1 min-h-[280px] overflow-hidden bg-[#E5DAC6]">
              {!heroPlateFailed ? (
                <img
                  src="/images/culinary_heritage_plating_1794675538229.jpg"
                  alt="Khana-Khazana Fine Indian Culinary Plating"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroPlateFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-[#DC2626]">
                  <Utensils className="w-10 h-10 mb-2" />
                  <span className="font-serif text-lg">Signature Culinary Craft</span>
                </div>
              )}
            </div>

            <div className="p-6 sm:p-8 border-t border-[#DCD0BE] flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#059669] font-semibold">
                  {t3BookingId ? `Active Dining Pass · ${t3BookingId}` : 'Instant Table QR Ordering'}
                </p>
                <h3 className="font-serif text-2xl font-bold text-[#111827]">
                  Table T3 · Lotus West
                </h3>
                <p className="text-xs text-neutral-600">
                  {t3BookingId
                    ? `Bound to Booking ${t3BookingId} · Atomic recipe pantry protection enabled`
                    : 'Step-Free Main Hall · Atomic recipe pantry protection enabled'}
                </p>
              </div>
              <div className="shrink-0">
                <QRCodeSvg
                  value={
                    t3BookingId
                      ? `https://khana-khazana.app/table/T3/menu?booking=${t3BookingId}`
                      : 'https://khana-khazana.app/table/T3/menu'
                  }
                  size={104}
                  label={t3BookingId ? `TABLE T3 · PASS ${t3BookingId}` : 'TABLE T3 · QR MENU'}
                />
              </div>
            </div>
          </LateralSlideCard>
        </div>
      </section>

      {/* 3. Interactive Horizontal Accordion Rows (Replaces Generic Grid Cards) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <RaindropHeader
          kicker="02 — Autonomous Hospitality Architecture"
          title="Six Intelligence Engines Orchestrating Every Seat"
          subtitle="Click any horizontal row to inspect live mathematical heuristics, benchmark comparisons, and jump directly to the synchronized interactive tool."
        />

        <div className="mt-12 border-t border-[#DCD0BE]">
          {AI_PILLARS.map((pillar, idx) => {
            const isOpen = expandedPillarId === pillar.id;
            const indexNum = String(idx + 1).padStart(2, '0');
            return (
              <div
                key={pillar.id}
                className={`border-b border-[#DCD0BE] transition-colors ${
                  isOpen ? 'bg-[#ECE3D3]' : 'bg-[#F5EFE6] hover:bg-[#EFE6D8]'
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedPillarId((prev) =>
                      prev === pillar.id ? '' : pillar.id,
                    )
                  }
                  aria-expanded={isOpen}
                  className="w-full py-6 px-3 sm:px-4 text-left flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-baseline gap-4 sm:gap-6 min-w-0">
                    <span className="font-mono text-xs font-semibold text-[#DC2626] shrink-0">
                      {indexNum} —
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                        {pillar.unitLabel}
                      </p>
                      <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#111827] mt-0.5">
                        {pillar.title}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 pl-9 md:pl-0 shrink-0">
                    <div className="text-left md:text-right">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 block">
                        {pillar.metricLabel}
                      </span>
                      <span className="font-mono text-sm font-semibold text-[#047857] tabular-nums">
                        {pillar.metricValue}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-neutral-500 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#DC2626]' : ''
                      }`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 sm:px-4 pb-7 pt-2 pl-9 sm:pl-14 space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="lg:col-span-7 space-y-3">
                        <p className="text-sm text-neutral-700 leading-relaxed">
                          {pillar.description}
                        </p>
                        <div className="pt-1 font-mono text-xs text-[#111827] border-l-2 border-[#DC2626] pl-3">
                          {pillar.formula}
                        </div>
                      </div>

                      <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                        {idx === 0 && (
                          <div className="space-y-2.5">
                            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                              Live Search Benchmark (Nodes Expanded)
                            </p>
                            {benchmarks.map((b) => {
                              const pct = Math.max(
                                12,
                                Math.round((b.nodesExpanded / maxExpandedNodes) * 100),
                              );
                              return (
                                <div key={b.algorithm} className="space-y-1">
                                  <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                                    <span
                                      className={
                                        b.isOptimal
                                          ? 'font-semibold text-[#047857]'
                                          : 'text-neutral-600'
                                      }
                                    >
                                      {b.algorithm}
                                    </span>
                                    <span
                                      className={
                                        b.isOptimal
                                          ? 'font-semibold text-[#047857]'
                                          : 'text-[#DC2626]'
                                      }
                                    >
                                      {b.nodesExpanded} nodes · {b.seatUtilizationPct}% util
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full bg-[#DCD0BE] overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-300 ${
                                        b.isOptimal ? 'bg-[#059669]' : 'bg-[#DC2626]'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-[#DCD0BE]">
                          <span className="text-xs text-neutral-500">
                            {pillar.subtitle}
                          </span>
                          <button
                            type="button"
                            onClick={() => navigate(pillar.targetRoute)}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#DC2626] hover:text-[#B91C1C] whitespace-nowrap shrink-0 ml-4"
                          >
                            Open Module
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Synchronized Admin Command Strip (Bordered Editorial Band) */}
      <section className="border-t border-[#DCD0BE] bg-[#ECE3D3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
              03 — Synchronized Management Suite
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#111827] mt-2">
              Inspect Live Floor Command, Benchmark Search Models, or Toggle Kitchen Stock
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/admin/dashboard')}
              className="px-5 py-2.5 rounded-full border border-[#C9BCAA] bg-[#FBF8F2] text-sm font-semibold text-[#111827] hover:border-[#DC2626] hover:text-[#DC2626] transition-colors inline-flex items-center gap-2"
            >
              Floor Command
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/algorithms')}
              className="px-5 py-2.5 rounded-full border border-[#C9BCAA] bg-[#FBF8F2] text-sm font-semibold text-[#111827] hover:border-[#059669] hover:text-[#047857] transition-colors inline-flex items-center gap-2"
            >
              AI Search & ML Lab
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/agents')}
              className="px-6 py-2.5 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
            >
              Agents & Kitchen Inventory
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
