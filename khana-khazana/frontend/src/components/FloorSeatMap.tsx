import React, { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  Crown,
  Link2,
  Pause,
  Play,
  RotateCcw,
  StepForward,
} from 'lucide-react';
import {
  classifyTableForBooking,
  computeFloorOccupancySummary,
  resolveTableClickSelection,
  type FloorSeatVisualState,
} from '../engine/floorMapHelpers';
import type { ReservationRecord, RestaurantTable, Zone } from '../../../backend/engine/types';

interface FloorSeatMapProps {
  tables: RestaurantTable[];
  reservations: ReservationRecord[];
  dateTime: string;
  partySize: number;
  needsWheelchair: boolean;
  pinnedTableIds: string[];
  aiRecommendedTableIds: string[];
  isAutoPlaying: boolean;
  tickCount: number;
  onToggleAutoPlay: () => void;
  onStepTick: () => void;
  onSelectTables: (tableIds: string[], resolvedZone: Zone | null) => void;
  onClearPinned: () => void;
}

const STATE_STYLES: Record<
  FloorSeatVisualState,
  {
    plate: string;
    chair: string;
    labelText: string;
    codeText: string;
  }
> = {
  SELECTED: {
    plate:
      'border-[#DC2626] bg-[#FEF2F2] ring-2 ring-[#DC2626]/35 shadow-sm',
    chair: 'bg-[#DC2626] border-[#B91C1C]',
    labelText: 'text-[#B91C1C] font-semibold',
    codeText: 'text-[#B91C1C]',
  },
  AI_RECOMMENDED: {
    plate:
      'border-[#059669] bg-[#ECFDF5] ring-2 ring-[#059669]/30 shadow-sm',
    chair: 'bg-[#059669] border-[#047857]',
    labelText: 'text-[#047857] font-semibold',
    codeText: 'text-[#047857]',
  },
  AVAILABLE: {
    plate:
      'border-[#059669]/65 bg-[#FBF8F2] hover:border-[#059669] hover:bg-[#ECFDF5]/60',
    chair: 'bg-[#ECFDF5] border-[#059669]',
    labelText: 'text-[#047857]',
    codeText: 'text-[#111827]',
  },
  BAYESIAN_SOON: {
    plate:
      'border-[#B45309]/70 bg-[#FEF3C7]/45 hover:border-[#B45309] hover:bg-[#FEF3C7]/75',
    chair: 'bg-[#FDE68A] border-[#B45309]',
    labelText: 'text-[#92400E] font-medium',
    codeText: 'text-[#111827]',
  },
  CLEARING: {
    plate:
      'border-dashed border-[#78716C] bg-[#ECE3D3]/80 hover:border-[#111827]',
    chair: 'bg-[#DCD0BE] border-[#78716C]',
    labelText: 'text-neutral-700',
    codeText: 'text-[#111827]',
  },
  RESTRICTED_R1: {
    plate:
      'border-[#DCD0BE] bg-[#E8DFCE]/70 opacity-65 hover:opacity-90',
    chair: 'bg-[#DCD0BE] border-[#C9BCAA]',
    labelText: 'text-neutral-500',
    codeText: 'text-neutral-500',
  },
  CAPACITY_SMALL: {
    plate:
      'border-[#DCD0BE] bg-[#E8DFCE]/70 opacity-65 hover:opacity-90',
    chair: 'bg-[#DCD0BE] border-[#C9BCAA]',
    labelText: 'text-neutral-500',
    codeText: 'text-neutral-500',
  },
  SLOT_BOOKED: {
    plate:
      'border-[#C9BCAA] bg-[#DFD5C3] opacity-80',
    chair: 'bg-[#4B5563] border-[#374151]',
    labelText: 'text-neutral-600 font-medium',
    codeText: 'text-neutral-600',
  },
  OCCUPIED: {
    plate:
      'border-[#C9BCAA] bg-[#DFD5C3] opacity-85',
    chair: 'bg-[#374151] border-[#1F2937]',
    labelText: 'text-neutral-700',
    codeText: 'text-neutral-700',
  },
};

function ChairRow({
  count,
  position,
  chairClass,
}: {
  count: number;
  position: 'top' | 'bottom';
  chairClass: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center gap-2.5 px-2"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <span
          key={idx}
          className={`h-2 w-5 border transition-colors duration-200 ${
            position === 'top' ? 'rounded-t-sm border-b-0' : 'rounded-b-sm border-t-0'
          } ${chairClass}`}
        />
      ))}
    </div>
  );
}

export function FloorSeatMap({
  tables,
  reservations,
  dateTime,
  partySize,
  needsWheelchair,
  pinnedTableIds,
  aiRecommendedTableIds,
  isAutoPlaying,
  tickCount,
  onToggleAutoPlay,
  onStepTick,
  onSelectTables,
  onClearPinned,
}: FloorSeatMapProps) {
  const [inspectorNotice, setInspectorNotice] = useState<{
    tableId: string;
    tone: 'selected' | 'blocked' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (pinnedTableIds.length === 0 && inspectorNotice?.tone === 'selected') {
      setInspectorNotice(null);
    }
  }, [pinnedTableIds, inspectorNotice?.tone]);

  const summary = useMemo(
    () => computeFloorOccupancySummary(tables, reservations, dateTime),
    [tables, reservations, dateTime],
  );

  const tableById = useMemo(
    () => new Map(tables.map((t) => [t.id, t])),
    [tables],
  );

  const classifications = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof classifyTableForBooking>
    >();
    for (const t of tables) {
      map.set(
        t.id,
        classifyTableForBooking(t, tables, reservations, {
          partySize,
          needsWheelchair,
          dateTime,
          pinnedTableIds,
          aiRecommendedTableIds,
        }),
      );
    }
    return map;
  }, [
    tables,
    reservations,
    partySize,
    needsWheelchair,
    dateTime,
    pinnedTableIds,
    aiRecommendedTableIds,
  ]);

  const handleTableClick = (tableId: string) => {
    const resolution = resolveTableClickSelection(
      tables,
      reservations,
      tableId,
      {
        partySize,
        needsWheelchair,
        dateTime,
      },
    );

    if (resolution.accepted) {
      onSelectTables(resolution.selectedTableIds, resolution.resolvedZone);
      setInspectorNotice({
        tableId,
        tone: 'selected',
        text: resolution.reason,
      });
    } else {
      setInspectorNotice({
        tableId,
        tone: 'blocked',
        text: resolution.reason,
      });
    }
  };

  const renderTableUnit = (tableId: string) => {
    const table = tableById.get(tableId);
    const cls = classifications.get(tableId);
    if (!table || !cls) return null;

    const styles = STATE_STYLES[cls.state];
    const topChairs = Math.ceil(table.capacity / 2);
    const bottomChairs = Math.floor(table.capacity / 2);
    const isSelectedOrAi =
      cls.state === 'SELECTED' || cls.state === 'AI_RECOMMENDED';

    return (
      <div
        key={table.id}
        data-testid={`floor-seat-${table.id}`}
        data-seat-state={cls.state}
        className="flex flex-col items-center w-full"
      >
        <ChairRow count={topChairs} position="top" chairClass={styles.chair} />
        <button
          type="button"
          onClick={() => handleTableClick(table.id)}
          aria-pressed={cls.state === 'SELECTED'}
          aria-label={`Table ${table.id} ${table.label}, ${table.capacity} seats, ${table.zone}, ${cls.shortStatus}${
            table.isAccessible ? ', wheelchair accessible' : ''
          }${table.isVipBooth ? ', VIP booth' : ''}`}
          className={`w-full border px-3 py-2.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] ${styles.plate}`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 min-w-0">
              <span
                className={`font-serif text-sm sm:text-base font-bold tabular-nums shrink-0 ${styles.codeText}`}
              >
                {table.id}
              </span>
              <span className="font-mono text-[10px] sm:text-[11px] text-neutral-600 tabular-nums truncate">
                · {table.capacity} Seats
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {table.isAccessible && (
                <Accessibility
                  aria-label="Wheelchair accessible"
                  className="w-3.5 h-3.5 text-[#059669]"
                />
              )}
              {table.isVipBooth && (
                <Crown
                  aria-label="VIP booth"
                  className="w-3.5 h-3.5 text-[#B45309]"
                />
              )}
            </div>
          </div>

          <p className="text-[11px] text-neutral-700 truncate mt-0.5">
            {table.label.replace(`${table.id} · `, '')}
          </p>

          <div className="mt-1.5 flex items-center justify-between gap-1 font-mono text-[10px]">
            <span className={`truncate ${styles.labelText}`}>
              {cls.shortStatus}
            </span>
            {table.status === 'Occupied' && (
              <span className="text-neutral-500 tabular-nums shrink-0">
                P={cls.bayesianPct}%
              </span>
            )}
            {isSelectedOrAi && (
              <span className="text-[10px] uppercase tracking-wider font-semibold shrink-0">
                {cls.state === 'SELECTED' ? 'Pinned' : 'A* Best'}
              </span>
            )}
          </div>
        </button>
        <ChairRow
          count={bottomChairs}
          position="bottom"
          chairClass={styles.chair}
        />
      </div>
    );
  };

  const isPairHighlighted = (idA: string, idB: string) =>
    (pinnedTableIds.includes(idA) && pinnedTableIds.includes(idB)) ||
    (aiRecommendedTableIds.includes(idA) &&
      aiRecommendedTableIds.includes(idB));

  return (
    <section
      aria-label="Real-Time Table Occupancy Floor Map"
      className="border-b border-[#DCD0BE] py-8 space-y-5"
    >
      {/* Top Toolbar: Title, Live Counters & Real-Time Cadence Controls */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
            Live Dining Floor Map · Real-Time Seat Selector
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#111827] mt-1">
            Tap Any Open Table to Pin Your Seating
          </h2>
          <p className="text-xs text-neutral-600 mt-1">
            Synced directly with Floor Command & Bayesian turnover telemetry. Large parties (5+) auto-pair adjacent tables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="font-mono text-xs text-neutral-700 tabular-nums border border-[#DCD0BE] bg-[#FBF8F2] px-3.5 py-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-[#047857] font-semibold">
              {summary.free} Free
            </span>
            <span aria-hidden="true" className="text-neutral-400">
              ·
            </span>
            <span className="text-[#92400E] font-semibold">
              {summary.payingSoon} Paying ≤10m
            </span>
            <span aria-hidden="true" className="text-neutral-400">
              ·
            </span>
            <span className="text-neutral-700">
              {summary.occupied} Occupied
            </span>
            <span aria-hidden="true" className="text-neutral-400">
              ·
            </span>
            <span className="text-neutral-600">
              {summary.clearing} Clearing
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleAutoPlay}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 border text-xs font-semibold transition-colors whitespace-nowrap ${
              isAutoPlaying
                ? 'border-[#DC2626] bg-[#DC2626] text-white'
                : 'border-[#C9BCAA] bg-[#FBF8F2] text-[#111827] hover:border-[#111827]'
            }`}
          >
            {isAutoPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                Live Sync: Running (T{tickCount})
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-[#059669]" />
                Watch Live Floor Updates
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onStepTick}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#C9BCAA] bg-[#FBF8F2] text-xs font-semibold text-[#111827] hover:border-[#111827] transition-colors whitespace-nowrap"
          >
            <StepForward className="w-3.5 h-3.5 text-[#DC2626]" />
            +1 Min Tick
          </button>

          {pinnedTableIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onClearPinned();
                setInspectorNotice({
                  tableId: aiRecommendedTableIds[0] ?? 'T3',
                  tone: 'info',
                  text: 'Returned to A* Optimal Auto-Pick based on your party size, zone, and accessibility filters.',
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#059669] bg-[#ECFDF5] text-xs font-semibold text-[#047857] hover:bg-[#059669] hover:text-white transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Auto-Pick Best (A*)
            </button>
          )}
        </div>
      </div>

      {/* BookMyShow Seat Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-[#DCD0BE] py-2.5 px-4 bg-[#FBF8F2] text-xs">
        <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          Legend
        </span>
        <span className="inline-flex items-center gap-2 text-[#111827]">
          <span
            aria-hidden="true"
            className="w-4 h-3 border border-[#059669] bg-[#FBF8F2] inline-block"
          />
          Available
        </span>
        <span className="inline-flex items-center gap-2 text-[#047857] font-semibold">
          <span
            aria-hidden="true"
            className="w-4 h-3 border-2 border-[#047857] bg-[#A7F3D0] inline-block"
          />
          AI Recommended
        </span>
        <span className="inline-flex items-center gap-2 text-[#B91C1C] font-semibold">
          <span
            aria-hidden="true"
            className="w-4 h-3 border-2 border-[#DC2626] bg-[#FECACA] inline-block"
          />
          Your Selection
        </span>
        <span className="inline-flex items-center gap-2 text-[#92400E]">
          <span
            aria-hidden="true"
            className="w-4 h-3 border border-[#B45309] bg-[#FEF3C7] inline-block"
          />
          Freeing ≤10m (Bayes ≥75%)
        </span>
        <span className="inline-flex items-center gap-2 text-neutral-700">
          <span
            aria-hidden="true"
            className="w-4 h-3 border border-dashed border-[#78716C] bg-[#ECE3D3] inline-block"
          />
          Clearing (~3m)
        </span>
        <span className="inline-flex items-center gap-2 text-neutral-600">
          <span
            aria-hidden="true"
            className="w-4 h-3 border border-[#C9BCAA] bg-[#DFD5C3] inline-block"
          />
          Occupied / Unavailable
        </span>
      </div>

      {/* Architectural Dining Floor Plan */}
      <div className="border border-[#DCD0BE] bg-[#ECE3D3]/65">
        {/* North Perimeter: Window Glass Frontage */}
        <div className="border-b border-[#DCD0BE] bg-[#FBF8F2] px-4 py-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-600">
          <span>Panoramic Window Frontage · City Skyline View</span>
          <span className="hidden sm:inline text-[#047857] tabular-nums">
            {summary.availableSeatsNow} / {summary.totalSeats} Open & Pre-Alloc Seats
          </span>
        </div>

        {/* Three Spatial Dining Wings */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#DCD0BE]">
          {/* Wing 1: Window Bay */}
          <div className="lg:col-span-4 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCD0BE] pb-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-[#111827]">
                Window Bay
              </span>
              <span className="font-mono text-[10px] text-neutral-500">
                T1 · T5↔T6 · T7
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {renderTableUnit('T1')}
              {renderTableUnit('T7')}
            </div>

            <div className="pt-1">
              <div className="grid grid-cols-2 gap-3.5 relative">
                {renderTableUnit('T5')}
                {renderTableUnit('T6')}
              </div>
              <div
                className={`mt-2 flex items-center justify-center gap-1.5 font-mono text-[10px] py-1 border-t border-dashed ${
                  isPairHighlighted('T5', 'T6')
                    ? 'border-[#DC2626] text-[#B91C1C] font-semibold'
                    : 'border-[#C9BCAA] text-neutral-500'
                }`}
              >
                <Link2 className="w-3 h-3" />
                <span>T5 ↔ T6 Combinable (8 Seats)</span>
              </div>
            </div>
          </div>

          {/* Wing 2: Main Dining Hall */}
          <div className="lg:col-span-5 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCD0BE] pb-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-[#111827]">
                Main Dining Hall
              </span>
              <span className="font-mono text-[10px] text-[#047857]">
                Step-Free Promenade
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {renderTableUnit('T2')}
              {renderTableUnit('T10')}
            </div>

            <div className="border-y border-dashed border-[#C9BCAA] py-1 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              Central Step-Free Corridor
            </div>

            <div>
              <div className="grid grid-cols-2 gap-3.5">
                {renderTableUnit('T3')}
                {renderTableUnit('T4')}
              </div>
              <div
                className={`mt-2 flex items-center justify-center gap-1.5 font-mono text-[10px] py-1 border-t border-dashed ${
                  isPairHighlighted('T3', 'T4')
                    ? 'border-[#DC2626] text-[#B91C1C] font-semibold'
                    : 'border-[#C9BCAA] text-neutral-500'
                }`}
              >
                <Link2 className="w-3 h-3" />
                <span>T3 ↔ T4 Accessible Merge (8 Seats)</span>
              </div>
            </div>
          </div>

          {/* Wing 3: VIP Velvet Lounge */}
          <div className="lg:col-span-3 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCD0BE] pb-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-[#111827]">
                VIP Lounge
              </span>
              <span className="font-mono text-[10px] text-[#B45309]">
                Private Alcove
              </span>
            </div>

            <div className="space-y-3.5">
              {renderTableUnit('T8')}
              <div
                className={`flex items-center justify-center gap-1.5 font-mono text-[10px] py-1 border-y border-dashed ${
                  isPairHighlighted('T8', 'T9')
                    ? 'border-[#DC2626] text-[#B91C1C] font-semibold'
                    : 'border-[#C9BCAA] text-neutral-500'
                }`}
              >
                <Link2 className="w-3 h-3" />
                <span>T8 ↔ T9 Merge (10 Seats)</span>
              </div>
              {renderTableUnit('T9')}
            </div>
          </div>
        </div>

        {/* South Perimeter: Host Desk & Entrance */}
        <div className="border-t border-[#DCD0BE] bg-[#FBF8F2] px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-600">
          <span>Host Desk · Main Step-Free Entrance</span>
          <span>Kitchen Pass & Service Runway</span>
        </div>
      </div>

      {/* Interactive Selection & Inspection Readout */}
      <div
        role="status"
        aria-live="polite"
        className={`border px-4 py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
          inspectorNotice?.tone === 'blocked'
            ? 'border-[#DC2626]/50 bg-[#FEF2F2] text-[#B91C1C]'
            : pinnedTableIds.length > 0
            ? 'border-[#DC2626]/50 bg-[#FEF2F2]/70 text-[#111827]'
            : 'border-[#DCD0BE] bg-[#FBF8F2] text-neutral-700'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider font-semibold shrink-0">
            {pinnedTableIds.length > 0
              ? `Pinned Table${pinnedTableIds.length > 1 ? 's' : ''}: ${pinnedTableIds.join(' + ')}`
              : aiRecommendedTableIds.length > 0
              ? `AI Auto-Pick: ${aiRecommendedTableIds.join(' + ')}`
              : 'Slot Check Required'}
          </span>
          <span aria-hidden="true" className="hidden sm:inline text-neutral-400">
            ·
          </span>
          <span>
            {inspectorNotice?.text ??
              (aiRecommendedTableIds.length > 0
                ? `A* recommends ${aiRecommendedTableIds.join(' + ')} for ${partySize} guest${
                    partySize === 1 ? '' : 's'
                  }. Tap any emerald or amber table above to choose a different seat.`
                : 'No open table matches the active filters—adjust party size, zone, or wheelchair setting, or submit to view AI alternatives.')}
          </span>
        </div>
        <span className="font-mono text-[11px] text-neutral-600 shrink-0 tabular-nums">
          Party: {partySize} · {needsWheelchair ? 'Step-Free (R1)' : 'All Seating'}
        </span>
      </div>
    </section>
  );
}
