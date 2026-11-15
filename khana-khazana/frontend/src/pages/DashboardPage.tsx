import React, { useState } from 'react';
import {
  Accessibility,
  Crown,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  StepForward,
  UserCheck,
  X,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { computeBayesianTurnoverProb } from '../../../backend/engine/aiEngine';
import type { RestaurantTable, TableStatus } from '../../../backend/engine/types';
import { LateralSlideCard, RaindropHeader } from '../components/MotionPrimitives';
import { QRCodeSvg } from '../components/QRCodeSvg';
import { SvgFloorGrid } from '../components/SvgFloorGrid';

export function DashboardPage() {
  const {
    tables,
    queue,
    reservations,
    orders,
    waiters,
    events,
    xaiLogs,
    fairnessAudit,
    floorEfficiency,
    dbError,
    isDbLoading,
    lastLatencyMs,
    isAutoPlaying,
    setIsAutoPlaying,
    tickCount,
    selectedTableId,
    setSelectedTableId,
    simulateGuestArrival,
    cancelReservation,
    updateTableState,
    stepSimulationTick,
    resetFloor,
    navigate,
  } = useRestaurant();

  const [qrModalTable, setQrModalTable] = useState<RestaurantTable | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [clickMode, setClickMode] = useState<'toggle' | 'inspect'>('toggle');

  const waitingParties = queue.filter((p) => p.status === 'WAITING');
  const selectedTable: RestaurantTable | null =
    tables.find((t) => t.id === selectedTableId) ?? tables[0] ?? null;

  const handleSvgTableSelect = (tableId: string) => {
    setSelectedTableId(tableId);
    if (clickMode === 'toggle') {
      const target = tables.find((t) => t.id === tableId);
      if (target) {
        const nextStatus: TableStatus =
          target.status === 'Free' ? 'Occupied' : 'Free';
        updateTableState(tableId, nextStatus);
      }
    }
  };

  const selectedBayes = selectedTable
    ? computeBayesianTurnoverProb(
        selectedTable.status,
        selectedTable.currentCourse,
        selectedTable.elapsedMins,
      )
    : 0;

  const handleDispatch = async (id: string) => {
    setDispatchingId(id);
    setActionError('');
    try {
      await simulateGuestArrival(id);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to check in party.',
      );
    } finally {
      setDispatchingId(null);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setCancellingId(bookingId);
    setActionError('');
    try {
      await cancelReservation(bookingId);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to cancel reservation.',
      );
    } finally {
      setCancellingId(null);
    }
  };

  const activeOrders = orders.filter((o) => o.status !== 'Served');
  const preparingOrdersCount = orders.filter(
    (o) => o.status === 'Order Received' || o.status === 'Preparing',
  ).length;

  return (
    <div className="overflow-x-clip bg-[#F5EFE6] text-[#111827] pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <RaindropHeader
          asPageTitle
          kicker="Admin Command · Live Floor & Reservations Telemetry"
          title="Floor Command, Check-In Dispatch & Bayesian Inspector"
          subtitle="Check in confirmed bookings or walk-ins via A* Search, inspect per-table QR menu passes, and audit XAI seating fairness in real time."
        />

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsAutoPlaying((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border font-semibold text-xs transition-colors whitespace-nowrap ${
              isAutoPlaying
                ? 'border-[#059669] bg-[#059669] text-white'
                : 'border-[#059669] bg-[#ECFDF5] text-[#047857] hover:bg-[#059669] hover:text-white'
            }`}
          >
            {isAutoPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                Live Sync On (T{tickCount})
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Start Live Sync
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              void stepSimulationTick();
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#DC2626] text-white font-semibold text-xs hover:bg-[#B91C1C] transition-colors whitespace-nowrap"
          >
            <StepForward className="w-4 h-4" />
            Advance +1 Min Tick
          </button>
          <button
            type="button"
            onClick={() => {
              setActionError('');
              void resetFloor().catch((err) =>
                setActionError(
                  err instanceof Error ? err.message : 'Unable to reset floor.',
                ),
              );
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#C9BCAA] bg-[#F5EFE6] text-[#111827] font-medium text-xs hover:border-[#DC2626] hover:text-[#DC2626] transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Floor
          </button>
        </div>
      </div>

      {(dbError || actionError) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div
            role="alert"
            className="border border-[#DC2626]/40 bg-[#FEF2F2] text-[#B91C1C] px-4 py-3 text-xs font-medium"
          >
            {actionError || dbError}
          </div>
        </div>
      )}

      {/* Architectural Hairline Telemetry Ribbon (Zero Box KPI Cards) */}
      <section
        aria-label="Floor Command Telemetry"
        className="border-y border-[#DCD0BE] bg-[#F5EFE6]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#DCD0BE]">
            {[
              {
                label: 'Seat Utilization',
                value: `${floorEfficiency.seatEfficiencyPct}%`,
                sub: `${floorEfficiency.occupiedCount}/${tables.length} Active`,
              },
              {
                label: 'Avg Turnover',
                value: `${floorEfficiency.avgTurnoverRateMins} min`,
                sub: `${floorEfficiency.freeCount} Free · ${floorEfficiency.accessibleAvailableCount} Access`,
              },
              {
                label: 'Orders in Kitchen',
                value: `${activeOrders.length}`,
                sub: `${preparingOrdersCount} Preparing · ${orders.length} Total`,
              },
              {
                label: 'Fairness Score',
                value: `${fairnessAudit.fairnessScorePct}%`,
                sub: `Δ ${fairnessAudit.deltaFairnessMins}m ≤ 8.0m`,
              },
              {
                label: 'NeonDB Sync',
                value:
                  lastLatencyMs !== null
                    ? `${lastLatencyMs}ms`
                    : isDbLoading
                    ? '...'
                    : 'Offline',
                sub: `${reservations.length} Bookings Synced`,
              },
            ].map((kpi, idx) => (
              <LateralSlideCard key={kpi.label} index={idx}>
                <div className="py-6 px-4 sm:px-5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#DC2626] font-semibold block">
                    {kpi.label}
                  </span>
                  <span className="font-serif text-3xl sm:text-4xl font-bold text-[#111827] mt-1.5 block tabular-nums">
                    {kpi.value}
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#047857]">
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full bg-[#059669] inline-block shrink-0"
                    />
                    {kpi.sub}
                  </span>
                </div>
              </LateralSlideCard>
            ))}
          </div>
        </div>
      </section>

      {/* Main 3-Column Hairline Operations Split */}
      <section className="border-b border-[#DCD0BE] bg-[#F5EFE6]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-[#DCD0BE] items-stretch">
          {/* Left: Confirmed Reservations + Waiting Queue */}
          <LateralSlideCard
            index={0}
            className="lg:col-span-3 px-4 sm:px-6 py-8 space-y-6 bg-[#ECE3D3]"
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#DCD0BE]">
              <h2 className="font-serif text-xl font-bold text-[#111827] whitespace-nowrap">
                Arrivals ({waitingParties.length})
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#DC2626] font-semibold whitespace-nowrap">
                A* Dispatch
              </span>
            </div>

            {waitingParties.length === 0 ? (
              <p className="text-xs text-neutral-600 py-5 leading-relaxed">
                All parties seated. Create a new booking in the Customer Portal to test live sync.
              </p>
            ) : (
              <div className="divide-y divide-[#DCD0BE] border-b border-[#DCD0BE]">
                {waitingParties.map((party) => (
                  <div key={party.id} className="py-4 first:pt-0 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">
                          {party.name}
                        </p>
                        <p className="font-mono text-[11px] text-neutral-500 tabular-nums mt-0.5">
                          {party.bookingId ? `${party.bookingId} · ` : ''}
                          {party.size}p · {party.preferredZone} · {party.waitMins}m
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {party.isVip && (
                          <span
                            title="VIP Priority"
                            className="p-1 border border-[#DC2626]/30 bg-red-50 text-[#DC2626]"
                          >
                            <Crown className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {party.needsWheelchair && (
                          <span
                            title="Wheelchair Accessible"
                            className="p-1 border border-[#059669]/30 bg-emerald-50 text-[#047857]"
                          >
                            <Accessibility className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={dispatchingId === party.id}
                      onClick={() => handleDispatch(party.id)}
                      className="w-full py-2 px-3 rounded-full bg-[#DC2626] text-white font-mono text-xs font-semibold hover:bg-[#B91C1C] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {dispatchingId === party.id
                        ? 'Allocating...'
                        : party.bookingId
                        ? 'Guest Arrived (Check-In)'
                        : 'Run Optimal A* Allocation'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#059669] font-semibold">
                Recent NeonDB Reservations
              </p>
              {reservations.length === 0 ? (
                <p className="text-xs text-neutral-500 py-3 border-t border-[#DCD0BE]">
                  No reservations recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-[#DCD0BE] border-t border-[#DCD0BE]">
                  {reservations.slice(0, 5).map((res) => (
                    <div
                      key={res.bookingId}
                      className="py-2.5 flex items-center justify-between text-xs gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#111827] truncate">
                          {res.bookingId} · {res.guestName}
                        </p>
                        <p className="font-mono text-[10px] text-neutral-500">
                          {res.assignedTableIds.join('+')} · {res.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {res.status === 'CONFIRMED' && (
                          <button
                            type="button"
                            disabled={cancellingId === res.bookingId}
                            onClick={() => handleCancelBooking(res.bookingId)}
                            className="text-[11px] font-mono font-semibold text-neutral-600 hover:text-[#DC2626] disabled:opacity-50"
                          >
                            {cancellingId === res.bookingId ? '...' : 'Cancel'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/table/${res.assignedTableIds[0] ?? 'T3'}/menu`)
                          }
                          className="text-[11px] font-mono font-semibold text-[#DC2626] hover:underline"
                        >
                          QR Menu
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </LateralSlideCard>

          {/* Center: Interactive SVG 10-Table Floor Grid + Table Frame Inspector */}
          <LateralSlideCard
            index={1}
            className="lg:col-span-6 px-4 sm:px-6 lg:px-8 py-8 space-y-6 border-t lg:border-t-0 border-[#DCD0BE]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#ECE3D3] border border-[#DCD0BE] px-3.5 py-2.5 text-xs">
              <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-700 font-semibold">
                Node Click Behavior
              </span>
              <div
                role="group"
                aria-label="SVG Node Click Mode"
                className="inline-flex border border-[#C9BCAA] bg-[#FBF8F2] p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setClickMode('toggle')}
                  aria-pressed={clickMode === 'toggle'}
                  className={`px-3 py-1 font-mono text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    clickMode === 'toggle'
                      ? 'bg-[#DC2626] text-white'
                      : 'text-neutral-700 hover:text-[#111827]'
                  }`}
                >
                  Toggle Free ↔ Occupied
                </button>
                <button
                  type="button"
                  onClick={() => setClickMode('inspect')}
                  aria-pressed={clickMode === 'inspect'}
                  className={`px-3 py-1 font-mono text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    clickMode === 'inspect'
                      ? 'bg-[#111827] text-white'
                      : 'text-neutral-700 hover:text-[#111827]'
                  }`}
                >
                  Inspect Only
                </button>
              </div>
            </div>

            <SvgFloorGrid
              tables={tables}
              selectedTableId={selectedTable?.id ?? null}
              onSelectTable={handleSvgTableSelect}
            />

            {/* Frame & Bayesian Inspector */}
            {selectedTable && (
              <div className="pt-6 border-t border-[#DCD0BE] space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
                      Frame & Bayesian Turnover Inspector
                    </p>
                    <h3 className="font-serif text-xl font-bold text-[#111827] mt-0.5">
                      {selectedTable.label}
                    </h3>
                  </div>
                  <span className="font-mono text-sm font-semibold text-[#047857] tabular-nums">
                    P(Free₁₀ | {selectedTable.currentCourse}) ={' '}
                    {Math.round(selectedBayes * 100)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#DCD0BE] border border-[#DCD0BE] bg-[#ECE3D3] font-mono text-xs">
                  <div className="p-3">
                    <span className="text-neutral-500 block text-[10px]">Zone</span>
                    <span className="text-[#111827] font-semibold">
                      {selectedTable.zone}
                    </span>
                  </div>
                  <div className="p-3">
                    <span className="text-neutral-500 block text-[10px]">
                      Capacity
                    </span>
                    <span className="text-[#111827] font-semibold tabular-nums">
                      {selectedTable.capacity} Seats
                    </span>
                  </div>
                  <div className="p-3">
                    <span className="text-neutral-500 block text-[10px]">
                      Course Stage
                    </span>
                    <span className="text-[#111827] font-semibold">
                      {selectedTable.currentCourse}
                    </span>
                  </div>
                  <div className="p-3">
                    <span className="text-neutral-500 block text-[10px]">
                      Elapsed
                    </span>
                    <span className="text-[#111827] font-semibold tabular-nums">
                      {selectedTable.elapsedMins} mins
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-neutral-500 mr-1">
                      Update Status:
                    </span>
                    {(['Free', 'Occupied', 'Paying', 'Dirty'] as TableStatus[]).map(
                      (status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateTableState(selectedTable.id, status)}
                          className={`px-3 py-1.5 rounded-full font-mono text-xs border transition-colors ${
                            selectedTable.status === status
                              ? 'bg-[#DC2626] border-[#DC2626] text-white font-semibold'
                              : 'bg-[#F5EFE6] border-[#C9BCAA] text-neutral-700 hover:border-[#DC2626]'
                          }`}
                        >
                          {status}
                        </button>
                      ),
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQrModalTable(selectedTable)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#C9BCAA] bg-[#FBF8F2] text-xs font-semibold text-[#111827] hover:border-[#DC2626] hover:text-[#DC2626] transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Preview {selectedTable.id} QR Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/table/${selectedTable.id}/menu`)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#059669] text-xs font-semibold text-[#047857] hover:bg-[#059669] hover:text-white transition-colors"
                    >
                      Open {selectedTable.id} QR Menu
                    </button>
                  </div>
                </div>
              </div>
            )}
          </LateralSlideCard>

          {/* Right: Multi-Agent Ticker */}
          <LateralSlideCard
            index={2}
            className="lg:col-span-3 px-4 sm:px-6 py-8 space-y-5 bg-[#ECE3D3] border-t lg:border-t-0 border-[#DCD0BE]"
          >
            <div className="pb-3 border-b border-[#DCD0BE]">
              <h2 className="font-serif text-xl font-bold text-[#111827]">
                Multi-Agent Ticker
              </h2>
              <p className="text-xs text-neutral-600 mt-0.5">
                Live dispatches from Host-01 & Waiters W1–W3.
              </p>
            </div>

            <div className="divide-y divide-[#DCD0BE] border-b border-[#DCD0BE]">
              {waiters.map((w) => (
                <div
                  key={w.id}
                  className="py-3 first:pt-0 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#111827]">
                      {w.name}
                    </p>
                    <p className="font-mono text-[10px] text-neutral-500">
                      {w.currentAction} → {w.targetTableId ?? 'Queue'}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#047857] tabular-nums">
                    U={w.utilityScore}
                  </span>
                </div>
              ))}
            </div>

            {events.length === 0 ? (
              <p className="text-xs text-neutral-500 py-6">
                No recent agent dispatches yet. Dispatches appear here upon booking, check-in, or QR ordering.
              </p>
            ) : (
              <div className="divide-y divide-[#DCD0BE] max-h-72 overflow-y-auto pr-1">
                {events.slice(0, 6).map((evt) => (
                  <div key={evt.id} className="py-3 text-xs text-neutral-700">
                    <div className="flex items-center justify-between font-mono text-[10px] text-neutral-500 mb-1">
                      <span className="text-[#DC2626] font-semibold">
                        {evt.agentName}
                      </span>
                      <span>{evt.timestamp}</span>
                    </div>
                    <p className="leading-snug">{evt.message}</p>
                  </div>
                ))}
              </div>
            )}
          </LateralSlideCard>
        </div>
      </section>

      {/* Bottom XAI & Fairness Audit Ledger */}
      <LateralSlideCard index={3}>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#DCD0BE]">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-[#059669] shrink-0" />
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#111827]">
                  Explainable AI (XAI) & Fairness Audit Ledger
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Verifies queue wait parity | avg(W_VIP) − avg(W_Regular) | ≤ 8.0 min threshold.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
              <span className="text-neutral-700 tabular-nums">
                VIP Avg: {fairnessAudit.avgVipWaitMins}m · Regular Avg:{' '}
                {fairnessAudit.avgRegularWaitMins}m
              </span>
              <span
                className={`px-3 py-1 rounded-full border font-semibold ${
                  fairnessAudit.isFair
                    ? 'bg-emerald-50 border-[#059669]/40 text-[#047857]'
                    : 'bg-red-50 border-[#DC2626]/40 text-[#B91C1C]'
                }`}
              >
                {fairnessAudit.statusLabel}
              </span>
            </div>
          </div>

          {xaiLogs.length === 0 ? (
            <p className="text-xs text-neutral-500 py-8 border-b border-[#DCD0BE]">
              No seating audit decisions recorded yet. Audit entries are appended automatically as bookings and check-ins occur.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:gap-0 border-b border-[#DCD0BE]">
              {xaiLogs.slice(0, 6).map((log) => (
                <div
                  key={log.id}
                  className="py-5 md:px-5 border-b border-[#DCD0BE] md:border-r md:[&:nth-child(3n)]:border-r-0 space-y-2"
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-[#DC2626] font-semibold">
                      {log.partyName} ({log.partySize}p)
                    </span>
                    <span className="text-neutral-500">{log.timestamp}</span>
                  </div>
                  <p className="font-mono text-xs text-[#047857] font-semibold">
                    → {log.assignedTables.join(' + ')} · f={log.fScore}
                  </p>
                  <p className="text-xs text-neutral-700 leading-relaxed">
                    {log.justification}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {log.rulesApplied.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#ECE3D3] border border-[#DCD0BE] font-mono text-[10px] text-neutral-700"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-[#DC2626]" />
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </LateralSlideCard>

      {/* Per-Table QR Pass Preview Modal */}
      {qrModalTable && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="table-qr-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm bg-[#F5EFE6] border border-[#DCD0BE] shadow-2xl p-6 space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-[#DCD0BE] pb-3">
              <h2
                id="table-qr-title"
                className="font-serif text-lg font-bold text-[#111827]"
              >
                {qrModalTable.label}
              </h2>
              <button
                type="button"
                onClick={() => setQrModalTable(null)}
                aria-label="Close QR pass modal"
                className="p-1.5 text-neutral-500 hover:text-[#DC2626]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-2 flex justify-center">
              <QRCodeSvg
                value={`https://khana-khazana.app/table/${qrModalTable.id}/menu`}
                size={150}
                label={`/table/${qrModalTable.id}/menu`}
              />
            </div>

            <p className="text-xs text-neutral-600">
              Zone: {qrModalTable.zone} · {qrModalTable.capacity} Seats ·{' '}
              {qrModalTable.status}
            </p>

            <button
              type="button"
              onClick={() => {
                const target = `/table/${qrModalTable.id}/menu`;
                setQrModalTable(null);
                navigate(target);
              }}
              className="w-full py-3 rounded-full bg-[#DC2626] text-white font-semibold text-sm hover:bg-[#B91C1C] transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Open Table {qrModalTable.id} QR Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
