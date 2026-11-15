import React, { useState } from 'react';
import {
  Bot,
  ChefHat,
  Compass,
  PackageCheck,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  Zap,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { LateralSlideCard, RaindropHeader } from '../components/MotionPrimitives';

const PEAS_SPEC = [
  {
    letter: 'P',
    title: 'Performance Measure',
    desc: 'Maximize seat utilization (>95%), minimize guest wait variance, validate kitchen inventory atomically, uphold queue fairness.',
  },
  {
    letter: 'E',
    title: 'Environment',
    desc: '10-table dining floor across Window, Main Hall & VIP Lounge paired with live Kitchen pantry & QR table order stream.',
  },
  {
    letter: 'A',
    title: 'Actuators',
    desc: 'Table clearing, bill delivery, kitchen order dispatch, A* seating, adjacent table merging, and R3 amuse-bouche triggers.',
  },
  {
    letter: 'S',
    title: 'Sensors',
    desc: 'Table state sensors, NeonDB ingredient quantities, course stage timers, wheelchair/VIP flags, and queue telemetry.',
  },
];

export function AgentsPage() {
  const {
    tables,
    waiters,
    events,
    ingredients,
    orders,
    tickCount,
    isAutoPlaying,
    setIsAutoPlaying,
    stepSimulationTick,
    advanceOrderStatus,
    setIngredientStock,
    resetFloor,
    navigate,
  } = useRestaurant();

  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');

  const handleApplyStock = async (ingredientId: string, amount: number) => {
    setActionError('');
    try {
      await setIngredientStock(ingredientId, amount);
      setStockDrafts((prev) => {
        const next = { ...prev };
        delete next[ingredientId];
        return next;
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to update pantry stock.',
      );
    }
  };

  return (
    <div className="overflow-x-clip bg-[#F5EFE6] text-[#111827] pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <RaindropHeader
          asPageTitle
          kicker="Admin Command · Multi-Agent & Kitchen Inventory"
          title="Waiter Choreography, Kitchen Queue & Live Pantry Stock"
          subtitle="Step Utility-Based Waiters (W1–W3), track live QR table orders, or set any ingredient to 0 to test real-time Customer QR Menu out-of-stock substitutes."
        />

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsAutoPlaying((p) => !p)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-xs transition-colors whitespace-nowrap ${
              isAutoPlaying
                ? 'bg-[#059669] text-white hover:bg-[#047857]'
                : 'bg-[#DC2626] text-white hover:bg-[#B91C1C]'
            }`}
          >
            {isAutoPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                Pause Simulation
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Play Auto-Sim
              </>
            )}
          </button>

          <button
            type="button"
            onClick={stepSimulationTick}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#DC2626] bg-[#F5EFE6] text-[#DC2626] font-semibold text-xs hover:bg-[#DC2626] hover:text-white transition-colors whitespace-nowrap"
          >
            <StepForward className="w-4 h-4" />
            +1 Min Tick (t={tickCount})
          </button>

          <button
            type="button"
            onClick={resetFloor}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#C9BCAA] bg-[#F5EFE6] text-[#111827] font-medium text-xs hover:border-[#DC2626] hover:text-[#DC2626] transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {actionError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div
            role="alert"
            className="border border-[#DC2626]/40 bg-[#FEF2F2] text-[#B91C1C] px-4 py-3 text-xs font-medium"
          >
            {actionError}
          </div>
        </div>
      )}

      {/* Live Kitchen Orders Queue + Live Ingredient Inventory Control (Hairline Split) */}
      <section className="border-y border-[#DCD0BE] bg-[#F5EFE6]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-[#DCD0BE] items-stretch">
          {/* Live Kitchen Ingredient Inventory Table */}
          <LateralSlideCard
            index={0}
            className="lg:col-span-7 px-4 sm:px-6 lg:px-8 py-10 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCD0BE] pb-4">
              <div className="flex items-center gap-2.5">
                <PackageCheck className="w-5 h-5 text-[#059669]" />
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#111827]">
                    Live Kitchen Ingredient Inventory
                  </h2>
                  <p className="text-xs text-neutral-600">
                    Synced atomically with Customer QR Menu orders. Adjust live pantry counts or mark items out of stock.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/table/T3/menu')}
                className="px-4 py-2 rounded-full border border-[#059669] bg-[#F5EFE6] text-xs font-semibold text-[#047857] hover:bg-[#059669] hover:text-white transition-colors whitespace-nowrap"
              >
                Open Table T3 QR Menu
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DCD0BE] font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    <th className="py-3 pr-3">Ingredient</th>
                    <th className="py-3 px-3">Recipe Usage</th>
                    <th className="py-3 px-3 text-right">Live Stock</th>
                    <th className="py-3 pl-3 text-right">Stock Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCD0BE]">
                  {ingredients.map((ing) => {
                    const isOut = ing.stock <= 0;
                    const isLow = !isOut && ing.stock <= ing.parLevel * 0.25;
                    const draftValue = stockDrafts[ing.id] ?? String(ing.stock);
                    const parsedDraft = Number(draftValue);
                    const canApplyDraft =
                      draftValue.trim() !== '' &&
                      Number.isFinite(parsedDraft) &&
                      parsedDraft >= 0 &&
                      parsedDraft !== ing.stock;
                    return (
                      <tr key={ing.id} className="hover:bg-[#ECE3D3]">
                        <td className="py-3.5 pr-3 font-semibold text-[#111827]">
                          {ing.name}
                        </td>
                        <td className="py-3.5 px-3 text-neutral-600">
                          {ing.perOrderHighlight}
                        </td>
                        <td
                          className={`py-3.5 px-3 text-right font-mono font-semibold tabular-nums ${
                            isOut
                              ? 'text-[#DC2626]'
                              : isLow
                              ? 'text-amber-700'
                              : 'text-[#047857]'
                          }`}
                        >
                          {ing.stock} {ing.unit}
                        </td>
                        <td className="py-3.5 pl-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              aria-label={`Custom stock for ${ing.name}`}
                              value={draftValue}
                              onChange={(e) =>
                                setStockDrafts((prev) => ({
                                  ...prev,
                                  [ing.id]: e.target.value,
                                }))
                              }
                              className="w-16 px-2 py-1 border border-[#C9BCAA] bg-[#FBF8F2] font-mono text-[11px] text-right text-[#111827] tabular-nums focus:outline-none focus:border-[#DC2626]"
                            />
                            <button
                              type="button"
                              disabled={!canApplyDraft}
                              onClick={() => void handleApplyStock(ing.id, parsedDraft)}
                              className="px-2 py-1 border border-[#111827]/30 bg-[#FBF8F2] text-[11px] font-mono text-[#111827] hover:bg-[#111827] hover:text-white disabled:opacity-40 transition-colors"
                            >
                              Apply
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleApplyStock(ing.id, 0)}
                              disabled={isOut}
                              className="px-2.5 py-1 rounded-full border border-[#DC2626]/40 bg-red-50 text-[11px] font-mono text-[#B91C1C] hover:bg-[#DC2626] hover:text-white disabled:opacity-40 transition-colors whitespace-nowrap"
                            >
                              Set 0 (Out)
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleApplyStock(ing.id, ing.parLevel)}
                              className="px-2.5 py-1 rounded-full border border-[#059669]/40 bg-emerald-50 text-[11px] font-mono text-[#047857] hover:bg-[#059669] hover:text-white transition-colors whitespace-nowrap"
                            >
                              Replenish
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </LateralSlideCard>

          {/* Live Kitchen Orders Queue */}
          <LateralSlideCard
            index={1}
            className="lg:col-span-5 px-4 sm:px-6 lg:px-8 py-10 space-y-5 bg-[#ECE3D3] border-t lg:border-t-0 border-[#DCD0BE]"
          >
            <div className="flex items-center justify-between border-b border-[#DCD0BE] pb-4">
              <div className="flex items-center gap-2.5">
                <ChefHat className="w-5 h-5 text-[#DC2626]" />
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#111827]">
                    Live Kitchen Orders ({orders.length})
                  </h2>
                  <p className="text-xs text-neutral-600">
                    Dispatched from Table QR menus after atomic stock check.
                  </p>
                </div>
              </div>
            </div>

            {orders.length === 0 ? (
              <p className="text-xs text-neutral-500 py-8 text-center">
                No kitchen orders yet. Place an order from any Table QR Menu.
              </p>
            ) : (
              <div className="divide-y divide-[#DCD0BE] border-b border-[#DCD0BE] max-h-[420px] overflow-y-auto pr-1">
                {orders.map((ord) => (
                  <div key={ord.orderId} className="py-4 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#DC2626]">
                        {ord.orderId} · Table {ord.tableId}
                      </span>
                      <span
                        className={`font-mono text-[10px] px-2.5 py-0.5 rounded-full border font-semibold ${
                          ord.status === 'Waiter En Route' || ord.status === 'Served'
                            ? 'bg-emerald-50 border-[#059669]/40 text-[#047857]'
                            : ord.status === 'Preparing'
                            ? 'bg-[#F5EFE6] border-[#C9BCAA] text-[#111827]'
                            : 'bg-red-50 border-[#DC2626]/35 text-[#B91C1C]'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </div>

                    <p className="text-xs text-[#111827] font-medium">
                      {ord.items
                        .map((i) => `${i.quantity}× ${i.name}`)
                        .join(', ')}
                    </p>

                    <div className="flex items-center justify-between pt-1 font-mono text-[11px] text-neutral-500 tabular-nums">
                      <span>
                        ₹{ord.totalAmount} · {ord.prepTimeMins}m · Waiter{' '}
                        {ord.dispatchedAgentId}
                      </span>
                      {ord.status !== 'Served' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionError('');
                            void advanceOrderStatus(ord.orderId).catch((err) =>
                              setActionError(
                                err instanceof Error
                                  ? err.message
                                  : 'Unable to advance kitchen order stage.',
                              ),
                            );
                          }}
                          className="text-[#DC2626] hover:underline font-semibold"
                        >
                          Advance Stage
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </LateralSlideCard>
        </div>
      </section>

      {/* 4-Column Hairline PEAS Architectural Strip */}
      <section className="border-b border-[#DCD0BE] bg-[#F5EFE6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#DCD0BE]">
            {PEAS_SPEC.map((item, idx) => (
              <LateralSlideCard key={item.letter} index={idx}>
                <div className="py-8 px-4 sm:px-6 h-full">
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="w-7 h-7 border border-[#DC2626] font-mono text-xs font-bold text-[#DC2626] flex items-center justify-center">
                      {item.letter}
                    </span>
                    <h2 className="font-serif text-lg font-bold text-[#111827]">
                      {item.title}
                    </h2>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </LateralSlideCard>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Floor Matrix + Utility Breakdown */}
      <section className="border-b border-[#DCD0BE] bg-[#F5EFE6]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-[#DCD0BE] items-stretch">
          <LateralSlideCard
            index={0}
            className="lg:col-span-7 px-4 sm:px-6 lg:px-8 py-10"
          >
            <div className="flex items-center justify-between border-b border-[#DCD0BE] pb-4 mb-5">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#111827]">
                  Live Multi-Agent Floor Grid
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Agents dynamically relocate to tables needing clearing, billing, or QR order delivery.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#DC2626] tabular-nums">
                Tick #{tickCount}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {tables.map((t) => {
                const activeHere = waiters.filter(
                  (w) => w.targetTableId === t.id,
                );
                return (
                  <div
                    key={t.id}
                    className={`p-3 border min-h-[116px] flex flex-col justify-between transition-colors ${
                      activeHere.length > 0
                        ? 'bg-emerald-50/40 border-[#059669]'
                        : 'bg-[#ECE3D3] border-[#DCD0BE]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="font-bold text-[#111827]">{t.id}</span>
                        <span className="text-[10px] text-neutral-500">
                          {t.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-500 mt-0.5 truncate">
                        {t.zone}
                      </p>
                    </div>

                    <div className="space-y-1 mt-2">
                      {activeHere.map((agent) => (
                        <div
                          key={agent.id}
                          className="px-2 py-1 bg-[#F5EFE6] border border-[#059669]/40 font-mono text-[10px] text-[#047857] font-semibold flex items-center justify-between"
                        >
                          <span className="truncate">{agent.id}</span>
                          <span className="text-[#DC2626] tabular-nums">
                            {agent.utilityScore}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </LateralSlideCard>

          <LateralSlideCard
            index={1}
            className="lg:col-span-5 px-4 sm:px-6 lg:px-8 py-10 space-y-4 bg-[#ECE3D3] border-t lg:border-t-0 border-[#DCD0BE]"
          >
            <div className="flex items-center justify-between border-b border-[#DCD0BE] pb-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#111827]">
                  Live Utility Score Matrix
                </h2>
                <p className="font-mono text-[11px] text-neutral-500">
                  U = Urgency + VIP − Distance − Load
                </p>
              </div>
              <Bot className="w-5 h-5 text-[#DC2626]" />
            </div>

            <div className="divide-y divide-[#DCD0BE] border-b border-[#DCD0BE]">
              {waiters.map((w) => (
                <div key={w.id} className="py-4 first:pt-0 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                        {w.role.includes('Host') ? (
                          <Compass className="w-4 h-4 text-[#059669]" />
                        ) : (
                          <Zap className="w-4 h-4 text-[#DC2626]" />
                        )}
                        {w.name}
                      </p>
                      <p className="font-mono text-[11px] text-neutral-500">
                        {w.role} · Zone: {w.zone} · Action: {w.currentAction} →{' '}
                        {w.targetTableId ?? 'Queue'}
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-lg font-bold text-[#DC2626] tabular-nums block">
                        {w.utilityScore}
                      </span>
                      <span className="text-[10px] text-[#047857] font-semibold tabular-nums">
                        Energy {w.energyPct}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 font-mono text-[10px] pt-1 text-neutral-600 tabular-nums">
                    <span>Urg +{w.utilityBreakdown.urgency}</span>
                    <span>VIP +{w.utilityBreakdown.vipBonus}</span>
                    <span>Dist -{w.utilityBreakdown.distancePenalty}</span>
                    <span>Load -{w.utilityBreakdown.loadPenalty}</span>
                  </div>
                </div>
              ))}
            </div>
          </LateralSlideCard>
        </div>
      </section>

      {/* Live Multi-Agent Execution Log */}
      <LateralSlideCard index={2}>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
          <div className="pb-4 border-b border-[#DCD0BE]">
            <h2 className="font-serif text-2xl font-bold text-[#111827]">
              Autonomous Decision Telemetry Stream
            </h2>
          </div>
          {events.length === 0 ? (
            <p className="text-xs text-neutral-500 py-8 border-b border-[#DCD0BE]">
              No autonomous dispatch telemetry events yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-b border-[#DCD0BE]">
              {events.slice(0, 9).map((evt) => (
                <div
                  key={evt.id}
                  className="py-4 md:px-5 border-b border-[#DCD0BE] md:border-r md:[&:nth-child(3n)]:border-r-0 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="text-[#DC2626] font-semibold">
                      {evt.agentName}
                    </span>
                    <span className="text-neutral-500">
                      t={evt.tick} · {evt.timestamp}
                    </span>
                  </div>
                  <p className="text-neutral-700 leading-relaxed">{evt.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </LateralSlideCard>
    </div>
  );
}
