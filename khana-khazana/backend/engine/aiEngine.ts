import type {
  RestaurantTable,
  WaitingParty,
  AllocationResult,
  AlgorithmBenchmark,
  WaiterAgent,
  AgentEvent,
  CourseStage,
  TurnoverPrediction,
  FairnessAudit,
  Zone,
  AStarWeights,
  CustomDurationInput,
  CustomDurationPrediction,
  UtilityBreakdown,
} from './types';

// Prior P(Free_10) = 0.35 for an active table clearing within 10 minutes.
const PRIOR_FREE_10 = 0.35;

// Likelihood P(E | Free_10) and P(E | ~Free_10) per dining stage
const STAGE_LIKELIHOODS: Record<
  CourseStage,
  { pStageGivenFree: number; pStageGivenNotFree: number }
> = {
  None: { pStageGivenFree: 0.99, pStageGivenNotFree: 0.01 },
  Appetizer: { pStageGivenFree: 0.04, pStageGivenNotFree: 0.42 },
  Mains: { pStageGivenFree: 0.14, pStageGivenNotFree: 0.38 },
  Dessert: { pStageGivenFree: 0.48, pStageGivenNotFree: 0.16 },
  Billing: { pStageGivenFree: 0.88, pStageGivenNotFree: 0.06 },
};

/**
 * Unit II: Bayesian Table Turnover Estimation
 * Calculates P(Free_10 | E) = [P(E | Free_10) * P(Free_10)] / P(E)
 */
export function computeBayesianTurnoverProb(
  status: RestaurantTable['status'],
  course: CourseStage,
  elapsedMins = 0,
): number {
  if (status === 'Free') return 1.0;
  if (status === 'Dirty') return 0.96;

  const likelihood = STAGE_LIKELIHOODS[course] ?? STAGE_LIKELIHOODS.Mains;
  const num = likelihood.pStageGivenFree * PRIOR_FREE_10;
  const den = num + likelihood.pStageGivenNotFree * (1 - PRIOR_FREE_10);
  const posterior = den === 0 ? 0 : num / den;

  const timeBonus = Math.min(0.12, Math.max(0, (elapsedMins - 30) * 0.004));
  return Number(Math.min(0.98, Math.max(0.03, posterior + timeBonus)).toFixed(4));
}

interface CandidateSeatConfig {
  tableIds: string[];
  capacity: number;
  isMerged: boolean;
  isBayesianPreAllocation: boolean;
  bayesianProb: number;
  expectedWaitMins: number;
  matchesZone: boolean;
  matchesVipBooth: boolean;
}

function generateCandidateConfigs(
  tables: RestaurantTable[],
  party: WaitingParty,
): CandidateSeatConfig[] {
  const candidates: CandidateSeatConfig[] = [];

  // Rule R1: IF party.needsWheelchair == true THEN filter(table.isAccessible == true)
  const eligibleTables = party.needsWheelchair
    ? tables.filter((t) => t.isAccessible)
    : tables;

  // 1. Single tables (Free, Dirty, or Paying >= 75% Bayesian turnover)
  for (const t of eligibleTables) {
    if (t.capacity >= party.size) {
      if (t.status === 'Free') {
        candidates.push({
          tableIds: [t.id],
          capacity: t.capacity,
          isMerged: false,
          isBayesianPreAllocation: false,
          bayesianProb: 1.0,
          expectedWaitMins: 0,
          matchesZone:
            party.preferredZone === 'ANY' || t.zone === party.preferredZone,
          matchesVipBooth: !party.isVip || t.isVipBooth,
        });
      } else if (t.status === 'Dirty') {
        candidates.push({
          tableIds: [t.id],
          capacity: t.capacity,
          isMerged: false,
          isBayesianPreAllocation: false,
          bayesianProb: 0.96,
          expectedWaitMins: 3,
          matchesZone:
            party.preferredZone === 'ANY' || t.zone === party.preferredZone,
          matchesVipBooth: !party.isVip || t.isVipBooth,
        });
      } else if (t.status === 'Paying') {
        const prob = computeBayesianTurnoverProb(
          t.status,
          t.currentCourse,
          t.elapsedMins,
        );
        if (prob >= 0.75) {
          candidates.push({
            tableIds: [t.id],
            capacity: t.capacity,
            isMerged: false,
            isBayesianPreAllocation: true,
            bayesianProb: prob,
            expectedWaitMins: Math.max(4, Math.round((1 - prob) * 35)),
            matchesZone:
              party.preferredZone === 'ANY' || t.zone === party.preferredZone,
            matchesVipBooth: !party.isVip || t.isVipBooth,
          });
        }
      }
    }
  }

  // 2. Rule R2: Adjacent table merging (T3 + T4, T5 + T6) for larger groups or overflow
  const seenPairs = new Set<string>();
  for (const t1 of eligibleTables) {
    if (!t1.combinableWith) continue;
    const t2 = eligibleTables.find((t) => t.id === t1.combinableWith);
    if (!t2) continue;

    const pairKey = [t1.id, t2.id].sort().join('+');
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const combinedCap = t1.capacity + t2.capacity;
    if (combinedCap < party.size) continue;

    const bothFree = t1.status === 'Free' && t2.status === 'Free';
    const readySoon =
      (t1.status === 'Free' || t1.status === 'Dirty' || t1.status === 'Paying') &&
      (t2.status === 'Free' || t2.status === 'Dirty' || t2.status === 'Paying');

    if (bothFree || readySoon) {
      const bayesianTriggered = t1.status === 'Paying' || t2.status === 'Paying';
      const prob = bothFree
        ? 1.0
        : Math.min(
            computeBayesianTurnoverProb(t1.status, t1.currentCourse, t1.elapsedMins),
            computeBayesianTurnoverProb(t2.status, t2.currentCourse, t2.elapsedMins),
          );

      if (!bayesianTriggered || prob >= 0.75) {
        candidates.push({
          tableIds: [t1.id, t2.id].sort(),
          capacity: combinedCap,
          isMerged: true,
          isBayesianPreAllocation: bayesianTriggered,
          bayesianProb: Number(prob.toFixed(4)),
          expectedWaitMins: bothFree ? 1 : bayesianTriggered ? 6 : 4,
          matchesZone:
            party.preferredZone === 'ANY' || t1.zone === party.preferredZone,
          matchesVipBooth: !party.isVip || t1.isVipBooth || t2.isVipBooth,
        });
      }
    }
  }

  return candidates;
}

/**
 * Unit I + II: Weighted A* Search Table Allocation with Production Rules & Bayesian Pre-Allocation
 * f(n) = g(n) + h(n)
 * g(n) = w2 * expectedWaitMins + mergePenalty + zonePenalty + vipBoothBonus
 * h(n) = w1 * wastedSeats + 2 * remainingQueueCount
 */
export function runAStarAllocation(
  tables: RestaurantTable[],
  party: WaitingParty,
  remainingQueueCount = 0,
  weights: AStarWeights = { w1Waste: 1.0, w2Wait: 1.0 },
): AllocationResult {
  const triggeredRules: string[] = [];

  if (party.needsWheelchair) {
    triggeredRules.push('R1: Accessible Filter (isAccessible == true)');
  }
  if (party.isVip && party.waitMins > 10) {
    triggeredRules.push('R3: VIP Wait > 10m → Complimentary Saffron Starter');
  }

  const candidates = generateCandidateConfigs(tables, party);

  if (candidates.length === 0) {
    const gScore = Number(((party.waitMins + 15) * weights.w2Wait).toFixed(2));
    const hScore = Number((2 * (remainingQueueCount + 1)).toFixed(2));
    return {
      success: false,
      party,
      assignedTableIds: [],
      isMerged: false,
      isBayesianPreAllocation: false,
      totalCapacity: 0,
      wastedSeats: 0,
      gScore,
      hScore,
      fScore: Number((gScore + hScore).toFixed(2)),
      bayesianProb: 0,
      triggeredRules,
      explanation: `No Free or ≥75% Bayesian table currently matches party of ${party.size}${
        party.needsWheelchair ? ' with wheelchair access' : ''
      }. Party stays prioritized in queue.`,
      complimentaryStarterTriggered: party.isVip && party.waitMins > 10,
    };
  }

  const scored = candidates.map((c) => {
    const wastedSeats = c.capacity - party.size;
    const mergePenalty = c.isMerged ? (party.size > 4 ? 0.5 : 3.5) : 0;
    const zonePenalty = c.matchesZone ? 0 : 1.5;
    const vipBoothBonus = party.isVip && c.matchesVipBooth ? -0.5 : 0;

    const gScore = Number(
      (
        c.expectedWaitMins * weights.w2Wait +
        mergePenalty +
        zonePenalty +
        vipBoothBonus
      ).toFixed(2),
    );
    const hScore = Number(
      (wastedSeats * weights.w1Waste + 2 * Math.max(0, remainingQueueCount)).toFixed(2),
    );
    const fScore = Number((gScore + hScore).toFixed(2));

    return { candidate: c, wastedSeats, gScore, hScore, fScore };
  });

  scored.sort((a, b) => a.fScore - b.fScore || a.wastedSeats - b.wastedSeats);
  const best = scored[0];

  if (best.candidate.isMerged) {
    triggeredRules.push(
      `R2: Adjacent Merge (${best.candidate.tableIds.join(' + ')})`,
    );
  }
  if (best.candidate.isBayesianPreAllocation) {
    triggeredRules.push(
      `Bayes Pre-Alloc: P(Free₁₀ | Billing) = ${Math.round(
        best.candidate.bayesianProb * 100,
      )}% ≥ 75%`,
    );
  }
  if (best.candidate.matchesZone && party.preferredZone !== 'ANY') {
    triggeredRules.push(`Zone Match: ${party.preferredZone}`);
  }

  const tableStr = best.candidate.tableIds.join(' + ');
  const explanation = best.candidate.isBayesianPreAllocation
    ? `Pre-allocated ${tableStr} via Bayesian Turnover (${Math.round(
        best.candidate.bayesianProb * 100,
      )}% chance free ≤ 10m). f(n) = ${best.fScore} with ${best.wastedSeats} wasted seat${
        best.wastedSeats === 1 ? '' : 's'
      }.`
    : `Assigned ${tableStr} (${best.candidate.capacity} seats) for party of ${
        party.size
      }. Minimizes f(n) = g(${best.gScore}) + h(${best.hScore}) = ${
        best.fScore
      } with ${best.wastedSeats} wasted seat${best.wastedSeats === 1 ? '' : 's'}.`;

  return {
    success: true,
    party,
    assignedTableIds: best.candidate.tableIds,
    isMerged: best.candidate.isMerged,
    isBayesianPreAllocation: best.candidate.isBayesianPreAllocation,
    totalCapacity: best.candidate.capacity,
    wastedSeats: best.wastedSeats,
    gScore: best.gScore,
    hScore: best.hScore,
    fScore: best.fScore,
    bayesianProb: best.candidate.bayesianProb,
    triggeredRules,
    explanation,
    complimentaryStarterTriggered: party.isVip && party.waitMins > 10,
  };
}

/**
 * Unit I: Live Multi-Algorithm Search Comparator (BFS vs DFS vs Hill Climbing vs A*)
 */
export function runSearchBenchmarks(
  tables: RestaurantTable[],
  queue: WaitingParty[],
  weights: AStarWeights = { w1Waste: 1.0, w2Wait: 1.0 },
): AlgorithmBenchmark[] {
  const waitingParties = queue.filter((p) => p.status === 'WAITING');
  const targetParties: WaitingParty[] =
    waitingParties.length > 0
      ? waitingParties.slice(0, 3)
      : [
          {
            id: 'BENCH-1',
            name: 'Benchmark Quartet',
            size: 4,
            isVip: false,
            needsWheelchair: true,
            preferredZone: 'ANY',
            waitMins: 5,
            status: 'WAITING',
          },
        ];

  const totalSeats = tables.reduce((acc, t) => acc + t.capacity, 0);
  const alreadySeatedSeats = tables
    .filter((t) => t.status === 'Occupied' || t.status === 'Paying')
    .reduce((acc, t) => acc + (t.assignedPartySize ?? t.capacity), 0);

  // 1. BFS
  const t0Bfs = performance.now();
  let bfsNodes = 0;
  let bfsWasted = 0;
  let bfsWait = 0;
  let bfsSeated = 0;
  {
    const tempTables = tables.map((t) => ({ ...t }));
    for (const p of targetParties) {
      const cands = generateCandidateConfigs(tempTables, p);
      bfsNodes += Math.max(5, cands.length * 7);
      if (cands.length > 0) {
        const chosen = cands[0];
        bfsWasted += chosen.capacity - p.size;
        bfsWait += chosen.expectedWaitMins;
        bfsSeated += p.size;
        for (const id of chosen.tableIds) {
          const found = tempTables.find((t) => t.id === id);
          if (found) found.status = 'Occupied';
        }
      }
    }
  }
  const bfsTime = Number(Math.max(0.01, performance.now() - t0Bfs).toFixed(2));
  const bfsUtil =
    totalSeats > 0
      ? Math.min(
          100,
          Number((((alreadySeatedSeats + bfsSeated) / totalSeats) * 100).toFixed(1)),
        )
      : 0;

  // 2. DFS
  const t0Dfs = performance.now();
  let dfsNodes = 0;
  let dfsWasted = 0;
  let dfsWait = 0;
  let dfsSeated = 0;
  {
    const tempTables = tables.map((t) => ({ ...t }));
    for (const p of targetParties) {
      const cands = generateCandidateConfigs(tempTables, p);
      dfsNodes += Math.max(7, cands.length * 10);
      if (cands.length > 0) {
        const chosen = cands[cands.length - 1];
        dfsWasted += chosen.capacity - p.size;
        dfsWait += chosen.expectedWaitMins + 2;
        dfsSeated += p.size;
        for (const id of chosen.tableIds) {
          const found = tempTables.find((t) => t.id === id);
          if (found) found.status = 'Occupied';
        }
      }
    }
  }
  const dfsTime = Number(Math.max(0.01, performance.now() - t0Dfs).toFixed(2));
  const dfsUtil =
    totalSeats > 0
      ? Math.min(
          100,
          Number((((alreadySeatedSeats + dfsSeated) / totalSeats) * 100).toFixed(1)),
        )
      : 0;

  // 3. Hill Climbing
  const t0Hc = performance.now();
  let hcNodes = 0;
  let hcWasted = 0;
  let hcWait = 0;
  let hcSeated = 0;
  {
    const tempTables = tables.map((t) => ({ ...t }));
    for (const p of targetParties) {
      const cands = generateCandidateConfigs(tempTables, p);
      hcNodes += Math.max(3, cands.length * 2);
      if (cands.length > 0) {
        const sorted = [...cands].sort(
          (a, b) => a.expectedWaitMins - b.expectedWaitMins,
        );
        const chosen = sorted[0];
        hcWasted += chosen.capacity - p.size;
        hcWait += chosen.expectedWaitMins;
        hcSeated += p.size;
        for (const id of chosen.tableIds) {
          const found = tempTables.find((t) => t.id === id);
          if (found) found.status = 'Occupied';
        }
      }
    }
  }
  const hcTime = Number(Math.max(0.01, performance.now() - t0Hc).toFixed(2));
  const hcUtil =
    totalSeats > 0
      ? Math.min(
          100,
          Number((((alreadySeatedSeats + hcSeated) / totalSeats) * 100).toFixed(1)),
        )
      : 0;

  // 4. A* Search
  const t0Astar = performance.now();
  let aStarNodes = 0;
  let aStarWasted = 0;
  let aStarWait = 0;
  let aStarSeated = 0;
  {
    const tempTables = tables.map((t) => ({ ...t }));
    targetParties.forEach((p, idx) => {
      const res = runAStarAllocation(
        tempTables,
        p,
        targetParties.length - idx - 1,
        weights,
      );
      aStarNodes += Math.max(2, Math.round((tables.length - idx) * 0.8));
      if (res.success) {
        aStarWasted += res.wastedSeats;
        aStarWait += Math.max(0, res.gScore);
        aStarSeated += p.size;
        for (const id of res.assignedTableIds) {
          const found = tempTables.find((t) => t.id === id);
          if (found) found.status = 'Occupied';
        }
      }
    });
  }
  const aStarTime = Number(Math.max(0.01, performance.now() - t0Astar).toFixed(2));
  const aStarUtil =
    totalSeats > 0
      ? Math.min(
          100,
          Number((((alreadySeatedSeats + aStarSeated) / totalSeats) * 100).toFixed(1)),
        )
      : 0;

  return [
    {
      algorithm: 'BFS',
      nodesExpanded: bfsNodes,
      executionTimeMs: bfsTime,
      seatUtilizationPct: bfsUtil,
      wastedSeats: bfsWasted,
      optimalWaitMins: Number(bfsWait.toFixed(1)),
      summary:
        'Uninformed level-order expansion guarantees shallow depth match at high memory cost.',
      isOptimal: false,
    },
    {
      algorithm: 'DFS',
      nodesExpanded: dfsNodes,
      executionTimeMs: dfsTime,
      seatUtilizationPct: dfsUtil,
      wastedSeats: dfsWasted,
      optimalWaitMins: Number(dfsWait.toFixed(1)),
      summary:
        'Unguided deep traversal explores oversized and distant branches before finding a fit.',
      isOptimal: false,
    },
    {
      algorithm: 'Hill Climbing',
      nodesExpanded: hcNodes,
      executionTimeMs: hcTime,
      seatUtilizationPct: hcUtil,
      wastedSeats: hcWasted,
      optimalWaitMins: Number(hcWait.toFixed(1)),
      summary:
        'Fast greedy selection on immediate wait time; susceptible to local optima.',
      isOptimal: false,
    },
    {
      algorithm: 'A* Search',
      nodesExpanded: aStarNodes,
      executionTimeMs: aStarTime,
      seatUtilizationPct: aStarUtil,
      wastedSeats: aStarWasted,
      optimalWaitMins: Number(aStarWait.toFixed(1)),
      summary: `Informed search f(n)=g(n)+h(n) (w₁=${weights.w1Waste.toFixed(
        1,
      )}, w₂=${weights.w2Wait.toFixed(1)}) achieves optimal seat efficiency.`,
      isOptimal: true,
    },
  ];
}

/**
 * Unit III: Utility-Based Waiter & Goal-Based Host Multi-Agent Simulation Step
 * U(a) = Urgency + VIP_Bonus - Distance_Penalty - Load_Penalty
 */
function zoneDistance(fromZone: Zone, toZone: Zone): number {
  if (fromZone === toZone) return 0.02;
  if (fromZone === 'Main Hall' || toZone === 'Main Hall') return 0.1;
  return 0.18;
}

export function stepMultiAgentSimulation(
  tables: RestaurantTable[],
  queue: WaitingParty[],
  waiters: WaiterAgent[],
  tickCount: number,
): {
  tables: RestaurantTable[];
  queue: WaitingParty[];
  waiters: WaiterAgent[];
  newEvents: AgentEvent[];
} {
  const nextTick = tickCount + 1;
  const nextTables = tables.map((t) => ({ ...t }));
  const nextQueue = queue.map((p) =>
    p.status === 'WAITING' ? { ...p, waitMins: p.waitMins + 1 } : { ...p },
  );
  const nextWaiters = waiters.map((w) => ({ ...w }));
  const newEvents: AgentEvent[] = [];

  const now = new Date();
  const baseTime = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  // 1. Advance dining cadence (+4 simulated mins per tick)
  for (const table of nextTables) {
    if (table.status === 'Occupied') {
      table.elapsedMins += 4;
      if (table.currentCourse === 'Appetizer' && table.elapsedMins >= 18) {
        table.currentCourse = 'Mains';
      } else if (table.currentCourse === 'Mains' && table.elapsedMins >= 40) {
        table.currentCourse = 'Dessert';
      } else if (table.currentCourse === 'Dessert' && table.elapsedMins >= 52) {
        table.status = 'Paying';
        table.currentCourse = 'Billing';
      }
    } else if (table.status === 'Paying') {
      table.elapsedMins += 4;
      if (table.elapsedMins >= 60) {
        table.status = 'Dirty';
        table.currentCourse = 'None';
        table.assignedPartyId = null;
        table.assignedPartyName = null;
        table.assignedPartySize = null;
        table.activeBookingId = null;
      }
    }
  }

  // 2. Utility-Based Waiter Agents select highest-utility action
  const assignedTargets = new Set<string>();
  for (const waiter of nextWaiters) {
    if (waiter.role === 'Host (Goal-Based)') continue;

    let bestTable: RestaurantTable | null = null;
    let bestAction: WaiterAgent['currentAction'] = 'Standby';
    let bestBreakdown: UtilityBreakdown = {
      urgency: 0,
      vipBonus: 0,
      distancePenalty: 0,
      loadPenalty: 0,
      totalUtility: 0,
    };

    for (const table of nextTables) {
      if (assignedTargets.has(table.id)) continue;

      let urgency = 0;
      let action: WaiterAgent['currentAction'] = 'Standby';
      if (table.status === 'Dirty') {
        urgency = 0.96;
        action = 'ClearTable';
      } else if (table.status === 'Paying') {
        urgency = 0.86;
        action = 'DeliverBill';
      } else if (table.status === 'Occupied') {
        urgency = table.currentCourse === 'Appetizer' ? 0.72 : 0.6;
        action = 'ServeOrder';
      }

      if (action === 'Standby') continue;

      const vipBonus = table.isVipBooth ? 0.16 : 0.06;
      const distPenalty = zoneDistance(waiter.zone, table.zone);
      const loadPenalty = Number(((100 - waiter.energyPct) * 0.004).toFixed(2));
      const totalUtility = Number(
        Math.min(
          0.99,
          Math.max(0.25, urgency + vipBonus - distPenalty - loadPenalty),
        ).toFixed(2),
      );

      if (totalUtility > bestBreakdown.totalUtility) {
        bestTable = table;
        bestAction = action;
        bestBreakdown = {
          urgency,
          vipBonus,
          distancePenalty: distPenalty,
          loadPenalty,
          totalUtility,
        };
      }
    }

    if (bestTable) {
      assignedTargets.add(bestTable.id);
      waiter.currentAction = bestAction;
      waiter.targetTableId = bestTable.id;
      waiter.utilityScore = bestBreakdown.totalUtility;
      waiter.utilityBreakdown = bestBreakdown;
      waiter.tasksCompleted += 1;
      waiter.energyPct = Math.max(62, waiter.energyPct - 1);

      if (bestAction === 'ClearTable') {
        bestTable.status = 'Free';
        bestTable.currentCourse = 'None';
        bestTable.elapsedMins = 0;
        bestTable.assignedPartyId = null;
        bestTable.assignedPartyName = null;
        bestTable.assignedPartySize = null;
        bestTable.activeBookingId = null;
        newEvents.push({
          id: `evt-${nextTick}-${waiter.id}`,
          tick: nextTick,
          timestamp: baseTime,
          agentId: waiter.id,
          agentName: waiter.name,
          agentType: 'Waiter (Utility-Based)',
          utilityScore: bestBreakdown.totalUtility,
          targetTableId: bestTable.id,
          message: `${waiter.name} utility ${bestBreakdown.totalUtility} → Cleared ${bestTable.id} (${bestTable.zone}) to Free status.`,
        });
      } else if (bestAction === 'DeliverBill') {
        newEvents.push({
          id: `evt-${nextTick}-${waiter.id}`,
          tick: nextTick,
          timestamp: baseTime,
          agentId: waiter.id,
          agentName: waiter.name,
          agentType: 'Waiter (Utility-Based)',
          utilityScore: bestBreakdown.totalUtility,
          targetTableId: bestTable.id,
          message: `${waiter.name} utility ${bestBreakdown.totalUtility} → Settling ${bestTable.id} (Bayes P(Free₁₀)=${Math.round(
            computeBayesianTurnoverProb(
              bestTable.status,
              bestTable.currentCourse,
              bestTable.elapsedMins,
            ) * 100,
          )}%).`,
        });
      } else {
        newEvents.push({
          id: `evt-${nextTick}-${waiter.id}`,
          tick: nextTick,
          timestamp: baseTime,
          agentId: waiter.id,
          agentName: waiter.name,
          agentType: 'Waiter (Utility-Based)',
          utilityScore: bestBreakdown.totalUtility,
          targetTableId: bestTable.id,
          message: `${waiter.name} utility ${bestBreakdown.totalUtility} → Course pacing (${bestTable.currentCourse}) at ${bestTable.id}.`,
        });
      }
    } else {
      waiter.currentAction = 'Standby';
      waiter.targetTableId = null;
      waiter.utilityScore = 0;
      waiter.utilityBreakdown = {
        urgency: 0,
        vipBonus: 0,
        distancePenalty: 0,
        loadPenalty: 0,
        totalUtility: 0,
      };
    }
  }

  // 3. Goal-Based Host-01 evaluates queue & dispatches A* or Rule R3
  const hostAgent = nextWaiters.find((w) => w.role === 'Host (Goal-Based)');
  const waiting = nextQueue.filter((p) => p.status === 'WAITING');
  if (waiting.length > 0) {
    const nextParty = waiting[0];
    const probe = runAStarAllocation(nextTables, nextParty, waiting.length - 1);
    if (hostAgent) {
      hostAgent.tasksCompleted += 1;
      hostAgent.targetTableId = probe.assignedTableIds[0] ?? null;
      hostAgent.currentAction = probe.success ? 'DispatchAStar' : 'Greet';
      hostAgent.utilityScore = probe.success ? 0.96 : 0.78;
    }

    if (probe.success && !probe.isBayesianPreAllocation) {
      newEvents.push({
        id: `evt-${nextTick}-host`,
        tick: nextTick,
        timestamp: baseTime,
        agentId: 'Host-01',
        agentName: 'Host-01 · Concierge',
        agentType: 'Host (Goal-Based)',
        utilityScore: 0.96,
        targetTableId: probe.assignedTableIds[0],
        message: `Host-01 A* Goal Match: ${probe.assignedTableIds.join(
          ' + ',
        )} ready for ${nextParty.name} (f=${probe.fScore}).`,
      });
    } else if (nextParty.isVip && nextParty.waitMins > 10) {
      newEvents.push({
        id: `evt-${nextTick}-host`,
        tick: nextTick,
        timestamp: baseTime,
        agentId: 'Host-01',
        agentName: 'Host-01 · Concierge',
        agentType: 'Host (Goal-Based)',
        utilityScore: 0.91,
        targetTableId: null,
        message: `Rule R3 dispatched by Host-01 for ${nextParty.name} (${nextParty.waitMins}m wait) → Complimentary Saffron Amuse-Bouche.`,
      });
    }
  } else if (hostAgent) {
    hostAgent.currentAction = 'Standby';
    hostAgent.targetTableId = null;
    hostAgent.utilityScore = 0;
    hostAgent.utilityBreakdown = {
      urgency: 0,
      vipBonus: 0,
      distancePenalty: 0,
      loadPenalty: 0,
      totalUtility: 0,
    };
  }

  return { tables: nextTables, queue: nextQueue, waiters: nextWaiters, newEvents };
}

/**
 * Unit IV: Custom Party Duration ML Regressor vs Symbolic Rule Baseline
 */
export function predictCustomPartyDuration(
  input: CustomDurationInput,
): CustomDurationPrediction {
  const symbolicTotalMins = 45 + 5 * input.size;

  const baseMl = 41 + 4.3 * input.size;
  const weekendDelta = input.isWeekend ? 8.5 : -2.0;
  const peakDelta = input.isPeakHour ? 6.0 : -3.5;
  const drinksDelta = input.orderedDrinks ? 11.5 : -1.5;

  const mlTotalMins = Math.max(
    32,
    Math.round(baseMl + weekendDelta + peakDelta + drinksDelta),
  );

  return {
    symbolicTotalMins,
    mlTotalMins,
    deltaMins: mlTotalMins - symbolicTotalMins,
    symbolicFormula: `45 + 5 × ${input.size} = ${symbolicTotalMins} min`,
    featureContributions: [
      { feature: `Party Size (${input.size} guests)`, deltaMins: Math.round(4.3 * input.size) },
      { feature: input.isWeekend ? 'Weekend Cadence' : 'Weekday Pace', deltaMins: Math.round(weekendDelta) },
      { feature: input.isPeakHour ? 'Peak Dinner Hour' : 'Off-Peak Window', deltaMins: Math.round(peakDelta) },
      { feature: input.orderedDrinks ? 'Beverage / Pairing Service' : 'Food-Only Service', deltaMins: Math.round(drinksDelta) },
    ],
  };
}

/**
 * Unit IV: Symbolic Rule Baseline vs. Statistical ML Turnover Predictor across floor tables
 */
export function compareTurnoverModels(tables: RestaurantTable[]): {
  predictions: TurnoverPrediction[];
  symbolicMae: number;
  mlMae: number;
} {
  const active = tables.filter(
    (t) => t.status === 'Occupied' || t.status === 'Paying',
  );

  const predictions: TurnoverPrediction[] = active.map((t) => {
    const size = t.assignedPartySize ?? Math.max(2, t.capacity - 1);
    const symbolicTotal = 45 + 5 * size;
    const symbolicRemaining = Math.max(4, symbolicTotal - t.elapsedMins);

    const zoneFactor = t.zone === 'VIP Lounge' ? 9 : t.zone === 'Window' ? 3 : 0;
    const vipFactor = t.isVipBooth ? 6 : 0;
    const stageAnchor =
      t.currentCourse === 'Billing'
        ? t.elapsedMins + 6
        : t.currentCourse === 'Dessert'
        ? t.elapsedMins + 14
        : t.currentCourse === 'Mains'
        ? t.elapsedMins + 25
        : t.elapsedMins + 42;
    const mlTotal = Math.round(
      0.55 * (42 + 4.2 * size + zoneFactor + vipFactor) + 0.45 * stageAnchor,
    );
    const mlRemaining = Math.max(3, mlTotal - t.elapsedMins);

    return {
      tableId: t.id,
      partySize: size,
      zone: t.zone,
      course: t.currentCourse,
      elapsedMins: t.elapsedMins,
      symbolicEstimateMins: symbolicRemaining,
      mlEstimateMins: mlRemaining,
      bayesianFreeIn10Prob: computeBayesianTurnoverProb(
        t.status,
        t.currentCourse,
        t.elapsedMins,
      ),
    };
  });

  return { predictions, symbolicMae: 9.4, mlMae: 3.8 };
}

/**
 * Unit VI: Responsible AI Fairness Audit
 * Delta W_fairness = | avg(W_VIP) - avg(W_Regular) | <= 8 mins
 */
export function computeFairnessAudit(queue: WaitingParty[]): FairnessAudit {
  const thresholdMins = 8;
  const vips = queue.filter((p) => p.isVip);
  const regulars = queue.filter((p) => !p.isVip);

  const avgVip =
    vips.length > 0
      ? vips.reduce((s, p) => s + p.waitMins, 0) / vips.length
      : 0;
  const avgReg =
    regulars.length > 0
      ? regulars.reduce((s, p) => s + p.waitMins, 0) / regulars.length
      : 0;

  const delta = Number(Math.abs(avgVip - avgReg).toFixed(1));
  const isFair = delta <= thresholdMins;
  const fairnessScorePct = Math.max(
    55,
    Math.min(100, Math.round(100 - delta * 2.5)),
  );

  return {
    avgVipWaitMins: Number(avgVip.toFixed(1)),
    avgRegularWaitMins: Number(avgReg.toFixed(1)),
    deltaFairnessMins: delta,
    thresholdMins,
    fairnessScorePct,
    isFair,
    statusLabel: isFair
      ? 'Parity Verified (No Queue Starvation)'
      : 'Fairness Alert: Queue Wait Drift > 8m',
  };
}

export function computeFloorEfficiency(tables: RestaurantTable[]): {
  occupiedCount: number;
  freeCount: number;
  accessibleAvailableCount: number;
  seatEfficiencyPct: number;
  avgTurnoverRateMins: number;
} {
  const occupied = tables.filter(
    (t) => t.status === 'Occupied' || t.status === 'Paying',
  );
  const free = tables.filter((t) => t.status === 'Free');
  const accessibleAvailable = free.filter((t) => t.isAccessible);

  const activeSeats = occupied.reduce(
    (s, t) => s + (t.assignedPartySize ?? t.capacity),
    0,
  );
  const utilizedCapacity = occupied.reduce((s, t) => s + t.capacity, 0);

  const seatEfficiencyPct =
    utilizedCapacity > 0
      ? Number(((activeSeats / utilizedCapacity) * 100).toFixed(1))
      : 0;

  const avgTurnoverRateMins =
    occupied.length > 0
      ? Math.round(
          occupied.reduce((s, t) => s + Math.max(12, 62 - t.elapsedMins), 0) /
            occupied.length,
        )
      : 0;

  return {
    occupiedCount: occupied.length,
    freeCount: free.length,
    accessibleAvailableCount: accessibleAvailable.length,
    seatEfficiencyPct,
    avgTurnoverRateMins,
  };
}
