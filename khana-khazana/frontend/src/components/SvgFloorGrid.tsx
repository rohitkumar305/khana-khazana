import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { computeBayesianTurnoverProb } from '../../../backend/engine/aiEngine';
import {
  getChairRectanglesForNode,
  SVG_FLOOR_VIEWBOX,
  SVG_STATUS_COLORS,
  SVG_TABLE_BOXES,
} from '../engine/svgFloorLayout';
import type { RestaurantTable } from '../../../backend/engine/types';

interface SvgFloorGridProps {
  tables: RestaurantTable[];
  selectedTableId: string | null;
  onSelectTable: (tableId: string) => void;
}

export function SvgFloorGrid({
  tables,
  selectedTableId,
  onSelectTable,
}: SvgFloorGridProps) {
  const [pulseTarget, setPulseTarget] = useState<{
    id: string;
    seq: number;
  } | null>(null);

  const handleNodeActivate = (tableId: string) => {
    setPulseTarget({ id: tableId, seq: Date.now() });
    onSelectTable(tableId);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<SVGGElement>,
    tableId: string,
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNodeActivate(tableId);
    }
  };

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#DCD0BE]">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#111827]">
            Live SVG Floor Grid (T1–T10)
          </h2>
          <p className="text-xs text-neutral-600 mt-0.5">
            Click any table node to inspect Bayesian turnover, update table status, or launch its QR Pass.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-[#047857] font-semibold">
            <span
              aria-hidden="true"
              className="w-3 h-3 border-2 border-[#059669] bg-[#ECFDF5] inline-block"
            />
            Free
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#B91C1C] font-semibold">
            <span
              aria-hidden="true"
              className="w-3 h-3 border-2 border-[#DC2626] bg-[#FEF2F2] inline-block"
            />
            Occupied
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#92400E] font-semibold">
            <span
              aria-hidden="true"
              className="w-3 h-3 border-2 border-[#B45309] bg-[#FEF3C7] inline-block"
            />
            Paying
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#57534E] font-semibold">
            <span
              aria-hidden="true"
              className="w-3 h-3 border border-dashed border-[#78716C] bg-[#ECE3D3] inline-block"
            />
            Dirty
          </span>
        </div>
      </div>

      {/* Responsive SVG Floor Plan */}
      <div className="mt-5 border border-[#DCD0BE] bg-[#FBF8F2] p-2 sm:p-3">
        <svg
          viewBox={`0 0 ${SVG_FLOOR_VIEWBOX.width} ${SVG_FLOOR_VIEWBOX.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="region"
          aria-label="Interactive Real-Time Restaurant SVG Table Grid"
          className="w-full h-auto block select-none"
        >
          {/* Outer Architectural Floor Backdrop */}
          <rect
            x={4}
            y={4}
            width={752}
            height={468}
            rx={4}
            fill="#F5EFE6"
            stroke="#DCD0BE"
            strokeWidth={1.5}
          />

          {/* North Perimeter: Panoramic Window Frontage */}
          <rect
            x={14}
            y={12}
            width={732}
            height={26}
            fill="#FBF8F2"
            stroke="#DCD0BE"
            strokeWidth={1}
          />
          <text
            x={380}
            y={29}
            textAnchor="middle"
            fill="#57534E"
            fontSize="11"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            letterSpacing="2.4"
          >
            PANORAMIC WINDOW FRONTAGE · CITY SKYLINE BAY
          </text>

          {/* Zone Enclosures */}
          {/* Zone 1: Window Bay */}
          <rect
            x={14}
            y={46}
            width={236}
            height={374}
            fill="#FBF8F2"
            stroke="#DCD0BE"
            strokeWidth={1}
          />
          <text
            x={26}
            y={66}
            fill="#111827"
            fontSize="12"
            fontWeight="700"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            letterSpacing="1.6"
          >
            WINDOW BAY
          </text>

          {/* Zone 2: Main Dining Hall */}
          <rect
            x={260}
            y={46}
            width={288}
            height={374}
            fill="#FBF8F2"
            stroke="#DCD0BE"
            strokeWidth={1}
          />
          <text
            x={274}
            y={66}
            fill="#111827"
            fontSize="12"
            fontWeight="700"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            letterSpacing="1.6"
          >
            MAIN DINING HALL
          </text>
          <text
            x={534}
            y={66}
            textAnchor="end"
            fill="#047857"
            fontSize="10"
            fontWeight="600"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            STEP-FREE
          </text>

          {/* Central Step-Free Corridor Line */}
          <line
            x1={274}
            y1={222}
            x2={534}
            y2={222}
            stroke="#C9BCAA"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <text
            x={404}
            y={216}
            textAnchor="middle"
            fill="#78716C"
            fontSize="10"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            letterSpacing="1.8"
          >
            STEP-FREE PROMENADE
          </text>

          {/* Zone 3: VIP Lounge */}
          <rect
            x={558}
            y={46}
            width={188}
            height={374}
            fill="#ECE3D3"
            fillOpacity={0.55}
            stroke="#DCD0BE"
            strokeWidth={1}
          />
          <text
            x={574}
            y={66}
            fill="#111827"
            fontSize="12"
            fontWeight="700"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            letterSpacing="1.6"
          >
            VIP LOUNGE
          </text>

          {/* Combinable Merge Bridges */}
          {/* T5 <-> T6 */}
          <line
            x1={124}
            y1={314}
            x2={142}
            y2={314}
            stroke="#B45309"
            strokeWidth={2}
            strokeDasharray="3 2"
          />
          <text
            x={133}
            y={398}
            textAnchor="middle"
            fill="#78716C"
            fontSize="10"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            T5 ↔ T6 MERGE (8P)
          </text>

          {/* T3 <-> T4 */}
          <line
            x1={396}
            y1={314}
            x2={412}
            y2={314}
            stroke="#059669"
            strokeWidth={2}
            strokeDasharray="3 2"
          />
          <text
            x={404}
            y={398}
            textAnchor="middle"
            fill="#047857"
            fontSize="10"
            fontWeight="600"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            T3 ↔ T4 ACCESSIBLE MERGE (8P)
          </text>

          {/* T8 <-> T9 */}
          <line
            x1={651}
            y1={191}
            x2={651}
            y2={257}
            stroke="#B45309"
            strokeWidth={2}
            strokeDasharray="3 2"
          />
          <rect x={592} y={214} width={118} height={18} fill="#F5EFE6" rx={2} />
          <text
            x={651}
            y={227}
            textAnchor="middle"
            fill="#78716C"
            fontSize="10"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            T8 ↔ T9 MERGE (10P)
          </text>

          {/* South Perimeter: Host Desk & Kitchen Pass */}
          <rect
            x={14}
            y={428}
            width={732}
            height={34}
            fill="#FBF8F2"
            stroke="#DCD0BE"
            strokeWidth={1}
          />
          <text
            x={28}
            y={449}
            fill="#57534E"
            fontSize="11"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            letterSpacing="1.6"
          >
            HOST DESK & MAIN ENTRANCE
          </text>
          <text
            x={732}
            y={449}
            textAnchor="end"
            fill="#DC2626"
            fontSize="11"
            fontWeight="600"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            letterSpacing="1.4"
          >
            KITCHEN PASS & SERVICE RUNWAY
          </text>

          {/* Interactive Table Nodes (T1 - T10) */}
          {tables.map((table) => {
            const box = SVG_TABLE_BOXES[table.id];
            if (!box) return null;

            const theme = SVG_STATUS_COLORS[table.status];
            const isSelected = selectedTableId === table.id;
            const chairs = getChairRectanglesForNode(box, table.capacity);
            const bayesPct = Math.round(
              computeBayesianTurnoverProb(
                table.status,
                table.currentCourse,
                table.elapsedMins,
              ) * 100,
            );
            const isPulsing = pulseTarget?.id === table.id;

            const subLine =
              table.status === 'Occupied'
                ? `${table.currentCourse} · ${table.elapsedMins}m`
                : table.status === 'Paying'
                ? `Billing · ${bayesPct}%`
                : table.status === 'Dirty'
                ? 'Clearing ~3m'
                : 'Ready to Seat';

            return (
              <g
                key={table.id}
                role="button"
                tabIndex={0}
                data-testid={`svg-table-${table.id}`}
                data-status={table.status}
                aria-pressed={isSelected}
                aria-label={`Table ${table.id}, ${table.label}, ${table.capacity} seats, ${table.zone}, status ${table.status}, Bayesian ${bayesPct}%`}
                onClick={() => handleNodeActivate(table.id)}
                onKeyDown={(e) => handleKeyDown(e, table.id)}
                className="cursor-pointer focus:outline-none"
              >
                {/* Smooth Expanding Transition Pulse Animation on Click */}
                <AnimatePresence>
                  {isPulsing && pulseTarget && (
                    <motion.rect
                      key={`${table.id}-${pulseTarget.seq}`}
                      x={box.x}
                      y={box.y}
                      width={box.width}
                      height={box.height}
                      rx={6}
                      fill="none"
                      stroke={theme.pulseStroke}
                      strokeWidth={3}
                      style={{
                        transformOrigin: `${box.x + box.width / 2}px ${
                          box.y + box.height / 2
                        }px`,
                      }}
                      initial={{ opacity: 0.9, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.24 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                </AnimatePresence>

                {/* Active Selection Ring */}
                {isSelected && (
                  <rect
                    x={box.x - 4}
                    y={box.y - 4}
                    width={box.width + 8}
                    height={box.height + 8}
                    rx={6}
                    fill="none"
                    stroke="#111827"
                    strokeWidth={2}
                  />
                )}

                {/* Proportional Chair Silhouettes */}
                {chairs.map((ch, idx) => (
                  <rect
                    key={idx}
                    x={ch.x}
                    y={ch.y}
                    width={ch.width}
                    height={ch.height}
                    rx={ch.side === 'top' ? 2 : 2}
                    fill={theme.chairFill}
                    stroke={theme.chairStroke}
                    strokeWidth={1.2}
                    style={{
                      transition: 'fill 320ms ease, stroke 320ms ease',
                    }}
                  />
                ))}

                {/* Main Tabletop Node */}
                <rect
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  rx={4}
                  fill={theme.fill}
                  stroke={theme.stroke}
                  strokeWidth={isSelected ? 2.4 : 1.75}
                  strokeDasharray={table.status === 'Dirty' ? '5 3' : undefined}
                  style={{
                    transition:
                      'fill 320ms ease, stroke 320ms ease, stroke-width 200ms ease',
                  }}
                />

                {/* Table ID + Capacity */}
                <text
                  x={box.x + 10}
                  y={box.y + 23}
                  fill={theme.titleColor}
                  fontSize="16"
                  fontWeight="700"
                  fontFamily="Georgia, Cambria, serif"
                >
                  {table.id}
                </text>
                <text
                  x={box.x + box.width - 10}
                  y={box.y + 22}
                  textAnchor="end"
                  fill={theme.subColor}
                  fontSize="10.5"
                  fontWeight="600"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {table.capacity}P
                  {table.isAccessible ? ' · SF' : ''}
                  {table.isVipBooth ? ' · VIP' : ''}
                </text>

                {/* Status Pill inside Node */}
                <rect
                  x={box.x + 9}
                  y={box.y + 33}
                  width={box.width - 18}
                  height={20}
                  rx={3}
                  fill={theme.badgeFill}
                  style={{ transition: 'fill 320ms ease' }}
                />
                <text
                  x={box.x + box.width / 2}
                  y={box.y + 47}
                  textAnchor="middle"
                  fill={theme.badgeText}
                  fontSize="10.5"
                  fontWeight="700"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  letterSpacing="0.6"
                >
                  {table.status.toUpperCase()}
                </text>

                {/* Bottom Course / Bayesian Line */}
                <text
                  x={box.x + box.width / 2}
                  y={box.y + 73}
                  textAnchor="middle"
                  fill={theme.subColor}
                  fontSize="10.5"
                  fontWeight="500"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {subLine}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
