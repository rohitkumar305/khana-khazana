import {
  computeBayesianTurnoverProb,
  computeFloorEfficiency,
  runAStarAllocation,
} from './aiEngine';
import {
  MENU_DISHES,
  RESTAURANT_POLICIES,
  RESTAURANT_POLICIES_CHUNKS,
  SIGNATURE_MENU_KNOWLEDGE_BASE,
} from './data';
import type {
  IngredientItem,
  MenuDish,
  ReservationRecord,
  RestaurantTable,
  WaitingParty,
  WaiterAgent,
} from './types';

export const HALLUCINATION_REFUSAL_TEXT =
  'I cannot verify that information from our current restaurant knowledge base or live floor data.';

const OUT_OF_SCOPE_PATTERNS = [
  /swimming\s*pool/i,
  /rooftop\s*pool/i,
  /\bpool\b/i,
  /\bspa\b/i,
  /helipad/i,
  /helicopter/i,
  /hotel\s*room/i,
  /casino/i,
  /bowling/i,
  /pet\s*groom/i,
  /cryptocurrency/i,
  /\bbitcoin\b/i,
  /stock\s*price/i,
  /weather/i,
  /\bflight\b/i,
  /\bmovie\b/i,
  /president/i,
  /prime\s*minister/i,
  /capital\s+of/i,
];

const GREETING_IDENTITY_PATTERNS = [
  /^\s*(hi|hello|hey|namaste|good\s*(morning|afternoon|evening))\b/i,
  /\bwho\s+(are\s+you|you\s+are|is\s+this)\b/i,
  /\bwhat\s+(are\s+you|can\s+you\s+do|do\s+you\s+do)\b/i,
  /\btell\s+me\s+about\s+(yourself|khana)\b/i,
  /\bhelp\b/i,
  /khana[-\s]?khazana/i,
];

export function isExplicitOutOfScopeQuery(query: string): boolean {
  return OUT_OF_SCOPE_PATTERNS.some((rx) => rx.test(query.toLowerCase()));
}

const IN_DOMAIN_KEYWORDS = [
  'table',
  't1',
  't2',
  't3',
  't4',
  't5',
  't6',
  't7',
  't8',
  't9',
  't10',
  'seat',
  'wheelchair',
  'access',
  'step-free',
  'vip',
  'complimentary',
  'starter',
  'papad',
  'r1',
  'r2',
  'r3',
  'r4',
  'combine',
  'merge',
  'wait',
  'queue',
  'bayes',
  'prob',
  'free',
  'paying',
  'dirty',
  'window',
  'main hall',
  'lounge',
  'zone',
  'waiter',
  'agent',
  'host',
  'arjun',
  'kavya',
  'rohan',
  'menu',
  'dish',
  'food',
  'eat',
  'recommend',
  'suggest',
  'popular',
  'signature',
  'best',
  'price',
  'cost',
  'veg',
  'vegetarian',
  'non-veg',
  'spicy',
  'dessert',
  'sweet',
  'butter naan',
  'paneer',
  'truffle',
  'dal',
  'makhani',
  'biryani',
  'zafrani',
  'saffron',
  'penne',
  'pizza',
  'burrata',
  'chicken',
  'paratha',
  'gulab',
  'jain',
  'vegan',
  'gluten',
  'nut',
  'cashew',
  'pistachio',
  'dairy',
  'allerg',
  'hour',
  'open',
  'close',
  'policy',
  'policies',
  'floor',
  'party',
  'group',
  'reservation',
  'booking',
  'book',
  'qr',
  'stock',
  'inventory',
  'ingredient',
  'fairness',
];

export function buildGroqKnowledgeContext(params: {
  portal: 'customer' | 'admin';
  tables: RestaurantTable[];
  queue: WaitingParty[];
  waiters: WaiterAgent[];
  ingredients: IngredientItem[];
  reservations: ReservationRecord[];
  menuDishes?: MenuDish[];
}): string {
  const {
    portal,
    tables,
    queue,
    waiters,
    ingredients,
    reservations,
    menuDishes = MENU_DISHES,
  } = params;

  const staticKnowledge = {
    brand: RESTAURANT_POLICIES.brandName,
    hours: RESTAURANT_POLICIES.hours,
    zones: RESTAURANT_POLICIES.zones,
    policies: RESTAURANT_POLICIES_CHUNKS.map((p) => ({
      id: p.id,
      section: p.section,
      source: p.sourceFile,
      rule: p.content,
    })),
    signatureMenuAndAllergens: SIGNATURE_MENU_KNOWLEDGE_BASE,
    qrMenuDishes: menuDishes.map((d) => ({
      id: d.id,
      name: d.name,
      priceInr: d.price,
      prepMins: d.prepMins,
      dietaryTags: d.dietaryTags,
    })),
  };

  const liveFloorDb = {
    portalView:
      portal === 'customer'
        ? 'Guest AI Concierge (Menu, Allergens, Availability & Accessibility)'
        : 'Admin Operations Maître D’ (Live Tables, Inventory, Queue & MAS)',
    tables: tables.map((t) => ({
      id: t.id,
      label: t.label,
      capacity: t.capacity,
      zone: t.zone,
      isAccessible: t.isAccessible,
      isVipBooth: t.isVipBooth,
      combinableWith: t.combinableWith,
      status: t.status,
      currentCourse: t.currentCourse,
      elapsedMins: t.elapsedMins,
      bayesianFreeIn10Pct: Math.round(
        computeBayesianTurnoverProb(t.status, t.currentCourse, t.elapsedMins) *
          100,
      ),
    })),
    activeWaitingQueue: queue.filter((p) => p.status === 'WAITING'),
    confirmedReservationsCount: reservations.length,
    livePantryStock: ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      stock: `${i.stock}${i.unit}`,
      parLevel: `${i.parLevel}${i.unit}`,
    })),
    activeWaiters: waiters.map((w) => ({
      id: w.id,
      zone: w.zone,
      action: w.currentAction,
      targetTableId: w.targetTableId,
    })),
  };

  return `STATIC_KNOWLEDGE_BASE [restaurant_policies.md]:
${JSON.stringify(staticKnowledge)}

LIVE_FLOOR_AND_KITCHEN_STATE [live_floor_db]:
${JSON.stringify(liveFloorDb)}`;
}

export function evaluateGroundedMaitreD(
  query: string,
  tables: RestaurantTable[],
  queue: WaitingParty[],
  waiters: WaiterAgent[],
  ingredients: IngredientItem[] = [],
  reservations: ReservationRecord[] = [],
): { reply: string; sources: string[]; refusalTriggered: boolean } {
  const q = query.toLowerCase().trim();

  if (isExplicitOutOfScopeQuery(q)) {
    return {
      reply: HALLUCINATION_REFUSAL_TEXT,
      sources: ['[restaurant_policies.md]', '[live_floor_db]'],
      refusalTriggered: true,
    };
  }

  const freeTables = tables.filter((t) => t.status === 'Free');
  const accessibleFree = freeTables.filter((t) => t.isAccessible);
  const payingTables = tables.filter((t) => t.status === 'Paying');
  const waiting = queue.filter((p) => p.status === 'WAITING');
  const eff = computeFloorEfficiency(tables);

  const isGreetingOrIdentity = GREETING_IDENTITY_PATTERNS.some((rx) => rx.test(q));
  const hasDomainAnchor = IN_DOMAIN_KEYWORDS.some((kw) => q.includes(kw));

  if (isGreetingOrIdentity && !hasDomainAnchor) {
    return {
      reply: `Namaste! I am the Khana-Khazana Grounded AI Concierge (${RESTAURANT_POLICIES.hours}, zones: Window, Main Hall & VIP Lounge). Currently ${freeTables.length}/${tables.length} tables are Free with ${waiting.length} queued parties—ask me about wheelchair seating (T3 + T4), nut-free or gluten-free dishes, live kitchen ingredient stock, or VIP policies.`,
      sources: ['[restaurant_policies.md]', '[live_floor_db]'],
      refusalTriggered: false,
    };
  }

  if (!hasDomainAnchor) {
    return {
      reply: HALLUCINATION_REFUSAL_TEXT,
      sources: ['[restaurant_policies.md]', '[live_floor_db]'],
      refusalTriggered: true,
    };
  }

  // 1. Live pantry / ingredient stock query
  if (
    q.includes('stock') ||
    q.includes('inventory') ||
    q.includes('ingredient') ||
    q.includes('truffle') ||
    q.includes('saffron') ||
    q.includes('penne')
  ) {
    if (ingredients.length > 0) {
      const truffleIng = ingredients.find((i) => i.id === 'ing-truffle');
      const paneerIng = ingredients.find((i) => i.id === 'ing-paneer');
      if (q.includes('truffle paneer tikka') && truffleIng && paneerIng) {
        const canMake = truffleIng.stock >= 15 && paneerIng.stock >= 220;
        return {
          reply: canMake
            ? `Yes — Truffle Paneer Tikka (₹540) is IN STOCK right now: live NeonDB pantry holds ${truffleIng.stock}${truffleIng.unit} Black Truffle Shavings (15g/order) and ${paneerIng.stock}${paneerIng.unit} Fresh Malai Paneer (220g/order).`
            : `Truffle Paneer Tikka is currently OUT OF STOCK (Black Truffle Shavings: ${truffleIng.stock}${truffleIng.unit}, Fresh Malai Paneer: ${paneerIng.stock}${paneerIng.unit}). Chef substitutes: 24-Hour Smoked Dal Makhani or Wood-Fired Truffle & Burrata Pizza.`,
          sources: ['[live_floor_db]', '[restaurant_policies.md]'],
          refusalTriggered: false,
        };
      }

      const lowOrZero = ingredients.filter((i) => i.stock <= i.parLevel * 0.2);
      const summary = ingredients
        .map((i) => `${i.name}: ${i.stock}${i.unit}`)
        .join(', ');
      return {
        reply:
          lowOrZero.length > 0
            ? `Kitchen Inventory Alert — low/out items: ${lowOrZero
                .map((i) => `${i.name} (${i.stock}${i.unit})`)
                .join(', ')}. Live stock snapshot: ${summary}.`
            : `All tracked kitchen ingredients are in stock: ${summary}.`,
        sources: ['[live_floor_db]', '[restaurant_policies.md]'],
        refusalTriggered: false,
      };
    }
  }

  // 2. Nut-free / Cashew / Pistachio dietary allergen query
  if (
    q.includes('nut-free') ||
    q.includes('nut free') ||
    q.includes('nuts') ||
    q.includes('cashew') ||
    q.includes('pistachio') ||
    q.includes('allerg')
  ) {
    const nutFreeList = SIGNATURE_MENU_KNOWLEDGE_BASE.filter((d) => d.nutFree)
      .map((d) => `${d.name} (₹${d.price} — ${d.allergens.join(', ')})`)
      .join('; ');
    const containsNuts = SIGNATURE_MENU_KNOWLEDGE_BASE.filter((d) => !d.nutFree)
      .map((d) => `${d.name} (${d.allergens.join(', ')})`)
      .join(' and ');

    return {
      reply: `Verified nut-free dishes: ${nutFreeList}. Avoid dishes containing tree nuts: ${containsNuts}.`,
      sources: ['[restaurant_policies.md]', '[live_floor_db]'],
      refusalTriggered: false,
    };
  }

  // 3. Wheelchair accessibility & combined seating query (including party of 5+)
  if (q.includes('wheelchair') || q.includes('access') || q.includes('r1')) {
    const sizeMatch = /\b([5-9]|10)\b/.exec(q);
    if (sizeMatch) {
      const requestedSize = Number(sizeMatch[1]);
      const probeParty: WaitingParty = {
        id: 'PROBE-WC',
        name: 'Accessible Group Inquiry',
        size: requestedSize,
        isVip: false,
        needsWheelchair: true,
        preferredZone: 'Main Hall',
        waitMins: 0,
        status: 'WAITING',
      };
      const probe = runAStarAllocation(tables, probeParty, waiting.length);
      const t3 = tables.find((t) => t.id === 'T3');
      const t4 = tables.find((t) => t.id === 'T4');
      const t10 = tables.find((t) => t.id === 'T10');
      return {
        reply: `Yes — a wheelchair party of ${requestedSize} can be seated together in the Main Hall. Step-free tables T3 (${t3?.status ?? 'Free'}) + T4 (${t4?.status ?? 'Free'}) combine into an ${
          (t3?.capacity ?? 4) + (t4?.capacity ?? 4)
        }-seat accessible setup (or 6-top T10 when Free, currently ${t10?.status ?? 'Paying'}). Live A* routing ${
          probe.success
            ? `locks ${probe.assignedTableIds.join(' + ')} (${probe.totalCapacity} seats, f=${probe.fScore}).`
            : 'queues for next accessible turn.'
        }`,
        sources: ['[restaurant_policies.md]', '[live_floor_db]'],
        refusalTriggered: false,
      };
    }

    const allAccessible = tables.filter((t) => t.isAccessible);
    const readyList =
      accessibleFree.length > 0
        ? accessibleFree
            .map((t) => `${t.id} (${t.capacity} seats, ${t.zone})`)
            .join(', ')
        : 'none immediately Free';
    const soonest = allAccessible
      .filter((t) => t.status !== 'Free')
      .map(
        (t) =>
          `${t.id} (${t.status}, P(Free₁₀)=${Math.round(
            computeBayesianTurnoverProb(t.status, t.currentCourse, t.elapsedMins) *
              100,
          )}%)`,
      )
      .join('; ');

    return {
      reply: `Rule R1 enforces step-free access across tables ${allAccessible
        .map((t) => t.id)
        .join(', ')} (with T3 + T4 combinable into an 8-seat accessible layout). Currently ${accessibleFree.length} accessible table${
        accessibleFree.length === 1 ? ' is' : 's are'
      } Free: ${readyList}. Other accessible tables in cadence: ${
        soonest || 'all currently open'
      }.`,
      sources: ['[live_floor_db]', '[restaurant_policies.md]'],
      refusalTriggered: false,
    };
  }

  // 4. VIP & Fairness Policy
  if (
    q.includes('vip') ||
    q.includes('complimentary') ||
    q.includes('starter') ||
    q.includes('papad') ||
    q.includes('fairness') ||
    q.includes('r3') ||
    q.includes('r4')
  ) {
    const vipTables = tables.filter((t) => t.isVipBooth);
    return {
      reply: `${RESTAURANT_POLICIES_CHUNKS[1].content} Live VIP Lounge & celebration booths: ${vipTables
        .map((t) => `${t.id} (${t.capacity} seats · ${t.status})`)
        .join(', ')}.`,
      sources: ['[restaurant_policies.md]', '[live_floor_db]'],
      refusalTriggered: false,
    };
  }

  // 5. Menu, Culinary Recommendations, Prices, Gluten-Free, Hours & Dietary
  if (
    q.includes('menu') ||
    q.includes('dish') ||
    q.includes('food') ||
    q.includes('eat') ||
    q.includes('recommend') ||
    q.includes('suggest') ||
    q.includes('popular') ||
    q.includes('signature') ||
    q.includes('best') ||
    q.includes('price') ||
    q.includes('cost') ||
    q.includes('veg') ||
    q.includes('non-veg') ||
    q.includes('spicy') ||
    q.includes('dessert') ||
    q.includes('sweet') ||
    q.includes('paneer') ||
    q.includes('pizza') ||
    q.includes('biryani') ||
    q.includes('gulab') ||
    q.includes('dal') ||
    q.includes('chicken') ||
    q.includes('paratha') ||
    q.includes('jain') ||
    q.includes('vegan') ||
    q.includes('gluten') ||
    q.includes('hour') ||
    q.includes('open')
  ) {
    const gfDishes = SIGNATURE_MENU_KNOWLEDGE_BASE.filter((d) => d.glutenFree)
      .map((d) => `${d.name} (₹${d.price})`)
      .join(', ');
    const signaturePrices = MENU_DISHES.slice(0, 4)
      .map((d) => `${d.name} (₹${d.price})`)
      .join(', ');
    return {
      reply: `Hours: ${RESTAURANT_POLICIES.hours}. Signature highlights include ${signaturePrices}. ${RESTAURANT_POLICIES_CHUNKS[3].content} Verified Gluten-Free selections: ${gfDishes}.`,
      sources: ['[restaurant_policies.md]', '[live_floor_db]'],
      refusalTriggered: false,
    };
  }

  // 6. Reservations, Merging & Queue Allocation
  if (
    q.includes('reservation') ||
    q.includes('booking') ||
    q.includes('wait') ||
    q.includes('ready') ||
    q.includes('combine') ||
    q.includes('merge') ||
    q.includes('large') ||
    q.includes('party') ||
    q.includes('group') ||
    q.includes('bayes') ||
    /\b[5-9]|10\b/.test(q)
  ) {
    const size = q.includes('10')
      ? 10
      : q.includes('8')
      ? 8
      : q.includes('7')
      ? 7
      : q.includes('6')
      ? 6
      : 5;
    const probeParty: WaitingParty = {
      id: 'PROBE',
      name: 'Guest Inquiry',
      size,
      isVip: q.includes('vip'),
      needsWheelchair: q.includes('wheelchair'),
      preferredZone: 'ANY',
      waitMins: 0,
      status: 'WAITING',
    };
    const probe = runAStarAllocation(tables, probeParty, waiting.length);
    const payingDetails =
      payingTables.length > 0
        ? payingTables
            .map(
              (t) =>
                `${t.id} (${t.zone}, P(Free₁₀)=${Math.round(
                  computeBayesianTurnoverProb(
                    t.status,
                    t.currentCourse,
                    t.elapsedMins,
                  ) * 100,
                )}%)`,
            )
            .join(', ')
        : 'none currently in Paying stage';

    return {
      reply: `Floor snapshot shows ${freeTables.length} Free tables (${
        freeTables.map((t) => `${t.id} · ${t.capacity}s`).join(', ') || 'none'
      }), ${reservations.length} confirmed NeonDB reservation(s), and Paying tables ${payingDetails}. For a party of ${size}, A* recommends ${
        probe.success
          ? `${probe.assignedTableIds.join(' + ')} (f=${probe.fScore}, ${
              probe.wastedSeats
            } wasted seats)`
          : 'holding in queue until next Bayesian release'
      }.`,
      sources: ['[live_floor_db]', '[restaurant_policies.md]'],
      refusalTriggered: false,
    };
  }

  const activeAgents = waiters
    .map((w) => `${w.id} (${w.currentAction} @ ${w.targetTableId ?? 'Queue'})`)
    .join(', ');

  return {
    reply: `Floor Command reports ${freeTables.length}/${tables.length} tables Free (${
      freeTables.map((t) => `${t.id} ${t.capacity}s`).join(', ') || 'none'
    }), ${eff.seatEfficiencyPct}% seat utilization, and ${waiting.length} waiting parties. Active agents: ${activeAgents}.`,
    sources: ['[live_floor_db]', '[restaurant_policies.md]'],
    refusalTriggered: false,
  };
}
