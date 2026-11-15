import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_TABLES,
  INITIAL_QUEUE,
  INITIAL_WAITERS,
  INITIAL_RESERVATIONS,
  INITIAL_INGREDIENTS,
  MENU_DISHES,
  SIGNATURE_MENU_KNOWLEDGE_BASE,
} from './data';
import {
  computeBayesianTurnoverProb,
  computeFloorEfficiency,
  runAStarAllocation,
  runSearchBenchmarks,
  stepMultiAgentSimulation,
  compareTurnoverModels,
  predictCustomPartyDuration,
  computeFairnessAudit,
} from './aiEngine';
import {
  isSlotOverlapping,
  validateBookingWorkflow,
  validateOrderIngredientsWorkflow,
} from './workflows';
import {
  buildGroqKnowledgeContext,
  evaluateGroundedMaitreD,
  HALLUCINATION_REFUSAL_TEXT,
  isExplicitOutOfScopeQuery,
} from './ragGrounding';
import {
  classifyTableForBooking,
  computeFloorOccupancySummary,
  getReservedTableIdsForSlot,
  resolveTableClickSelection,
} from '../../frontend/src/engine/floorMapHelpers';
import type { ReservationRecord, RestaurantTable, WaitingParty } from './types';

function makeActiveFloorFixture(): RestaurantTable[] {
  return INITIAL_TABLES.map((t) => {
    if (t.id === 'T1') {
      return {
        ...t,
        status: 'Occupied',
        currentCourse: 'Mains',
        elapsedMins: 28,
        assignedPartyId: 'FIX-1',
        assignedPartyName: 'Couple One',
        assignedPartySize: 2,
      };
    }
    if (t.id === 'T2') {
      return {
        ...t,
        status: 'Dirty',
        currentCourse: 'None',
        elapsedMins: 0,
        activeBookingId: 'KK-OLD',
      };
    }
    if (t.id === 'T5') {
      return {
        ...t,
        status: 'Paying',
        currentCourse: 'Billing',
        elapsedMins: 54,
        assignedPartyId: 'FIX-5',
        assignedPartyName: 'Window Party',
        assignedPartySize: 4,
        activeBookingId: 'KK-5001',
      };
    }
    if (t.id === 'T8') {
      return {
        ...t,
        status: 'Occupied',
        currentCourse: 'Dessert',
        elapsedMins: 42,
        assignedPartyId: 'FIX-8',
        assignedPartyName: 'VIP Salon Group',
        assignedPartySize: 5,
      };
    }
    if (t.id === 'T9') {
      return {
        ...t,
        status: 'Occupied',
        currentCourse: 'Appetizer',
        elapsedMins: 12,
        assignedPartyId: 'FIX-9',
        assignedPartyName: 'Suite Party',
        assignedPartySize: 4,
      };
    }
    if (t.id === 'T10') {
      return {
        ...t,
        status: 'Paying',
        currentCourse: 'Billing',
        elapsedMins: 56,
        assignedPartyId: 'FIX-10',
        assignedPartyName: 'Heritage Table',
        assignedPartySize: 6,
      };
    }
    return { ...t };
  });
}

function makeFixtureReservations(): ReservationRecord[] {
  return [
    {
      bookingId: 'KK-1001',
      guestName: 'Meera Guest',
      email: 'meera@example.com',
      phone: '+91 98200 11111',
      dateTime: '2026-11-20T20:00',
      partySize: 4,
      preferredZone: 'Main Hall',
      needsWheelchair: true,
      isVip: false,
      specialRequests: 'Step-free access',
      status: 'CONFIRMED',
      assignedTableIds: ['T3'],
      qrPassCode: 'KK-QR-T3-1001',
      triggeredRules: ['R1: Accessible Filter'],
      bayesianConfidencePct: 98,
      fScore: 0,
      createdAt: '18:00:00',
    },
    {
      bookingId: 'KK-1002',
      guestName: 'VIP Guest',
      email: 'vip@example.com',
      phone: '+91 98200 22222',
      dateTime: '2026-11-20T20:00',
      partySize: 4,
      preferredZone: 'VIP Lounge',
      needsWheelchair: true,
      isVip: true,
      specialRequests: 'VIP wheelchair corner',
      status: 'CONFIRMED',
      assignedTableIds: ['T9'],
      qrPassCode: 'KK-QR-T9-1002',
      triggeredRules: ['R1: Accessible Filter'],
      bayesianConfidencePct: 98,
      fScore: 0,
      createdAt: '18:05:00',
    },
  ];
}

test('Clean initial state has 10 Free tables, empty operational lists, and 0% initial floor efficiency', () => {
  assert.equal(INITIAL_TABLES.length, 10);
  assert.equal(INITIAL_TABLES.every((t) => t.status === 'Free'), true);
  assert.equal(INITIAL_QUEUE.length, 0);
  assert.equal(INITIAL_RESERVATIONS.length, 0);
  const eff = computeFloorEfficiency(INITIAL_TABLES);
  assert.equal(eff.freeCount, 10);
  assert.equal(eff.occupiedCount, 0);
  assert.equal(eff.seatEfficiencyPct, 0);
  assert.equal(eff.avgTurnoverRateMins, 0);
});

test('MENU_DISHES aligns with SIGNATURE_MENU_KNOWLEDGE_BASE prices and includes cashew/pistachio recipes', () => {
  for (const kbDish of SIGNATURE_MENU_KNOWLEDGE_BASE) {
    const found = MENU_DISHES.find((d) => d.name === kbDish.name);
    assert.ok(found, `Missing dish ${kbDish.name} in MENU_DISHES`);
    assert.equal(found.price, kbDish.price, `Price mismatch on ${kbDish.name}`);
  }
  const pbm = MENU_DISHES.find((d) => d.id === 'dish-paneer-butter-masala');
  assert.ok(pbm?.recipe.some((r) => r.ingredientId === 'ing-cashew'));
  const gj = MENU_DISHES.find((d) => d.id === 'dish-gulab-jamun');
  assert.ok(gj?.recipe.some((r) => r.ingredientId === 'ing-pistachio'));
});

test('Bayesian turnover probability rises monotonically from Appetizer to Billing', () => {
  const appetizer = computeBayesianTurnoverProb('Occupied', 'Appetizer', 12);
  const mains = computeBayesianTurnoverProb('Occupied', 'Mains', 30);
  const dessert = computeBayesianTurnoverProb('Occupied', 'Dessert', 45);
  const billing = computeBayesianTurnoverProb('Paying', 'Billing', 55);

  assert.ok(appetizer < mains, 'Appetizer prob < Mains prob');
  assert.ok(mains < dessert, 'Mains prob < Dessert prob');
  assert.ok(dessert < billing, 'Dessert prob < Billing prob');
  assert.ok(billing >= 0.75, 'Paying/Billing prob must pass 75% pre-alloc threshold');
});

test('Rule R1 strictly enforces wheelchair accessibility during A* allocation', () => {
  const wheelchairParty: WaitingParty = {
    id: 'TEST-WC',
    name: 'Test Accessible',
    size: 2,
    isVip: false,
    needsWheelchair: true,
    preferredZone: 'Window',
    waitMins: 5,
    status: 'WAITING',
  };

  const result = runAStarAllocation(INITIAL_TABLES, wheelchairParty, 0);
  assert.equal(result.success, true);
  assert.ok(result.triggeredRules.some((r) => r.includes('R1')));
  const assignedTable = INITIAL_TABLES.find(
    (t) => t.id === result.assignedTableIds[0],
  );
  assert.equal(assignedTable?.isAccessible, true);
});

test('Rule R2 merges adjacent tables T3 + T4 for accessible party of 8 with zero wasted seats', () => {
  const largeParty: WaitingParty = {
    id: 'TEST-LG',
    name: 'Banquet Eight',
    size: 8,
    isVip: false,
    needsWheelchair: true,
    preferredZone: 'Main Hall',
    waitMins: 3,
    status: 'WAITING',
  };

  const result = runAStarAllocation(INITIAL_TABLES, largeParty, 0);
  assert.equal(result.success, true);
  assert.equal(result.isMerged, true);
  assert.deepEqual(result.assignedTableIds, ['T3', 'T4']);
  assert.equal(result.wastedSeats, 0);
});

test('Rule R3 triggers complimentary starter for VIP wait > 10 mins and respects A* weights', () => {
  const tables = makeActiveFloorFixture();
  const vipWaiting: WaitingParty = {
    id: 'TEST-VIP',
    name: 'VIP Guest',
    size: 5,
    isVip: true,
    needsWheelchair: false,
    preferredZone: 'VIP Lounge',
    waitMins: 14,
    status: 'WAITING',
  };

  const resultDefault = runAStarAllocation(tables, vipWaiting, 1, {
    w1Waste: 1,
    w2Wait: 1,
  });
  const resultHeavyWaste = runAStarAllocation(tables, vipWaiting, 1, {
    w1Waste: 3,
    w2Wait: 1,
  });

  assert.equal(resultDefault.success, true);
  assert.equal(resultDefault.complimentaryStarterTriggered, true);
  assert.ok(resultDefault.triggeredRules.some((r) => r.includes('R3')));
  assert.ok(resultHeavyWaste.hScore > resultDefault.hScore);
});

test('Workflow A confirms fulfillable bookings, detects ±90m overlaps, ignores cancelled/completed bookings, and suggests alternatives', () => {
  const reservations = makeFixtureReservations();
  const fulfillable = validateBookingWorkflow(
    {
      guestName: 'Meera Patel',
      email: 'meera@example.com',
      phone: '+91 98200 11122',
      dateTime: '2026-11-20T20:30',
      partySize: 4,
      preferredZone: 'Main Hall',
      needsWheelchair: true,
      specialRequests: 'Window adjacent if possible',
    },
    INITIAL_TABLES,
    reservations,
  );
  assert.equal(fulfillable.fulfillable, true);
  assert.ok(fulfillable.reservation?.bookingId.startsWith('KK-'));
  assert.ok(fulfillable.emailPreview?.to === 'meera@example.com');

  // Verify ±90m overlap detection and that CANCELLED bookings do NOT block
  assert.equal(isSlotOverlapping('2026-11-20T20:00', '2026-11-20T20:45'), true);
  assert.equal(isSlotOverlapping('2026-11-20T20:00', '2026-11-20T22:00'), false);

  const cancelledList: ReservationRecord[] = reservations.map((r) => ({
    ...r,
    status: 'CANCELLED',
  }));
  assert.equal(getReservedTableIdsForSlot(cancelledList, '2026-11-20T20:15').size, 0);

  // Conflict: VIP Lounge wheelchair-accessible T9 is reserved at 20:00 -> 20:15 overlaps
  const unfulfillable = validateBookingWorkflow(
    {
      guestName: 'Conflict Group',
      email: 'conflict@example.com',
      phone: '+91 98200 33344',
      dateTime: '2026-11-20T20:15',
      partySize: 4,
      preferredZone: 'VIP Lounge',
      needsWheelchair: true,
      specialRequests: 'VIP accessible for 4',
    },
    INITIAL_TABLES,
    reservations,
  );
  assert.equal(unfulfillable.fulfillable, false);
  assert.ok(unfulfillable.apologyMessage);
  assert.ok((unfulfillable.alternatives?.length ?? 0) >= 2);
});

test('Workflow B atomically deducts recipe ingredients when in stock and detects out-of-stock substitutes cleanly', () => {
  const inStockResp = validateOrderIngredientsWorkflow(
    {
      tableId: 'T3',
      bookingId: 'KK-TEST1',
      items: [{ dishId: 'dish-truffle-paneer', quantity: 2 }],
    },
    MENU_DISHES,
    INITIAL_INGREDIENTS,
  );
  assert.equal(inStockResp.ok, true);
  assert.ok(inStockResp.order);
  const truffleAfter = inStockResp.updatedIngredients?.find(
    (i) => i.id === 'ing-truffle',
  );
  assert.equal(truffleAfter?.stock, 60); // 90 - 2*15

  const zeroTruffle = INITIAL_INGREDIENTS.map((i) =>
    i.id === 'ing-truffle' ? { ...i, stock: 0 } : i,
  );
  const outStockResp = validateOrderIngredientsWorkflow(
    {
      tableId: 'T3',
      bookingId: 'KK-TEST1',
      items: [{ dishId: 'dish-truffle-paneer', quantity: 1 }],
    },
    MENU_DISHES,
    zeroTruffle,
  );
  assert.equal(outStockResp.ok, false);
  assert.equal(outStockResp.conflicts?.[0].dishId, 'dish-truffle-paneer');
  assert.ok((outStockResp.conflicts?.[0].suggestedSubstitutes.length ?? 0) >= 1);
});

test('Search benchmark, MAS tick, ML predictor, fairness audit, and grounded RAG refusal all work', () => {
  const tables = makeActiveFloorFixture();
  const sampleQueue: WaitingParty[] = [
    {
      id: 'P-1',
      name: 'Vip One',
      size: 4,
      isVip: true,
      needsWheelchair: false,
      preferredZone: 'VIP Lounge',
      waitMins: 12,
      status: 'WAITING',
    },
    {
      id: 'P-2',
      name: 'Reg One',
      size: 2,
      isVip: false,
      needsWheelchair: false,
      preferredZone: 'Window',
      waitMins: 9,
      status: 'WAITING',
    },
  ];

  const benchmarks = runSearchBenchmarks(tables, sampleQueue);
  assert.equal(benchmarks.length, 4);
  assert.equal(benchmarks.find((b) => b.algorithm === 'A* Search')?.isOptimal, true);

  const sim = stepMultiAgentSimulation(tables, sampleQueue, INITIAL_WAITERS, 0);
  const clearedT2 = sim.tables.find((t) => t.id === 'T2');
  assert.equal(clearedT2?.status, 'Free');
  assert.equal(clearedT2?.activeBookingId, null);

  // On clean all-Free floor with empty queue, all waiters return to Standby
  const idleSim = stepMultiAgentSimulation(
    INITIAL_TABLES,
    INITIAL_QUEUE,
    INITIAL_WAITERS,
    0,
  );
  assert.equal(
    idleSim.waiters.every((w) => w.currentAction === 'Standby' && w.targetTableId === null),
    true,
  );

  const custom = predictCustomPartyDuration({
    size: 6,
    isWeekend: true,
    isPeakHour: true,
    orderedDrinks: true,
  });
  assert.equal(custom.symbolicTotalMins, 75);

  const { symbolicMae, mlMae } = compareTurnoverModels(tables);
  assert.ok(mlMae < symbolicMae);

  const audit = computeFairnessAudit(sampleQueue);
  assert.equal(typeof audit.fairnessScorePct, 'number');

  const refusal = evaluateGroundedMaitreD(
    'Do you have a rooftop swimming pool?',
    tables,
    sampleQueue,
    INITIAL_WAITERS,
    INITIAL_INGREDIENTS,
    makeFixtureReservations(),
  );
  assert.equal(refusal.refusalTriggered, true);
  assert.equal(refusal.reply, HALLUCINATION_REFUSAL_TEXT);
});

test('BookMyShow floor map helpers classify occupancy, enforce Rule R1/R2 on click, and lock preferredTableIds', () => {
  const tables = makeActiveFloorFixture();
  const reservations = makeFixtureReservations();

  const summary = computeFloorOccupancySummary(
    tables,
    reservations,
    '2026-11-20T22:00',
  );
  assert.equal(summary.free, 4);
  assert.equal(summary.payingSoon, 2);
  assert.equal(summary.occupied, 3);
  assert.equal(summary.clearing, 1);

  // Rule R1 blocks non-accessible T8 when wheelchair is required
  const blockedR1 = resolveTableClickSelection(
    INITIAL_TABLES,
    reservations,
    'T8',
    {
      partySize: 4,
      needsWheelchair: true,
      dateTime: '2026-11-20T22:00',
    },
  );
  assert.equal(blockedR1.accepted, false);
  assert.ok(blockedR1.reason.includes('Rule R1'));

  // Clicking T3 for party of 8 auto-merges T3 + T4 via Rule R2
  const mergedClick = resolveTableClickSelection(
    INITIAL_TABLES,
    reservations,
    'T3',
    {
      partySize: 8,
      needsWheelchair: true,
      dateTime: '2026-11-20T22:00',
    },
  );
  assert.equal(mergedClick.accepted, true);
  assert.deepEqual(mergedClick.selectedTableIds, ['T3', 'T4']);
  assert.equal(mergedClick.resolvedZone, 'Main Hall');

  // Slot-booked classification marks T3 as SLOT_BOOKED within ±90m of 20:00
  const t3 = INITIAL_TABLES.find((t) => t.id === 'T3')!;
  const bookedCls = classifyTableForBooking(
    t3,
    INITIAL_TABLES,
    reservations,
    {
      partySize: 4,
      needsWheelchair: true,
      dateTime: '2026-11-20T20:30',
      pinnedTableIds: [],
      aiRecommendedTableIds: [],
    },
  );
  assert.equal(bookedCls.state, 'SLOT_BOOKED');
  assert.equal(bookedCls.selectable, false);

  // Booking workflow honors pinnedTableIds ['T7'] when eligible
  const pinnedBooking = validateBookingWorkflow(
    {
      guestName: 'Kabir Mehta',
      email: 'kabir@example.com',
      phone: '+91 98200 99887',
      dateTime: '2026-11-20T22:00',
      partySize: 2,
      preferredZone: 'Window',
      needsWheelchair: true,
      specialRequests: 'Corner window',
      preferredTableIds: ['T7'],
    },
    INITIAL_TABLES,
    reservations,
  );
  assert.equal(pinnedBooking.fulfillable, true);
  assert.deepEqual(pinnedBooking.reservation?.assignedTableIds, ['T7']);
});

import {
  SVG_FLOOR_VIEWBOX,
  SVG_STATUS_COLORS,
  SVG_TABLE_BOXES,
  getChairRectanglesForNode,
} from '../../frontend/src/engine/svgFloorLayout';

test('SVG dashboard floor layout defines valid non-overlapping bounds and chair geometry for T1-T10', () => {
  for (const table of INITIAL_TABLES) {
    const box = SVG_TABLE_BOXES[table.id];
    assert.ok(box, `Missing SVG box for ${table.id}`);
    assert.ok(box.x >= 0 && box.x + box.width <= SVG_FLOOR_VIEWBOX.width);
    assert.ok(box.y >= 0 && box.y + box.height <= SVG_FLOOR_VIEWBOX.height);

    const chairs = getChairRectanglesForNode(box, table.capacity);
    assert.equal(chairs.length, table.capacity);
  }
  assert.equal(SVG_STATUS_COLORS.Free.stroke, '#059669');
  assert.equal(SVG_STATUS_COLORS.Occupied.stroke, '#DC2626');
});

import {
  evaluateScenarioComparison,
  SCENARIO_PRESETS,
} from '../../frontend/src/engine/scenarioComparison';

test('Teacher Algorithm Scenarios produce distinct worked decisions across BFS, DFS, Hill Climbing, and A*', () => {
  assert.equal(SCENARIO_PRESETS.length, 4);

  const scen1 = evaluateScenarioComparison('accessible-merge', { w1Waste: 1, w2Wait: 1 });
  const scen1Hc = scen1.decisions.find((d) => d.algorithm === 'Hill Climbing');
  const scen1AStar = scen1.decisions.find((d) => d.algorithm === 'A* Search');
  assert.equal(scen1Hc?.chosenTableIds.length, 0);
  assert.deepEqual(scen1AStar?.chosenTableIds, ['T3', 'T4']);

  const scen2 = evaluateScenarioComparison('couple-waste-trap', { w1Waste: 1, w2Wait: 1 });
  const scen2Bfs = scen2.decisions.find((d) => d.algorithm === 'BFS');
  const scen2Dfs = scen2.decisions.find((d) => d.algorithm === 'DFS');
  const scen2AStar = scen2.decisions.find((d) => d.algorithm === 'A* Search');
  assert.deepEqual(scen2Bfs?.chosenTableIds, ['T4']);
  assert.deepEqual(scen2Dfs?.chosenTableIds, ['T8']);
  assert.deepEqual(scen2AStar?.chosenTableIds, ['T7']);
  assert.equal(scen2AStar?.wastedSeats, 0);

  const scen3 = evaluateScenarioComparison('bayesian-vip-rush', { w1Waste: 1, w2Wait: 1 });
  const scen3AStar = scen3.decisions.find((d) => d.algorithm === 'A* Search');
  assert.deepEqual(scen3AStar?.chosenTableIds, ['T10']);

  const scen4 = evaluateScenarioComparison('symbolic-vs-ml', { w1Waste: 1, w2Wait: 1 });
  assert.ok(scen4.mlProbe, 'Scenario 4 includes ML & Bayesian probe');
  assert.ok(
    scen4.mlProbe.durationPrediction.mlTotalMins >
      scen4.mlProbe.durationPrediction.symbolicTotalMins,
  );
});

test('Groq RAG Grounding handles nut-free allergens, wheelchair party of 5, context injection, and strict refusal', () => {
  assert.equal(
    HALLUCINATION_REFUSAL_TEXT,
    'I cannot verify that information from our current restaurant knowledge base or live floor data.',
  );

  const nutFree = evaluateGroundedMaitreD(
    'Which dishes are nut-free?',
    INITIAL_TABLES,
    INITIAL_QUEUE,
    INITIAL_WAITERS,
    INITIAL_INGREDIENTS,
    INITIAL_RESERVATIONS,
  );
  assert.equal(nutFree.refusalTriggered, false);
  assert.ok(nutFree.reply.includes('Royal Zafrani Dum Biryani'));
  assert.ok(nutFree.reply.includes('Cashews') && nutFree.reply.includes('Pistachio'));
  assert.ok(nutFree.sources.includes('[restaurant_policies.md]'));

  const wheelchairFive = evaluateGroundedMaitreD(
    'Can a wheelchair party of 5 sit together?',
    INITIAL_TABLES,
    INITIAL_QUEUE,
    INITIAL_WAITERS,
    INITIAL_INGREDIENTS,
    INITIAL_RESERVATIONS,
  );
  assert.equal(wheelchairFive.refusalTriggered, false);
  assert.ok(wheelchairFive.reply.includes('T3') && wheelchairFive.reply.includes('T4'));
  assert.ok(wheelchairFive.sources.includes('[live_floor_db]'));

  const contextStr = buildGroqKnowledgeContext({
    portal: 'customer',
    tables: INITIAL_TABLES,
    queue: INITIAL_QUEUE,
    waiters: INITIAL_WAITERS,
    ingredients: INITIAL_INGREDIENTS,
    reservations: INITIAL_RESERVATIONS,
  });
  assert.ok(contextStr.includes('STATIC_KNOWLEDGE_BASE [restaurant_policies.md]'));
  assert.ok(contextStr.includes('LIVE_FLOOR_AND_KITCHEN_STATE [live_floor_db]'));
  assert.ok(contextStr.includes('11:30 AM'));
});

test('Groq RAG Grounding handles greetings/identity naturally, answers menu queries, and strictly refuses out-of-scope traps', () => {
  const greeting = evaluateGroundedMaitreD(
    'hi who you are',
    INITIAL_TABLES,
    INITIAL_QUEUE,
    INITIAL_WAITERS,
    INITIAL_INGREDIENTS,
    INITIAL_RESERVATIONS,
  );
  assert.equal(greeting.refusalTriggered, false);
  assert.ok(greeting.reply.includes('Khana-Khazana'));
  assert.ok(isExplicitOutOfScopeQuery('hi who you are') === false);

  const menuAsk = evaluateGroundedMaitreD(
    'What signature dishes do you recommend and what are prices?',
    INITIAL_TABLES,
    INITIAL_QUEUE,
    INITIAL_WAITERS,
    INITIAL_INGREDIENTS,
    INITIAL_RESERVATIONS,
  );
  assert.equal(menuAsk.refusalTriggered, false);
  assert.ok(menuAsk.reply.includes('₹'));

  assert.equal(isExplicitOutOfScopeQuery('Do you have a rooftop pool?'), true);
  const weatherRefusal = evaluateGroundedMaitreD(
    'What is the weather outside?',
    INITIAL_TABLES,
    INITIAL_QUEUE,
    INITIAL_WAITERS,
    INITIAL_INGREDIENTS,
    INITIAL_RESERVATIONS,
  );
  assert.equal(weatherRefusal.refusalTriggered, true);
  assert.equal(weatherRefusal.reply, HALLUCINATION_REFUSAL_TEXT);
});

import { normalizeApiBase } from '../../frontend/src/api/backendService';

test('normalizeApiBase rejects bare port strings like 3000 and localhost URLs on remote hosts', () => {
  assert.equal(normalizeApiBase('3000', 'khana-khazana-dun.vercel.app'), '');
  assert.equal(normalizeApiBase('localhost:3000', 'khana-khazana-dun.vercel.app'), '');
  assert.equal(normalizeApiBase('http://localhost:8000', 'khana-khazana-dun.vercel.app'), '');
  assert.equal(normalizeApiBase('http://localhost:3000', 'localhost'), 'http://localhost:3000');
  assert.equal(normalizeApiBase('https://api.khana-khazana.app/', 'khana-khazana-dun.vercel.app'), 'https://api.khana-khazana.app');
});
