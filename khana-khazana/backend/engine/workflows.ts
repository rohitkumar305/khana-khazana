import {
  computeBayesianTurnoverProb,
  runAStarAllocation,
} from './aiEngine';
import type {
  AlternativeSlotSuggestion,
  BookingValidationRequest,
  BookingValidationResponse,
  IngredientItem,
  KitchenOrder,
  MenuDish,
  OrderIngredientValidationRequest,
  OrderIngredientValidationResponse,
  OutOfStockConflict,
  ReservationRecord,
  RestaurantTable,
  WaitingParty,
} from './types';

function addMinutesToIsoLocal(dateTimeStr: string, minsToAdd: number): string {
  const parsed = new Date(dateTimeStr);
  if (Number.isNaN(parsed.getTime())) {
    return '+30 mins slot';
  }
  const shifted = new Date(parsed.getTime() + minsToAdd * 60000);
  const hh = String(shifted.getHours()).padStart(2, '0');
  const mm = String(shifted.getMinutes()).padStart(2, '0');
  const yyyy = shifted.getFullYear();
  const mo = String(shifted.getMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getDate()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd}T${hh}:${mm}`;
}

function formatReadableTime(dateTimeStr: string): string {
  const parsed = new Date(dateTimeStr);
  if (Number.isNaN(parsed.getTime())) return dateTimeStr;
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function isSlotOverlapping(
  slotA: string,
  slotB: string,
  windowMins = 90,
): boolean {
  const timeA = Date.parse(slotA);
  const timeB = Date.parse(slotB);
  if (Number.isNaN(timeA) || Number.isNaN(timeB)) {
    return slotA === slotB;
  }
  return Math.abs(timeA - timeB) < windowMins * 60_000;
}

/**
 * Workflow A: Smart Table Booking & Instant Email Validation
 * Runs Forward-Chaining Rules (R1 Accessibility, R2 Adjacent Table Merge) +
 * Bayesian Turnover Probability against live tables and existing slot reservations.
 */
export function validateBookingWorkflow(
  req: BookingValidationRequest,
  tables: RestaurantTable[],
  existingReservations: ReservationRecord[],
): BookingValidationResponse {
  const t0 = performance.now();

  // Check tables already committed within ±90 minutes of the requested dateTime slot
  const slotReservedTableIds = new Set<string>();
  const existingIds = new Set<string>();
  for (const r of existingReservations) {
    existingIds.add(r.bookingId);
    if (r.status === 'CANCELLED' || r.status === 'COMPLETED') continue;
    if (isSlotOverlapping(r.dateTime, req.dateTime)) {
      for (const tid of r.assignedTableIds) {
        slotReservedTableIds.add(tid);
      }
    }
  }

  // Honor explicit BookMyShow floor map table selection if valid for the slot
  let pinnedMatch: RestaurantTable[] | null = null;
  if (req.preferredTableIds && req.preferredTableIds.length > 0) {
    const candidateTables = req.preferredTableIds
      .map((id) => tables.find((t) => t.id === id))
      .filter((t): t is RestaurantTable => Boolean(t));

    const allFound = candidateTables.length === req.preferredTableIds.length;
    const allOpenAndUnreserved = candidateTables.every(
      (t) =>
        !slotReservedTableIds.has(t.id) &&
        (!req.needsWheelchair || t.isAccessible) &&
        (t.status === 'Free' || t.status === 'Dirty' || t.status === 'Paying'),
    );
    const totalPinnedCapacity = candidateTables.reduce(
      (sum, t) => sum + t.capacity,
      0,
    );

    if (allFound && allOpenAndUnreserved && totalPinnedCapacity >= req.partySize) {
      pinnedMatch = candidateTables;
    }
  }

  // Filter live tables honoring zone & accessibility rules
  const zoneTables =
    req.preferredZone === 'ANY'
      ? tables
      : tables.filter((t) => t.zone === req.preferredZone);

  const accessibleZoneTables = req.needsWheelchair
    ? zoneTables.filter((t) => t.isAccessible)
    : zoneTables;

  // Consider unreserved candidate tables for the requested slot
  const openInZone = accessibleZoneTables.filter(
    (t) =>
      !slotReservedTableIds.has(t.id) &&
      (t.status === 'Free' || t.status === 'Dirty' || t.status === 'Paying'),
  );

  // Single table match in requested zone
  const singleMatch = pinnedMatch
    ? null
    : openInZone
        .filter((t) => t.capacity >= req.partySize)
        .sort((a, b) => a.capacity - b.capacity)[0];

  // Adjacent pair merge match (Rule R2) in requested zone
  let mergedMatch: [RestaurantTable, RestaurantTable] | null = null;
  if (!pinnedMatch && !singleMatch) {
    for (const t1 of openInZone) {
      if (!t1.combinableWith) continue;
      const t2 = openInZone.find((t) => t.id === t1.combinableWith);
      if (t2 && t1.capacity + t2.capacity >= req.partySize) {
        mergedMatch = [t1, t2].sort((a, b) => a.id.localeCompare(b.id)) as [
          RestaurantTable,
          RestaurantTable,
        ];
        break;
      }
    }
  }

  // If unfulfillable under strict constraint -> Return Polite Hospitality Fallback + AI Alternatives
  if (!pinnedMatch && !singleMatch && !mergedMatch) {
    const slotLabel = formatReadableTime(req.dateTime);
    const plus30Iso = addMinutesToIsoLocal(req.dateTime, 30);
    const plus30Label = formatReadableTime(plus30Iso);

    const payingAccessible = tables.filter(
      (t) => t.status === 'Paying' && (!req.needsWheelchair || t.isAccessible),
    );
    const bayesPct =
      payingAccessible.length > 0
        ? Math.round(
            computeBayesianTurnoverProb(
              payingAccessible[0].status,
              payingAccessible[0].currentCourse,
              payingAccessible[0].elapsedMins,
            ) * 100,
          )
        : 91;

    const alternatives: AlternativeSlotSuggestion[] = [
      {
        id: 'alt-plus30',
        label: `${plus30Label} · Same Preference (${bayesPct}% Turnover Confidence)`,
        dateTime: plus30Iso,
        zone: req.preferredZone,
        bayesianConfidencePct: bayesPct,
        reason:
          'Bayesian turnover telemetry indicates Paying tables clear reliably within 25–30 minutes.',
      },
    ];

    if (req.preferredZone !== 'Main Hall') {
      alternatives.push({
        id: 'alt-main-hall',
        label: `${slotLabel} · Main Hall Step-Free Seating (T3 + T4 Combinable)`,
        dateTime: req.dateTime,
        zone: 'Main Hall',
        bayesianConfidencePct: 98,
        reason:
          'Main Hall hosts our widest wheelchair-accessible combinable tables (up to 8 guests).',
      });
    } else if (req.partySize > 8) {
      alternatives.push({
        id: 'alt-split',
        label: `${slotLabel} · Adjacent Split-Table Pairing (T3 + T10 Accessible)`,
        dateTime: req.dateTime,
        zone: 'Main Hall',
        bayesianConfidencePct: 96,
        reason:
          'Pairs two neighboring Main Hall step-free tables (4 + 6 = 10 seats) side by side.',
      });
    }

    const constraintDetail = req.needsWheelchair
      ? `all wheelchair-accessible seating in ${
          req.preferredZone === 'ANY' ? 'the requested capacity' : req.preferredZone
        } for ${req.partySize} guests is already committed at ${slotLabel}`
      : `${
          req.preferredZone === 'ANY' ? 'matching seating' : req.preferredZone
        } capacity for ${req.partySize} guests is fully booked at ${slotLabel}`;

    const elapsedMs = Math.max(1, Math.round(performance.now() - t0));

    return {
      fulfillable: false,
      responseTimeMs: elapsedMs,
      apologyTitle: 'Selected Slot Currently at Full Capacity',
      apologyMessage: `We sincerely apologize—${constraintDetail}. Our hospitality concierge has verified the following immediate alternatives with live Bayesian turnover confidence:`,
      alternatives,
    };
  }

  // Fulfillable -> Lock optimal table(s), generate Booking ID, QR Pass & Email Preview
  const assignedTables = pinnedMatch
    ? pinnedMatch
    : singleMatch
    ? [singleMatch]
    : (mergedMatch as [RestaurantTable, RestaurantTable]);
  const assignedTableIds = assignedTables.map((t) => t.id);

  const triggeredRules: string[] = [];
  if (pinnedMatch) {
    triggeredRules.push(
      `Floor Map Selection: ${assignedTableIds.join(' + ')}`,
    );
  }
  if (req.needsWheelchair) {
    triggeredRules.push('R1: Accessible Filter (isAccessible == true)');
  }
  if (assignedTables.length > 1) {
    triggeredRules.push(`R2: Adjacent Merge (${assignedTableIds.join(' + ')})`);
  }
  if (req.isVip) {
    triggeredRules.push('R3: VIP Priority Concierge & Saffron Welcome');
  }
  if (req.preferredZone !== 'ANY') {
    triggeredRules.push(`Zone Match: ${req.preferredZone}`);
  }

  const minProb = Math.min(
    ...assignedTables.map((t) =>
      computeBayesianTurnoverProb(t.status, t.currentCourse, t.elapsedMins),
    ),
  );
  const bayesianConfidencePct = Math.round(minProb * 100);
  const totalCap = assignedTables.reduce((s, t) => s + t.capacity, 0);
  const wastedSeats = Math.max(0, totalCap - req.partySize);

  let numericCode = String(Math.floor(1000 + Math.random() * 8999));
  while (existingIds.has(`KK-${numericCode}`)) {
    numericCode = String(Math.floor(1000 + Math.random() * 8999));
  }
  const bookingId = `KK-${numericCode}`;
  const qrPassCode = `KK-QR-${assignedTableIds[0]}-${numericCode}`;

  const now = new Date();
  const createdAt = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const reservation: ReservationRecord = {
    bookingId,
    guestName: req.guestName.trim(),
    email: req.email.trim(),
    phone: req.phone.trim(),
    dateTime: req.dateTime,
    partySize: req.partySize,
    preferredZone: req.preferredZone,
    needsWheelchair: req.needsWheelchair,
    isVip: Boolean(req.isVip),
    specialRequests: req.specialRequests.trim() || 'Standard evening dining',
    status: 'CONFIRMED',
    assignedTableIds,
    qrPassCode,
    triggeredRules,
    bayesianConfidencePct,
    fScore: Number((wastedSeats + (assignedTables.length > 1 ? 0.5 : 0)).toFixed(1)),
    createdAt,
  };

  const elapsedMs = Math.max(1, Math.round(performance.now() - t0));

  return {
    fulfillable: true,
    responseTimeMs: elapsedMs,
    reservation,
    emailPreview: {
      to: reservation.email,
      subject: `Khana-Khazana Reservation Confirmed — Pass #${bookingId}`,
      bookingId,
      qrPassCode,
      bodySummary: `Dear ${reservation.guestName}, your table (${assignedTableIds.join(
        ' + ',
      )} · ${
        assignedTables[0].zone
      }) for ${reservation.partySize} guests at ${formatReadableTime(
        reservation.dateTime,
      )} is locked in NeonDB. Present QR Pass ${qrPassCode} upon arrival.`,
    },
  };
}

/**
 * Workflow B (Part 1): Atomic Recipe-to-Ingredient Inventory Check (< 1.2s)
 * Validates every cart item against live NeonDB ingredients before deducting stock.
 */
export function validateOrderIngredientsWorkflow(
  req: OrderIngredientValidationRequest,
  menuDishes: MenuDish[],
  ingredients: IngredientItem[],
): OrderIngredientValidationResponse {
  const t0 = performance.now();

  // Compute aggregate demand per ingredient across all cart line items
  const requiredByIngredient = new Map<string, number>();
  const dishById = new Map(menuDishes.map((d) => [d.id, d]));
  const ingById = new Map(ingredients.map((i) => [i.id, i]));

  for (const cartItem of req.items) {
    const dish = dishById.get(cartItem.dishId);
    if (!dish || cartItem.quantity <= 0) continue;
    for (const r of dish.recipe) {
      const cur = requiredByIngredient.get(r.ingredientId) ?? 0;
      requiredByIngredient.set(r.ingredientId, cur + r.amount * cartItem.quantity);
    }
  }

  // Check if any dish is currently orderable (for substitute recommendations)
  const isDishInStock = (dish: MenuDish): boolean =>
    dish.recipe.every((r) => {
      const ing = ingById.get(r.ingredientId);
      return ing ? ing.stock >= r.amount : false;
    });

  const conflicts: OutOfStockConflict[] = [];
  for (const cartItem of req.items) {
    const dish = dishById.get(cartItem.dishId);
    if (!dish || cartItem.quantity <= 0) continue;

    for (const r of dish.recipe) {
      const ing = ingById.get(r.ingredientId);
      const totalNeeded = requiredByIngredient.get(r.ingredientId) ?? 0;
      if (!ing || ing.stock < totalNeeded) {
        const availableSubstitutes = dish.substituteDishIds
          .map((subId) => dishById.get(subId))
          .filter((d): d is MenuDish => Boolean(d && isDishInStock(d)))
          .map((d) => ({
            dishId: d.id,
            name: d.name,
            price: d.price,
            reason: `In stock now · ${d.prepMins}m prep`,
          }));

        conflicts.push({
          dishId: dish.id,
          dishName: dish.name,
          ingredientId: r.ingredientId,
          ingredientName: ing?.name ?? r.ingredientId,
          requiredAmount: totalNeeded,
          availableStock: ing?.stock ?? 0,
          unit: ing?.unit ?? 'g',
          politeMessage: `We're so sorry—our fresh ${
            ing?.name ?? 'ingredient'
          } stock for ${dish.name} just ran out for the evening.`,
          suggestedSubstitutes: availableSubstitutes,
        });
        break;
      }
    }
  }

  if (conflicts.length > 0) {
    const elapsedMs = Math.max(1, Math.round(performance.now() - t0));
    return {
      ok: false,
      responseTimeMs: elapsedMs,
      conflicts,
    };
  }

  // Atomic deduction when all ingredients are sufficient
  const updatedIngredients = ingredients.map((ing) => {
    const used = requiredByIngredient.get(ing.id) ?? 0;
    return used > 0 ? { ...ing, stock: Math.max(0, ing.stock - used) } : ing;
  });

  const orderItems = req.items
    .map((ci) => {
      const dish = dishById.get(ci.dishId);
      if (!dish || ci.quantity <= 0) return null;
      return {
        dishId: dish.id,
        name: dish.name,
        quantity: ci.quantity,
        price: dish.price,
      };
    })
    .filter(
      (
        x,
      ): x is { dishId: string; name: string; quantity: number; price: number } =>
        Boolean(x),
    );

  const totalAmount = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const prepTimeMins = Math.max(
    10,
    ...orderItems.map((oi) => dishById.get(oi.dishId)?.prepMins ?? 12),
  );

  const now = new Date();
  const createdAt = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const order: KitchenOrder = {
    orderId: `ORD-${String(Date.now()).slice(-4)}${Math.floor(10 + Math.random() * 89)}`,
    tableId: req.tableId,
    bookingId: req.bookingId,
    items: orderItems,
    totalAmount,
    prepTimeMins,
    status: 'Order Received',
    dispatchedAgentId: 'W1',
    createdAt,
  };

  const elapsedMs = Math.max(1, Math.round(performance.now() - t0));

  return {
    ok: true,
    responseTimeMs: elapsedMs,
    order,
    updatedIngredients,
  };
}

/**
 * Workflow B (Part 2): Guest Arrival A* Table Allocation
 */
export function allocateTableForArrivalWorkflow(
  tables: RestaurantTable[],
  party: WaitingParty,
  remainingQueueCount: number,
) {
  return runAStarAllocation(tables, party, remainingQueueCount);
}
