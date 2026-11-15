import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  RotateCcw,
  Sliders,
  XCircle,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import {
  evaluateScenarioComparison,
  SCENARIO_PRESETS,
  type AlgorithmScenarioDecision,
} from '../engine/scenarioComparison';
import { RaindropHeader } from '../components/MotionPrimitives';
import { computeBayesianTurnoverProb } from '../../../backend/engine/aiEngine';
import type { AStarWeights } from '../../../backend/engine/types';

function renderVerdictBadge(decision: AlgorithmScenarioDecision) {
  if (decision.isWinner) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#047857]">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        {decision.verdict}
      </span>
    );
  }
  if (decision.verdict === 'Local Optimum Trap') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#B45309]">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        {decision.verdict}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#B91C1C]">
      <XCircle className="w-3.5 h-3.5 shrink-0" />
      {decision.verdict}
    </span>
  );
}

export function AlgorithmScenariosPage() {
  const { navigate } = useRestaurant();
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    SCENARIO_PRESETS[0].id,
  );
  const [scenarioWeights, setScenarioWeights] = useState<AStarWeights>({
    w1Waste: 1.0,
    w2Wait: 1.0,
  });

  const evaluated = useMemo(
    () => evaluateScenarioComparison(activeScenarioId, scenarioWeights),
    [activeScenarioId, scenarioWeights],
  );

  const { preset, decisions, mlProbe } = evaluated;
  const winnerDecision = decisions.find((d) => d.isWinner) ?? decisions[3];
  const aStarChosenSet = new Set(winnerDecision?.chosenTableIds ?? []);

  return (
    <div className="overflow-x-clip bg-[#F5EFE6] text-[#111827] pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <RaindropHeader
          asPageTitle
          kicker="Algorithm Pedagogy · Worked Dining Floor Scenarios"
          title="Side-by-Side Algorithm Comparison with Scenario Walkthroughs"
          subtitle="Demonstrate to evaluators how BFS, DFS, Hill Climbing, Bayesian Inference, and Weighted A* Search behave on identical restaurant scenarios—including exact node traces, wasted seats, and failure modes."
        />

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/admin/algorithms')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#C9BCAA] bg-[#FBF8F2] text-[#111827] font-semibold text-xs hover:border-[#DC2626] hover:text-[#DC2626] transition-colors whitespace-nowrap"
          >
            Search & ML Lab
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#DC2626] text-white font-semibold text-xs hover:bg-[#B91C1C] transition-colors whitespace-nowrap"
          >
            Open Live Floor
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Scenario Selector Strip */}
      <section
        aria-label="Scenario Selector"
        className="border-y border-[#DCD0BE] bg-[#ECE3D3]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div
            role="tablist"
            aria-label="Algorithm Comparison Scenarios"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"
          >
            {SCENARIO_PRESETS.map((sc) => {
              const active = sc.id === preset.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveScenarioId(sc.id)}
                  className={`text-left px-4 py-3 border transition-colors ${
                    active
                      ? 'bg-[#111827] border-[#111827] text-white'
                      : 'bg-[#FBF8F2] border-[#DCD0BE] text-[#111827] hover:border-[#DC2626]'
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] tracking-[0.16em] block ${
                      active ? 'text-[#FCA5A5]' : 'text-[#DC2626]'
                    }`}
                  >
                    {sc.numberLabel}
                  </span>
                  <span className="font-serif text-base font-bold mt-0.5 block">
                    {sc.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Two-Zone Educational Sandbox: Scenario Stage (Left) + Weight Controls & Takeaway (Right) */}
      <section className="border-b border-[#DCD0BE] bg-[#F5EFE6]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-[#DCD0BE] items-stretch">
          {/* Left Stage: Problem Context, Floor State & Comparison Matrix */}
          <div className="lg:col-span-8 px-4 sm:px-6 lg:px-8 py-10 space-y-8">
            <div className="space-y-3 pb-6 border-b border-[#DCD0BE]">
              <p className="font-mono text-xs text-[#047857] font-semibold">
                {preset.numberLabel} · {preset.conceptFocus}
              </p>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#111827] text-balance">
                {preset.title}
              </h2>
              <p className="text-sm sm:text-base text-neutral-700 leading-relaxed max-w-3xl">
                {preset.problemStatement}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-neutral-700">
                <span>
                  Guest: <strong className="text-[#111827]">{preset.party.name}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Preferred Zone:{' '}
                  <strong className="text-[#111827]">{preset.party.preferredZone}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Wheelchair:{' '}
                  <strong className="text-[#111827]">
                    {preset.party.needsWheelchair ? 'Required (Rule R1)' : 'No'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  VIP Wait:{' '}
                  <strong className="text-[#111827] tabular-nums">
                    {preset.party.isVip ? `Yes (${preset.party.waitMins}m)` : `No (${preset.party.waitMins}m)`}
                  </strong>
                </span>
              </div>
            </div>

            {/* Scenario Floor Snapshot */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-serif text-lg font-bold text-[#111827]">
                  Scenario Dining Floor State ({preset.tables.length} Active Tables)
                </h3>
                <span className="font-mono text-[11px] text-neutral-600">
                  Emerald border = Optimal Winner ({winnerDecision.chosenTableIds.join(' + ') || 'None'})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {preset.tables.map((tbl) => {
                  const isWinnerPick = aStarChosenSet.has(tbl.id);
                  const pickedByOther = decisions
                    .filter((d) => !d.isWinner && d.chosenTableIds.includes(tbl.id))
                    .map((d) => d.displayName.split(' ')[0]);
                  const bayesPct = Math.round(
                    computeBayesianTurnoverProb(
                      tbl.status,
                      tbl.currentCourse,
                      tbl.elapsedMins,
                    ) * 100,
                  );

                  return (
                    <div
                      key={tbl.id}
                      className={`p-3 border transition-colors ${
                        isWinnerPick
                          ? 'bg-[#ECFDF5] border-[#059669]'
                          : tbl.status === 'Occupied'
                          ? 'bg-[#FEF2F2] border-[#FCA5A5]'
                          : tbl.status === 'Paying'
                          ? 'bg-[#FEF3C7] border-[#FCD34D]'
                          : 'bg-[#FBF8F2] border-[#DCD0BE]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-serif text-base font-bold text-[#111827]">
                          {tbl.id}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-neutral-700 tabular-nums">
                          {tbl.capacity} Seats
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-neutral-600 mt-0.5">
                        {tbl.zone} · {tbl.status}
                      </p>
                      <p className="font-mono text-[10px] text-neutral-500 mt-1">
                        {tbl.isAccessible ? 'Step-Free' : 'Standard'}
                        {tbl.isVipBooth ? ' · VIP' : ''}
                        {tbl.status === 'Paying' || tbl.status === 'Occupied'
                          ? ` · P(Free₁₀): ${bayesPct}%`
                          : ''}
                      </p>
                      {isWinnerPick && (
                        <p className="mt-2 font-mono text-[10px] font-bold text-[#047857]">
                          Optimal Winner Selection
                        </p>
                      )}
                      {!isWinnerPick && pickedByOther.length > 0 && (
                        <p className="mt-2 font-mono text-[10px] font-semibold text-[#B91C1C]">
                          Picked by: {Array.from(new Set(pickedByOther)).join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quantitative Side-by-Side Comparison Table */}
            <div className="space-y-3">
              <h3 className="font-serif text-lg font-bold text-[#111827]">
                Head-to-Head Outcome Comparison
              </h3>

              <div className="border border-[#DCD0BE] bg-[#FBF8F2] overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#DCD0BE] bg-[#ECE3D3] font-mono text-[11px] uppercase tracking-wider text-neutral-700">
                      <th className="py-3 px-4">Algorithm</th>
                      <th className="py-3 px-4">Selected Table(s)</th>
                      <th className="py-3 px-4">Wasted Seats</th>
                      <th className="py-3 px-4">Nodes Visited</th>
                      <th className="py-3 px-4">Est. Wait</th>
                      <th className="py-3 px-4">Outcome Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCD0BE] text-sm">
                    {decisions.map((d) => (
                      <tr
                        key={d.displayName}
                        className={d.isWinner ? 'bg-[#ECFDF5]/60' : 'bg-[#FBF8F2]'}
                      >
                        <td className="py-3.5 px-4 font-semibold text-[#111827]">
                          {d.displayName}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#111827] tabular-nums">
                          {d.chosenTableIds.length > 0
                            ? `${d.chosenTableIds.join(' + ')} (${d.totalCapacity}p)`
                            : 'Waitlisted (None)'}
                        </td>
                        <td
                          className={`py-3.5 px-4 font-mono text-xs font-bold tabular-nums ${
                            d.chosenTableIds.length === 0
                              ? 'text-[#B45309]'
                              : d.wastedSeats <= 1
                              ? 'text-[#047857]'
                              : 'text-[#DC2626]'
                          }`}
                        >
                          {d.chosenTableIds.length > 0
                            ? `${d.wastedSeats} ${d.wastedSeats === 1 ? 'seat' : 'seats'}`
                            : 'Stalled'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-neutral-700 tabular-nums">
                          {d.nodesVisited}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-neutral-700 tabular-nums">
                          {d.estimatedWaitMins} min
                        </td>
                        <td className="py-3.5 px-4">{renderVerdictBadge(d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scenario 4 Extra ML & Bayesian Breakdown */}
            {mlProbe && (
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#DCD0BE] border border-[#DCD0BE] bg-[#ECE3D3]">
                <div className="p-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 block">
                    Symbolic Rule Output
                  </span>
                  <span className="font-serif text-2xl font-bold text-[#DC2626] mt-1 block tabular-nums">
                    {mlProbe.durationPrediction.symbolicTotalMins} min
                  </span>
                  <span className="font-mono text-[11px] text-neutral-600">
                    {mlProbe.durationPrediction.symbolicFormula}
                  </span>
                </div>
                <div className="p-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 block">
                    ML Regression Forecast
                  </span>
                  <span className="font-serif text-2xl font-bold text-[#111827] mt-1 block tabular-nums">
                    {mlProbe.durationPrediction.mlTotalMins} min
                  </span>
                  <span className="font-mono text-[11px] text-neutral-600 tabular-nums">
                    +{mlProbe.durationPrediction.deltaMins}m context adjustment
                  </span>
                </div>
                <div className="p-4 bg-[#ECFDF5]">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#047857] block">
                    Bayesian Live Evidence
                  </span>
                  <span className="font-serif text-2xl font-bold text-[#047857] mt-1 block tabular-nums">
                    {mlProbe.bayesianFreeIn10Pct}% Free ≤10m
                  </span>
                  <span className="font-mono text-[11px] text-[#047857]">
                    Updates dynamically at Billing
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Deck: Live Weight Tuning + Key Pedagogical Takeaway */}
          <aside className="lg:col-span-4 px-4 sm:px-6 lg:px-8 py-10 bg-[#ECE3D3] border-t lg:border-t-0 border-[#DCD0BE] space-y-6">
            <div className="space-y-4 pb-6 border-b border-[#DCD0BE]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#DC2626] font-semibold inline-flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  Live Heuristic Weights
                </span>
                <button
                  type="button"
                  onClick={() => setScenarioWeights({ w1Waste: 1.0, w2Wait: 1.0 })}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-700 hover:text-[#DC2626] transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">
                Adjust A* weights <span className="font-mono">f(n) = w₂·Wait + w₁·WastedSeats</span> to demonstrate how heuristic priorities change table choices live.
              </p>

              <div className="space-y-4 bg-[#FBF8F2] border border-[#DCD0BE] p-4">
                <div>
                  <div className="flex justify-between font-mono text-xs mb-1.5">
                    <label htmlFor="scen-w1" className="font-medium text-[#111827]">
                      w₁ (Wasted Seats Penalty)
                    </label>
                    <span className="font-bold text-[#DC2626] tabular-nums">
                      {scenarioWeights.w1Waste.toFixed(1)}×
                    </span>
                  </div>
                  <input
                    id="scen-w1"
                    type="range"
                    min="0.5"
                    max="4.0"
                    step="0.5"
                    value={scenarioWeights.w1Waste}
                    onChange={(e) =>
                      setScenarioWeights((prev) => ({
                        ...prev,
                        w1Waste: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-[#DC2626]"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-mono text-xs mb-1.5">
                    <label htmlFor="scen-w2" className="font-medium text-[#111827]">
                      w₂ (Wait Time Penalty)
                    </label>
                    <span className="font-bold text-[#047857] tabular-nums">
                      {scenarioWeights.w2Wait.toFixed(1)}×
                    </span>
                  </div>
                  <input
                    id="scen-w2"
                    type="range"
                    min="0.5"
                    max="4.0"
                    step="0.5"
                    value={scenarioWeights.w2Wait}
                    onChange={(e) =>
                      setScenarioWeights((prev) => ({
                        ...prev,
                        w2Wait: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-[#059669]"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#FBF8F2] border border-[#DCD0BE] p-5 space-y-3">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#047857] font-semibold">
                <BookOpen className="w-4 h-4 shrink-0" />
                Teacher Key Takeaway
              </div>
              <p className="text-sm text-[#111827] leading-relaxed">
                {preset.teacherTakeaway}
              </p>
            </div>

            <div className="bg-[#F5EFE6] border border-[#DCD0BE] p-5 space-y-2">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-600 font-semibold">
                <Compass className="w-4 h-4 shrink-0 text-[#DC2626]" />
                Rules Enforced in Engine
              </div>
              <ul className="space-y-1.5 text-xs text-neutral-700 font-mono">
                <li>R1: Wheelchair → Filter isAccessible == true</li>
                <li>R2: Party &gt; 4 → Merge adjacent pair if needed</li>
                <li>R3: VIP Wait &gt; 10m → Complimentary Starter</li>
                <li>Bayes: Unlock Paying if P(Free₁₀) ≥ 75%</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      {/* Step-by-Step Trace Grid Across All 4 Approaches */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 space-y-6">
        <div className="pb-4 border-b border-[#DCD0BE]">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
            Step-by-Step Execution Traces
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#111827] mt-1">
            How Each Algorithm Reaches Its Decision
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {decisions.map((decision, idx) => (
            <article
              key={decision.displayName}
              className={`h-full border p-6 space-y-4 flex flex-col justify-between ${
                decision.isWinner
                  ? 'bg-[#ECFDF5]/60 border-[#059669]'
                  : 'bg-[#FBF8F2] border-[#DCD0BE]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#DCD0BE]">
                  <h3 className="font-serif text-xl font-bold text-[#111827]">
                    0{idx + 1}. {decision.displayName}
                  </h3>
                  {renderVerdictBadge(decision)}
                </div>

                <p className="text-sm text-neutral-700 leading-relaxed">
                  {decision.strategySummary}
                </p>

                <div className="space-y-1.5 pt-1">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    Execution Trace
                  </p>
                  <ol className="space-y-1.5 font-mono text-xs text-[#111827]">
                    {decision.pathTrace.map((step, sIdx) => (
                      <li
                        key={sIdx}
                        className="bg-[#F5EFE6] border border-[#DCD0BE] px-3 py-2 leading-snug"
                      >
                        <span className="text-neutral-500 mr-2">
                          {String(sIdx + 1).padStart(2, '0')}.
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="pt-4 border-t border-[#DCD0BE] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-neutral-600 tabular-nums">
                  <span>
                    Result:{' '}
                    <strong className="text-[#111827]">
                      {decision.chosenTableIds.join(' + ') || 'Stalled / Waitlist'}
                    </strong>
                  </span>
                  <span>
                    Nodes: <strong className="text-[#111827]">{decision.nodesVisited}</strong>
                    {decision.fScore !== null
                      ? ` · Score: ${decision.fScore}`
                      : ''}
                  </span>
                </div>
                <p className="text-xs text-neutral-700 leading-relaxed">
                  <strong className="text-[#111827]">Why it matters: </strong>
                  {decision.teacherNote}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
