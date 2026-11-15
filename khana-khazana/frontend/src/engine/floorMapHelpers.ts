import { computeBayesianTurnoverProb } from '../../../backend/engine/aiEngine';
import { isSlotOverlapping } from '../../../backend/engine/workflows';
import type { ReservationRecord, RestaurantTable } from '../../../backend/engine/types';

export type FloorSeatVisualState =
  | 'SELECTED'
  | 'AI_RECOMMENDED'
  | 'AVAILABLE'
  | 'BAYESIAN_SOON'
  | 'CLEARING'
  | 'RESTRICTED_R1'
  | 'CAPACITY_SMALL'
  | 'SLOT_BOOKED'
  | 'OCCUPIED';

export interface FloorMapFilterCriteria {
  partySize: number;
  needsWheelchair: boolean;
  dateTime: string;
  pinnedTableIds: string[];
  aiRecommendedTableIds: string[];
}

export interface TableClassification {
  state: FloorSeatVisualState;
  selectable: boolean;
  bayesianPct: number;
  shortStatus: string;
  blockReason: string | null;
}

export interface TableClickResolution {
  accepted: boolean;
  selectedTableIds: string[];
  resolvedZone: RestaurantTable['zone'] | null;
  reason: string;
}

export interface FloorOccupancySummary {
  free: number;
  payingSoon: number;
  occupied: number;
  clearing: number;
  totalSeats: number;
  availableSeatsNow: number;
}

export function getReservedTableIdsForSlot(
  reservations: ReservationRecord[],
  dateTime: string,
): Set<string> {
  const reserved = new Set<string>();
  for (const r of reservations) {
    if (r.status === 'CANCELLED' || r.status === 'COMPLETED') continue;
    if (isSlotOverlapping(r.dateTime, dateTime)) {
      for (const tid of r.assignedTableIds) {
        reserved.add(tid);
      }
    }
  }
  return reserved;
}

export function isTableOpenForBooking(table: RestaurantTable): boolean {
  return (
    table.status === 'Free' ||
    table.status === 'Dirty' ||
    table.status === 'Paying'
  );
}

export function canSeatPartyViaTableOrPair(
  table: RestaurantTable,
  allTables: RestaurantTable[],
  partySize: number,
  needsWheelchair: boolean,
  reservedIds: Set<string>,
): { possible: boolean; pairIds: string[] } {
  if (reservedIds.has(table.id)) {
    return { possible: false, pairIds: [] };
  }
  if (needsWheelchair && !table.isAccessible) {
    return { possible: false, pairIds: [] };
  }
  if (!isTableOpenForBooking(table)) {
    return { possible: false, pairIds: [] };
  }
  if (table.capacity >= partySize) {
    return { possible: true, pairIds: [table.id] };
  }
  if (table.combinableWith) {
    const partner = allTables.find((t) => t.id === table.combinableWith);
    if (
      partner &&
      !reservedIds.has(partner.id) &&
      (!needsWheelchair || partner.isAccessible) &&
      isTableOpenForBooking(partner) &&
      table.capacity + partner.capacity >= partySize
    ) {
      return {
        possible: true,
        pairIds: [table.id, partner.id].sort(),
      };
    }
  }
  return { possible: false, pairIds: [] };
}

export function classifyTableForBooking(
  table: RestaurantTable,
  allTables: RestaurantTable[],
  reservations: ReservationRecord[],
  criteria: FloorMapFilterCriteria,
): TableClassification {
  const reservedIds = getReservedTableIdsForSlot(
    reservations,
    criteria.dateTime,
  );
  const bayesianProb = computeBayesianTurnoverProb(
    table.status,
    table.currentCourse,
    table.elapsedMins,
  );
  const bayesianPct = Math.round(bayesianProb * 100);

  if (criteria.pinnedTableIds.includes(table.id)) {
    return {
      state: 'SELECTED',
      selectable: true,
      bayesianPct,
      shortStatus:
        table.status === 'Free'
          ? 'Selected'
          : table.status === 'Paying'
          ? `Pinned · ${bayesianPct}%`
          : 'Selected (Clearing)',
      blockReason: null,
    };
  }

  if (reservedIds.has(table.id)) {
    return {
      state: 'SLOT_BOOKED',
      selectable: false,
      bayesianPct,
      shortStatus: 'Slot Booked',
      blockReason: `${table.id} (${table.label}) is already reserved for this time slot.`,
    };
  }

  if (table.status === 'Occupied') {
    return {
      state: 'OCCUPIED',
      selectable: false,
      bayesianPct,
      shortStatus: `${table.currentCourse} · ${table.elapsedMins}m`,
      blockReason: `${table.id} is currently Occupied (${table.currentCourse}, ${table.elapsedMins}m elapsed · ${bayesianPct}% chance free in 10m).`,
    };
  }

  if (criteria.needsWheelchair && !table.isAccessible) {
    return {
      state: 'RESTRICTED_R1',
      selectable: false,
      bayesianPct,
      shortStatus: 'Step-Free Off',
      blockReason: `Rule R1 active: ${table.id} is not step-free wheelchair accessible.`,
    };
  }

  const fit = canSeatPartyViaTableOrPair(
    table,
    allTables,
    criteria.partySize,
    criteria.needsWheelchair,
    reservedIds,
  );

  if (!fit.possible) {
    const partner = table.combinableWith
      ? allTables.find((t) => t.id === table.combinableWith)
      : null;
    const maxPossible = partner ? table.capacity + partner.capacity : table.capacity;
    return {
      state: 'CAPACITY_SMALL',
      selectable: false,
      bayesianPct,
      shortStatus: `${table.capacity} Seats Max`,
      blockReason:
        partner && maxPossible >= criteria.partySize
          ? `${table.id} (${table.capacity} seats) requires merging with ${partner.id}, which is currently unavailable.`
          : `${table.id} seats up to ${table.capacity} guests (${criteria.partySize} requested).`,
    };
  }

  if (criteria.aiRecommendedTableIds.includes(table.id)) {
    return {
      state: 'AI_RECOMMENDED',
      selectable: true,
      bayesianPct,
      shortStatus:
        table.status === 'Paying' ? `AI Match · ${bayesianPct}%` : 'AI Match',
      blockReason: null,
    };
  }

  if (table.status === 'Paying') {
    return {
      state: 'BAYESIAN_SOON',
      selectable: true,
      bayesianPct,
      shortStatus: `Free ≤10m · ${bayesianPct}%`,
      blockReason: null,
    };
  }

  if (table.status === 'Dirty') {
    return {
      state: 'CLEARING',
      selectable: true,
      bayesianPct,
      shortStatus: 'Clearing · ~3m',
      blockReason: null,
    };
  }

  return {
    state: 'AVAILABLE',
    selectable: true,
    bayesianPct,
    shortStatus: 'Available',
    blockReason: null,
  };
}

export function resolveTableClickSelection(
  allTables: RestaurantTable[],
  reservations: ReservationRecord[],
  clickedTableId: string,
  criteria: Omit<FloorMapFilterCriteria, 'pinnedTableIds' | 'aiRecommendedTableIds'>,
): TableClickResolution {
  const table = allTables.find((t) => t.id === clickedTableId);
  if (!table) {
    return {
      accepted: false,
      selectedTableIds: [],
      resolvedZone: null,
      reason: `Table ${clickedTableId} not found on floor plan.`,
    };
  }

  const classification = classifyTableForBooking(table, allTables, reservations, {
    ...criteria,
    pinnedTableIds: [],
    aiRecommendedTableIds: [],
  });

  if (!classification.selectable) {
    return {
      accepted: false,
      selectedTableIds: [],
      resolvedZone: null,
      reason:
        classification.blockReason ??
        `${table.id} cannot accommodate the current selection.`,
    };
  }

  const reservedIds = getReservedTableIdsForSlot(
    reservations,
    criteria.dateTime,
  );
  const fit = canSeatPartyViaTableOrPair(
    table,
    allTables,
    criteria.partySize,
    criteria.needsWheelchair,
    reservedIds,
  );

  if (!fit.possible || fit.pairIds.length === 0) {
    return {
      accepted: false,
      selectedTableIds: [],
      resolvedZone: null,
      reason: `${table.id} cannot seat ${criteria.partySize} guests right now.`,
    };
  }

  const isMerged = fit.pairIds.length > 1;
  return {
    accepted: true,
    selectedTableIds: fit.pairIds,
    resolvedZone: table.zone,
    reason: isMerged
      ? `Rule R2 auto-paired ${fit.pairIds.join(' + ')} in ${table.zone} for ${criteria.partySize} guests.`
      : `Selected ${table.label} (${table.capacity} seats · ${table.zone}).`,
  };
}

export function computeFloorOccupancySummary(
  tables: RestaurantTable[],
  reservations: ReservationRecord[],
  dateTime: string,
): FloorOccupancySummary {
  const reservedIds = getReservedTableIdsForSlot(reservations, dateTime);
  let free = 0;
  let payingSoon = 0;
  let occupied = 0;
  let clearing = 0;
  let totalSeats = 0;
  let availableSeatsNow = 0;

  for (const t of tables) {
    totalSeats += t.capacity;
    if (reservedIds.has(t.id) || t.status === 'Occupied') {
      occupied += 1;
    } else if (t.status === 'Free') {
      free += 1;
      availableSeatsNow += t.capacity;
    } else if (t.status === 'Paying') {
      payingSoon += 1;
      availableSeatsNow += t.capacity;
    } else if (t.status === 'Dirty') {
      clearing += 1;
      availableSeatsNow += t.capacity;
    }
  }

  return {
    free,
    payingSoon,
    occupied,
    clearing,
    totalSeats,
    availableSeatsNow,
  };
}
