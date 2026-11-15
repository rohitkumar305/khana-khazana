import {
  computeBayesianTurnoverProb,
  predictCustomPartyDuration,
  runAStarAllocation,
} from '../../../backend/engine/aiEngine';
import type {
  AStarWeights,
  CustomDurationPrediction,
  RestaurantTable,
  WaitingParty,
} from '../../../backend/engine/types';

export type AlgorithmKind = 'BFS' | 'DFS' | 'Hill Climbing' | 'A* Search';

export interface ScenarioTableNode {
  id: string;
  label: string;
  capacity: number;
  zone: RestaurantTable['zone'];
  status: RestaurantTable['status'];
  currentCourse: RestaurantTable['currentCourse'];
  elapsedMins: number;
  isAccessible: boolean;
  isVipBooth: boolean;
  combinableWith: string | null;
}

export interface AlgorithmScenarioDecision {
  algorithm: AlgorithmKind;
  displayName: string;
  strategySummary: string;
  chosenTableIds: string[];
  totalCapacity: number;
  wastedSeats: number;
  estimatedWaitMins: number;
  nodesVisited: number;
  pathTrace: string[];
  rulesTriggered: string[];
  fScore: number | null;
  verdict: 'Optimal Choice' | 'Suboptimal Fit' | 'Local Optimum Trap' | 'Waitlisted / Failed';
  isWinner: boolean;
  teacherNote: string;
}

export interface AlgorithmScenarioPreset {
  id: string;
  numberLabel: string;
  title: string;
  shortLabel: string;
  conceptFocus: string;
  problemStatement: string;
  party: WaitingParty;
  tables: RestaurantTable[];
  teacherTakeaway: string;
  mlComparisonContext?: {
    isWeekend: boolean;
    isPeakHour: boolean;
    orderedDrinks: boolean;
    activeTableId: string;
    activeCourse: RestaurantTable['currentCourse'];
    elapsedMins: number;
  };
}

export interface EvaluatedScenarioResult {
  preset: AlgorithmScenarioPreset;
  decisions: AlgorithmScenarioDecision[];
  mlProbe?: {
    durationPrediction: CustomDurationPrediction;
    bayesianFreeIn10Pct: number;
  };
}

function makeTable(node: ScenarioTableNode, index: number): RestaurantTable {
  return {
    ...node,
    assignedPartyId: node.status === 'Occupied' || node.status === 'Paying' ? `SCEN-${node.id}` : null,
    assignedPartyName: node.status === 'Occupied' || node.status === 'Paying' ? 'Seated Guests' : null,
    assignedPartySize: node.status === 'Occupied' || node.status === 'Paying' ? node.capacity : null,
    gridCol: (index % 5) + 1,
    gridRow: Math.floor(index / 5) + 1,
  };
}

export const SCENARIO_PRESETS: AlgorithmScenarioPreset[] = [
  {
    id: 'accessible-merge',
    numberLabel: 'Scenario 01',
    shortLabel: 'Accessible Group (7p)',
    title: 'Accessible Party of 7 — Rule R1 Filtering vs. Backtracking & Greedy Stalls',
    conceptFocus: 'Constraint Satisfaction (Rules R1 & R2) + Informed Heuristic h(n)',
    problemStatement:
      'Kulkarni Family (7 guests) needs a wheelchair-accessible table in the Main Hall. No single 7-seat table exists: T5+T6 are Window-only and NOT step-free, T8+T9 is blocked by Occupied T9, while T3+T4 is an accessible Main Hall pair (4+4 = 8 seats).',
    party: {
      id: 'SCEN-P1',
      name: 'Kulkarni Family (7p)',
      size: 7,
      isVip: false,
      needsWheelchair: true,
      preferredZone: 'Main Hall',
      waitMins: 8,
      status: 'WAITING',
    },
    tables: [
      makeTable({ id: 'T1', label: 'T1 · Golden Bay', capacity: 2, zone: 'Window', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: false, isVipBooth: false, combinableWith: null }, 0),
      makeTable({ id: 'T5', label: 'T5 · Skyline North', capacity: 4, zone: 'Window', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: false, isVipBooth: false, combinableWith: 'T6' }, 1),
      makeTable({ id: 'T6', label: 'T6 · Skyline South', capacity: 4, zone: 'Window', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: false, isVipBooth: false, combinableWith: 'T5' }, 2),
      makeTable({ id: 'T8', label: 'T8 · Imperial Velvet', capacity: 6, zone: 'VIP Lounge', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: false, isVipBooth: true, combinableWith: 'T9' }, 3),
      makeTable({ id: 'T9', label: 'T9 · Sovereign Suite', capacity: 4, zone: 'VIP Lounge', status: 'Occupied', currentCourse: 'Mains', elapsedMins: 28, isAccessible: true, isVipBooth: true, combinableWith: 'T8' }, 4),
      makeTable({ id: 'T10', label: 'T10 · Heritage Chef', capacity: 6, zone: 'Main Hall', status: 'Paying', currentCourse: 'Billing', elapsedMins: 56, isAccessible: true, isVipBooth: true, combinableWith: null }, 5),
      makeTable({ id: 'T3', label: 'T3 · Lotus West', capacity: 4, zone: 'Main Hall', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: true, isVipBooth: false, combinableWith: 'T4' }, 6),
      makeTable({ id: 'T4', label: 'T4 · Lotus East', capacity: 4, zone: 'Main Hall', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: true, isVipBooth: false, combinableWith: 'T3' }, 7),
    ],
    teacherTakeaway:
      'BFS eventually finds T3+T4 but wastes memory expanding every single-table state first. DFS wastes 20+ steps backtracking out of Window and VIP dead-ends. Hill Climbing evaluates single-seat neighbors (max 6 seats) and stalls on a plateau. A* filters via Rule R1 immediately and selects T3+T4 via Rule R2 in minimal steps.',
  },
  {
    id: 'couple-waste-trap',
    numberLabel: 'Scenario 02',
    shortLabel: 'Couple Oversized Trap (2p)',
    title: 'Couple of 2 — Why DFS & BFS Waste Large Tables While A* Minimizes Waste',
    conceptFocus: 'Admissible Waste Heuristic h(n) = w₁·WastedSeats vs. Uninformed Traversal',
    problemStatement:
      'Aarav & Meera (2 guests) request a Window table. Three free options exist across the floor: T4 (4-seat Main Hall), T8 (6-seat VIP Salon), and T7 (2-seat Window). Wait time is 0 min for all three, exposing pure traversal vs. cost differences.',
    party: {
      id: 'SCEN-P2',
      name: 'Aarav & Meera (2p)',
      size: 2,
      isVip: false,
      needsWheelchair: false,
      preferredZone: 'Window',
      waitMins: 4,
      status: 'WAITING',
    },
    tables: [
      makeTable({ id: 'T4', label: 'T4 · Lotus East', capacity: 4, zone: 'Main Hall', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: true, isVipBooth: false, combinableWith: 'T3' }, 0),
      makeTable({ id: 'T8', label: 'T8 · Imperial Velvet', capacity: 6, zone: 'VIP Lounge', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: false, isVipBooth: true, combinableWith: 'T9' }, 1),
      makeTable({ id: 'T5', label: 'T5 · Skyline North', capacity: 4, zone: 'Window', status: 'Paying', currentCourse: 'Billing', elapsedMins: 52, isAccessible: false, isVipBooth: false, combinableWith: 'T6' }, 2),
      makeTable({ id: 'T7', label: 'T7 · Saffron Corner', capacity: 2, zone: 'Window', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: true, isVipBooth: false, combinableWith: null }, 3),
    ],
    teacherTakeaway:
      'Because BFS pops the first valid node in queue order, it seats 2 guests at a 4-top (T4, Main Hall). DFS plunges to the deepest branch and wastes a 6-seat VIP table (T8, 4 empty seats!). Hill Climbing sees 0m wait on T4 and stops immediately. Only A* weighs WastedSeats + Zone Match and chooses T7 with 0 wasted seats.',
  },
  {
    id: 'bayesian-vip-rush',
    numberLabel: 'Scenario 03',
    shortLabel: 'VIP Rush & Bayes Pre-Alloc (5p)',
    title: 'VIP Party of 5 During Peak Rush — Static Search vs. Bayesian Pre-Allocation',
    conceptFocus: 'Probabilistic Reasoning P(Free₁₀ | Billing) ≥ 75% + Rule R3',
    problemStatement:
      'Verma VIP Party (5 guests, waited 12 min) wants seating now. Every Free table is too small individually (2P/4P), leaving only a Free merge T3+T4 (8 seats, Main Hall) or T10 (6 seats, Billing at 56m → 98% chance free within 10 min).',
    party: {
      id: 'SCEN-P3',
      name: 'Verma VIP Party (5p)',
      size: 5,
      isVip: true,
      needsWheelchair: false,
      preferredZone: 'VIP Lounge',
      waitMins: 12,
      status: 'WAITING',
    },
    tables: [
      makeTable({ id: 'T7', label: 'T7 · Saffron Corner', capacity: 2, zone: 'Window', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: true, isVipBooth: false, combinableWith: null }, 0),
      makeTable({ id: 'T3', label: 'T3 · Lotus West', capacity: 4, zone: 'Main Hall', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: true, isVipBooth: false, combinableWith: 'T4' }, 1),
      makeTable({ id: 'T4', label: 'T4 · Lotus East', capacity: 4, zone: 'Main Hall', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: true, isVipBooth: false, combinableWith: 'T3' }, 2),
      makeTable({ id: 'T8', label: 'T8 · Imperial Velvet', capacity: 6, zone: 'VIP Lounge', status: 'Occupied', currentCourse: 'Mains', elapsedMins: 32, isAccessible: false, isVipBooth: true, combinableWith: 'T9' }, 3),
      makeTable({ id: 'T10', label: 'T10 · Heritage Chef', capacity: 6, zone: 'Main Hall', status: 'Paying', currentCourse: 'Billing', elapsedMins: 56, isAccessible: true, isVipBooth: true, combinableWith: null }, 4),
    ],
    teacherTakeaway:
      'Uninformed BFS/DFS ignore Paying tables completely and break up the accessible 8-top (T3+T4) for 5 guests (wasting 3 seats). Hill Climbing greedily picks T3+T4 because wait=1m < 4m. Bayesian A* recognizes T10 has P(Free₁₀|Billing)=98%, locks T10 with only 1 wasted seat, and fires Rule R3 complimentary starter.',
  },
  {
    id: 'symbolic-vs-ml',
    numberLabel: 'Scenario 04',
    shortLabel: 'Symbolic Rule vs. ML & Bayes',
    title: 'Duration Forecasting — Symbolic Rule vs. ML Regression vs. Bayesian Posterior',
    conceptFocus: 'Unit IV Symbolic vs. Statistical ML + Unit II Bayesian Inference',
    problemStatement:
      'Table T6 seats 4 guests on a Weekend Peak evening with Drinks ordered, currently at Dessert (44 mins elapsed). Compare how a rigid Symbolic Rule, an ML Regressor, and Bayesian Turnover Inference forecast remaining table lock time.',
    party: {
      id: 'SCEN-P4',
      name: 'Weekend Peak Quartet (4p)',
      size: 4,
      isVip: false,
      needsWheelchair: false,
      preferredZone: 'Window',
      waitMins: 6,
      status: 'WAITING',
    },
    tables: [
      makeTable({ id: 'T6', label: 'T6 · Skyline South', capacity: 4, zone: 'Window', status: 'Occupied', currentCourse: 'Dessert', elapsedMins: 44, isAccessible: false, isVipBooth: false, combinableWith: 'T5' }, 0),
      makeTable({ id: 'T7', label: 'T7 · Saffron Corner', capacity: 2, zone: 'Window', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: true, isVipBooth: false, combinableWith: null }, 1),
      makeTable({ id: 'T4', label: 'T4 · Lotus East', capacity: 4, zone: 'Main Hall', status: 'Free', currentCourse: 'None', elapsedMins: 0, isAccessible: true, isVipBooth: false, combinableWith: 'T3' }, 2),
      makeTable({ id: 'T5', label: 'T5 · Skyline North', capacity: 4, zone: 'Window', status: 'Paying', currentCourse: 'Billing', elapsedMins: 54, isAccessible: false, isVipBooth: false, combinableWith: 'T6' }, 3),
    ],
    teacherTakeaway:
      'Static Symbolic Rules (D = 45 + 5×Size) underestimate Friday peak + drinks service by 30+ minutes (MAE 15.6m). Statistical ML learns context weights (+10m Weekend, +8m Peak, +12m Drinks → MAE 6.3m), while Bayesian Inference reads live course evidence (Dessert @ 44m → 67% free in 10m).',
    mlComparisonContext: {
      isWeekend: true,
      isPeakHour: true,
      orderedDrinks: true,
      activeTableId: 'T6',
      activeCourse: 'Dessert',
      elapsedMins: 44,
    },
  },
];

function buildScenarioDecisions(
  preset: AlgorithmScenarioPreset,
  weights: AStarWeights,
): AlgorithmScenarioDecision[] {
  const { party, tables } = preset;

  // Always compute true A* result using the real engine!
  const aStarRes = runAStarAllocation(tables, party, 1, weights);

  if (preset.id === 'accessible-merge') {
    return [
      {
        algorithm: 'BFS',
        displayName: 'BFS (Breadth-First)',
        strategySummary: 'Level-order scan: checks all single tables (level 1) before adjacent merges (level 2).',
        chosenTableIds: ['T3', 'T4'],
        totalCapacity: 8,
        wastedSeats: 1,
        estimatedWaitMins: 1,
        nodesVisited: 19,
        pathTrace: [
          'Level 1: Check T1(2P), T5(4P), T6(4P), T8(6P), T10(6P), T3(4P), T4(4P) → all < 7 seats',
          'Level 2: Expand T5+T6(8P) → Rejected by Rule R1 (Not wheelchair accessible)',
          'Level 2: Expand T3+T4(8P) → Accessible & Main Hall Match ✓',
        ],
        rulesTriggered: ['R1: Accessible Filter', 'R2: Adjacent Merge (T3 + T4)'],
        fScore: null,
        verdict: 'Suboptimal Fit',
        isWinner: false,
        teacherNote: 'Finds the valid answer eventually, but expands 19 nodes across level 1 & level 2 without heuristic pruning.',
      },
      {
        algorithm: 'DFS',
        displayName: 'DFS (Depth-First)',
        strategySummary: 'Depth-first plunge: follows first branch deeply and backtracks on constraint failures.',
        chosenTableIds: ['T3', 'T4'],
        totalCapacity: 8,
        wastedSeats: 1,
        estimatedWaitMins: 3,
        nodesVisited: 26,
        pathTrace: [
          'Branch 1 (Window): T1 → T5 → T5+T6 → Rejected (Rule R1 Violation)',
          'Backtrack → Branch 2 (VIP): T8 → T8+T9 → Blocked (T9 Occupied)',
          'Backtrack → Branch 3 (Main Hall): T10(6P < 7) → T3 → T3+T4 ✓',
        ],
        rulesTriggered: ['R1: Accessible Filter', 'R2: Adjacent Merge (T3 + T4)'],
        fScore: null,
        verdict: 'Suboptimal Fit',
        isWinner: false,
        teacherNote: 'Suffers heavy backtracking (26 nodes) exploring deep dead-end branches in Window and VIP Lounge.',
      },
      {
        algorithm: 'Hill Climbing',
        displayName: 'Hill Climbing (Greedy)',
        strategySummary: 'Greedy single-step ascent on immediate wait time without multi-node lookahead.',
        chosenTableIds: [],
        totalCapacity: 0,
        wastedSeats: 0,
        estimatedWaitMins: 15,
        nodesVisited: 6,
        pathTrace: [
          'Evaluate single-node neighbors: T3(4P), T4(4P), T10(6P)',
          'No single neighbor satisfies capacity ≥ 7 seats',
          'Stuck on local plateau → cannot escape single-table neighborhood without lookahead',
        ],
        rulesTriggered: ['R1: Accessible Filter'],
        fScore: null,
        verdict: 'Local Optimum Trap',
        isWinner: false,
        teacherNote: 'Classic Hill Climbing plateau failure: greedy single-step operators fail when 2-table merge lookahead is required.',
      },
      {
        algorithm: 'A* Search',
        displayName: 'A* Search (f = g + h)',
        strategySummary: `Informed best-first search f(n)=w₂·Wait + w₁·WastedSeats (w₁=${weights.w1Waste.toFixed(1)}, w₂=${weights.w2Wait.toFixed(1)}).`,
        chosenTableIds: aStarRes.assignedTableIds,
        totalCapacity: aStarRes.totalCapacity,
        wastedSeats: aStarRes.wastedSeats,
        estimatedWaitMins: 1,
        nodesVisited: 4,
        pathTrace: [
          'Apply Rule R1 upfront → prune non-accessible T1, T5, T6, T8',
          'Generate valid accessible configs → only T3+T4(8P) meets ≥ 7 seats',
          `Select T3+T4 with f(n)=${aStarRes.fScore} (g=${aStarRes.gScore}, h=${aStarRes.hScore}) ✓`,
        ],
        rulesTriggered: aStarRes.triggeredRules,
        fScore: aStarRes.fScore,
        verdict: 'Optimal Choice',
        isWinner: true,
        teacherNote: 'Prunes 80% of search tree via Rule R1 + admissible heuristic, returning T3+T4 in just 4 expansions.',
      },
    ];
  }

  if (preset.id === 'couple-waste-trap') {
    const aStarWaste = aStarRes.wastedSeats;
    return [
      {
        algorithm: 'BFS',
        displayName: 'BFS (Breadth-First)',
        strategySummary: 'Pops the first Free table ≥ 2 seats in FIFO queue order (ignores capacity waste & zone).',
        chosenTableIds: ['T4'],
        totalCapacity: 4,
        wastedSeats: 2,
        estimatedWaitMins: 0,
        nodesVisited: 10,
        pathTrace: [
          'Enqueue root state → expand Free tables in floor index order',
          'Visit T4 (4P, Main Hall, Free) → capacity 4 ≥ 2 → Goal Test PASS',
          'Return T4 immediately (2 wasted seats, missed Window preference)',
        ],
        rulesTriggered: ['FIFO First-Match'],
        fScore: null,
        verdict: 'Suboptimal Fit',
        isWinner: false,
        teacherNote: 'BFS guarantees shallowest depth (1 step), NOT lowest seat waste—it locks a 4-top for 2 guests.',
      },
      {
        algorithm: 'DFS',
        displayName: 'DFS (Depth-First)',
        strategySummary: 'Follows branch depth order into VIP Lounge without evaluating seat waste.',
        chosenTableIds: ['T8'],
        totalCapacity: 6,
        wastedSeats: 4,
        estimatedWaitMins: 0,
        nodesVisited: 14,
        pathTrace: [
          'Push T4 → push T8 (6P, VIP Lounge, Free)',
          'LIFO stack pops T8 → capacity 6 ≥ 2 → Goal Test PASS',
          'Wastes 4 seats on a 6-top VIP Salon for a regular couple!',
        ],
        rulesTriggered: ['LIFO Deep Branch'],
        fScore: null,
        verdict: 'Suboptimal Fit',
        isWinner: false,
        teacherNote: 'Worst-case restaurant outcome: DFS consumes a 6-seat VIP salon for 2 guests (67% empty seats).',
      },
      {
        algorithm: 'Hill Climbing',
        displayName: 'Hill Climbing (Greedy)',
        strategySummary: 'Greedy choice on lowest wait time (0 min); stops at the very first 0-wait local optimum.',
        chosenTableIds: ['T4'],
        totalCapacity: 4,
        wastedSeats: 2,
        estimatedWaitMins: 0,
        nodesVisited: 3,
        pathTrace: [
          'Start at T4 (wait=0m) → evaluate neighbor T8 (wait=0m, not better)',
          'T4 wait=0m ties best immediate wait → terminate early at local optimum',
          'Never reaches T7 (Window 2P) further down the list',
        ],
        rulesTriggered: ['Greedy Wait = 0m'],
        fScore: null,
        verdict: 'Local Optimum Trap',
        isWinner: false,
        teacherNote: 'Stops at T4 because wait=0m cannot be improved—failing to optimize wasted seats or zone.',
      },
      {
        algorithm: 'A* Search',
        displayName: 'A* Search (f = g + h)',
        strategySummary: `Evaluates f(n) = w₂·Wait + ZonePenalty + w₁·WastedSeats across all eligible nodes.`,
        chosenTableIds: aStarRes.assignedTableIds,
        totalCapacity: aStarRes.totalCapacity,
        wastedSeats: aStarWaste,
        estimatedWaitMins: 0,
        nodesVisited: 4,
        pathTrace: [
          `Score T4: g=1.5(zone) + h=${(2 * weights.w1Waste + 2).toFixed(1)} → f=${(1.5 + 2 * weights.w1Waste + 2).toFixed(1)}`,
          `Score T8: g=1.5(zone) + h=${(4 * weights.w1Waste + 2).toFixed(1)} → f=${(1.5 + 4 * weights.w1Waste + 2).toFixed(1)}`,
          `Score ${aStarRes.assignedTableIds.join('+')}: f=${aStarRes.fScore} (0 wasted, Window Match) ✓`,
        ],
        rulesTriggered: aStarRes.triggeredRules,
        fScore: aStarRes.fScore,
        verdict: 'Optimal Choice',
        isWinner: true,
        teacherNote: 'Global cost awareness picks T7 (2P, Window) with 0 wasted seats, saving T4 & T8 for larger groups.',
      },
    ];
  }

  if (preset.id === 'bayesian-vip-rush') {
    const pickedBayes = aStarRes.assignedTableIds.includes('T10');
    return [
      {
        algorithm: 'BFS',
        displayName: 'BFS (Static Free-Only)',
        strategySummary: 'Deterministic Free-only search; ignores Paying tables even at 98% Billing completion.',
        chosenTableIds: ['T3', 'T4'],
        totalCapacity: 8,
        wastedSeats: 3,
        estimatedWaitMins: 1,
        nodesVisited: 16,
        pathTrace: [
          'Level 1: T7(2P), T3(4P), T4(4P) too small; T8(Occupied), T10(Paying → skipped)',
          'Level 2: Merge T3+T4 (8P, Main Hall) → 5 guests seated, 3 seats wasted',
          'Misses Rule R3 VIP boost and consumes accessible 8-top merge',
        ],
        rulesTriggered: ['R2: Adjacent Merge (T3 + T4)'],
        fScore: null,
        verdict: 'Suboptimal Fit',
        isWinner: false,
        teacherNote: 'Without Bayesian inference, deterministic BFS breaks up T3+T4 and wastes 3 accessible seats.',
      },
      {
        algorithm: 'DFS',
        displayName: 'DFS (Static Free-Only)',
        strategySummary: 'Deterministic Free-only deep search; fails to pre-allocate T10.',
        chosenTableIds: ['T3', 'T4'],
        totalCapacity: 8,
        wastedSeats: 3,
        estimatedWaitMins: 2,
        nodesVisited: 21,
        pathTrace: [
          'Explore T7 → T3 → T4 → T8(Occupied) → T10(Paying → skipped)',
          'Backtrack and merge T3+T4 (8P, Main Hall, 3 wasted seats)',
        ],
        rulesTriggered: ['R2: Adjacent Merge (T3 + T4)'],
        fScore: null,
        verdict: 'Suboptimal Fit',
        isWinner: false,
        teacherNote: 'High node count and identical 3-seat waste because Paying tables remain invisible.',
      },
      {
        algorithm: 'Hill Climbing',
        displayName: 'Hill Climbing (Greedy)',
        strategySummary: 'Greedily grabs lowest immediate wait (T3+T4 = 1m) over T10 (4m billing wait).',
        chosenTableIds: ['T3', 'T4'],
        totalCapacity: 8,
        wastedSeats: 3,
        estimatedWaitMins: 1,
        nodesVisited: 4,
        pathTrace: [
          'Compare immediate wait: T3+T4 (1m) vs. T10 Paying (4m)',
          'Pick T3+T4 greedily → wastes 3 seats & forfeits VIP booth affinity',
        ],
        rulesTriggered: ['Greedy Min-Wait'],
        fScore: null,
        verdict: 'Local Optimum Trap',
        isWinner: false,
        teacherNote: 'Short-sighted wait greediness sacrifices 3 seats and VIP booth matching for a 3-minute wait difference.',
      },
      {
        algorithm: 'A* Search',
        displayName: 'Bayesian-Informed A*',
        strategySummary: `Bayesian-informed A* unlocks Paying tables ≥ 75% + Rule R3 VIP compensation.`,
        chosenTableIds: aStarRes.assignedTableIds,
        totalCapacity: aStarRes.totalCapacity,
        wastedSeats: aStarRes.wastedSeats,
        estimatedWaitMins: pickedBayes ? 4 : 1,
        nodesVisited: 5,
        pathTrace: [
          'Evaluate T10 (Billing, 56m) → P(Free₁₀ | Billing) = 98% ≥ 75% threshold',
          'Trigger Rule R3 (VIP wait 12m > 10m → Complimentary Saffron Starter)',
          `Winner: ${aStarRes.assignedTableIds.join('+')} (f=${aStarRes.fScore}, ${aStarRes.wastedSeats} wasted seat${aStarRes.wastedSeats === 1 ? '' : 's'}) ✓`,
        ],
        rulesTriggered: aStarRes.triggeredRules,
        fScore: aStarRes.fScore,
        verdict: 'Optimal Choice',
        isWinner: true,
        teacherNote: pickedBayes
          ? 'Combines Bayesian pre-allocation (T10, 1 wasted seat) with Rule R3, preserving T3+T4 for accessible groups.'
          : `With high wait weight w₂=${weights.w2Wait.toFixed(1)}, A* adapts and prioritizes T3+T4 speed—demonstrating tunable trade-offs!`,
      },
    ];
  }

  // Scenario 4: Symbolic vs ML & Bayes (computed directly from aiEngine formulas)
  const mlForecast = predictCustomPartyDuration({
    size: 4,
    isWeekend: true,
    isPeakHour: true,
    orderedDrinks: true,
  });
  const bayesPct = Math.round(
    computeBayesianTurnoverProb('Occupied', 'Dessert', 44) * 100,
  );
  const mlRemainingMins = Math.max(4, mlForecast.mlTotalMins - 44);

  return [
    {
      algorithm: 'BFS',
      displayName: 'Symbolic Rule (D = 45 + 5×Size)',
      strategySummary: 'Symbolic Static Rule: D = 45 + 5 × PartySize (ignores Weekend, Peak & Drinks).',
      chosenTableIds: ['T6'],
      totalCapacity: 4,
      wastedSeats: 0,
      estimatedWaitMins: Math.max(4, mlForecast.symbolicTotalMins - 44),
      nodesVisited: 1,
      pathTrace: [
        `Formula: D = 45 + (5 × 4 guests) = ${mlForecast.symbolicTotalMins} min total duration`,
        `Elapsed = 44 min → predicts ${mlForecast.symbolicTotalMins} − 44 = ${mlForecast.symbolicTotalMins - 44} min remaining`,
        'Error: ignores Weekend (+8.5m), Peak (+6m) & Beverage Service (+11.5m)',
      ],
      rulesTriggered: ['Static Rule: D = 45 + 5×Size'],
      fScore: null,
      verdict: 'Suboptimal Fit',
      isWinner: false,
      teacherNote: 'Symbolic rule suffers 15.6m MAE because fixed formulas miss contextual restaurant signals.',
    },
    {
      algorithm: 'DFS',
      displayName: 'Static 60m Baseline',
      strategySummary: 'Uninformed Static Lookup: uses fixed 60-min table average regardless of party size.',
      chosenTableIds: ['T6'],
      totalCapacity: 4,
      wastedSeats: 0,
      estimatedWaitMins: 16,
      nodesVisited: 1,
      pathTrace: [
        'Baseline assumption: Fixed 60 min turn per party',
        'Elapsed = 44 min → predicts 16 min remaining',
        'Fails to distinguish a 2-top quick lunch from a 4-top weekend dinner',
      ],
      rulesTriggered: ['Fixed Turn Heuristic (60m)'],
      fScore: null,
      verdict: 'Suboptimal Fit',
      isWinner: false,
      teacherNote: 'Flat averages break down completely during peak weekend dinner rushes.',
    },
    {
      algorithm: 'Hill Climbing',
      displayName: 'ML Linear Regression',
      strategySummary: 'Statistical ML Linear Regression: learns weights for Size, Weekend, Peak & Drinks.',
      chosenTableIds: ['T6'],
      totalCapacity: 4,
      wastedSeats: 0,
      estimatedWaitMins: mlRemainingMins,
      nodesVisited: 4,
      pathTrace: [
        `Base (41m) + 4×4.3 (17.2m) + Weekend (+8.5m) + Peak (+6m) + Drinks (+11.5m) = ${mlForecast.mlTotalMins} min`,
        `Elapsed = 44 min → predicts ${mlRemainingMins} min total remaining (MAE 6.3 min vs 15.6 min)`,
        'Great for pre-arrival shift planning, though static once Dessert starts',
      ],
      rulesTriggered: ['ML Linear Regression (MAE 6.3m)'],
      fScore: null,
      verdict: 'Suboptimal Fit',
      isWinner: false,
      teacherNote: 'ML dramatically beats symbolic rules before seating, while Bayesian inference tracks live course progress.',
    },
    {
      algorithm: 'A* Search',
      displayName: 'Bayesian Turnover Inference',
      strategySummary: 'Bayesian Posterior Inference P(Free₁₀ | Dessert, 44m) updates live with course evidence.',
      chosenTableIds: ['T6'],
      totalCapacity: 4,
      wastedSeats: 0,
      estimatedWaitMins: 11,
      nodesVisited: 3,
      pathTrace: [
        'Prior P(Free₁₀) = 0.35 updated with Likelihood P(Dessert | Free₁₀) = 0.48',
        `Posterior + elapsed time bonus (44m) → ${bayesPct}% probability free ≤ 10m`,
        'Reaches ≥ 75% pre-allocation threshold as soon as Billing begins ✓',
      ],
      rulesTriggered: [`Bayesian Posterior (${bayesPct}% ≤10m)`, 'Course Evidence: Dessert'],
      fScore: bayesPct,
      verdict: 'Optimal Choice',
      isWinner: true,
      teacherNote: 'Bayesian updating adapts dynamically as guests transition Appetizer → Mains → Dessert → Billing.',
    },
  ];
}

export function evaluateScenarioComparison(
  presetId: string,
  weights: AStarWeights = { w1Waste: 1.0, w2Wait: 1.0 },
): EvaluatedScenarioResult {
  const preset =
    SCENARIO_PRESETS.find((s) => s.id === presetId) ?? SCENARIO_PRESETS[0];
  const decisions = buildScenarioDecisions(preset, weights);

  if (preset.mlComparisonContext) {
    const ctx = preset.mlComparisonContext;
    return {
      preset,
      decisions,
      mlProbe: {
        durationPrediction: predictCustomPartyDuration({
          size: preset.party.size,
          isWeekend: ctx.isWeekend,
          isPeakHour: ctx.isPeakHour,
          orderedDrinks: ctx.orderedDrinks,
        }),
        bayesianFreeIn10Pct: Math.round(
          computeBayesianTurnoverProb('Occupied', ctx.activeCourse, ctx.elapsedMins) *
            100,
        ),
      },
    };
  }

  return { preset, decisions };
}
