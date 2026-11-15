import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  ChevronDown,
  Cpu,
  Sliders,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { predictCustomPartyDuration } from '../../../backend/engine/aiEngine';
import { LateralSlideCard, RaindropHeader } from '../components/MotionPrimitives';

export function AlgorithmsPage() {
  const {
    navigate,
    weights,
    setWeights,
    benchmarks,
    runBenchmarksNow,
    turnoverComparison,
  } = useRestaurant();

  const [expandedAlgorithms, setExpandedAlgorithms] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(benchmarks.map((b) => [b.algorithm, true])),
  );

  const [customSize, setCustomSize] = useState(5);
  const [isWeekend, setIsWeekend] = useState(true);
  const [isPeakHour, setIsPeakHour] = useState(true);
  const [orderedDrinks, setOrderedDrinks] = useState(true);

  const customPrediction = useMemo(
    () =>
      predictCustomPartyDuration({
        size: customSize,
        isWeekend,
        isPeakHour,
        orderedDrinks,
      }),
    [customSize, isWeekend, isPeakHour, orderedDrinks],
  );

  const maxNodes = Math.max(1, ...benchmarks.map((b) => b.nodesExpanded));
  const maxRuntime = Math.max(0.01, ...benchmarks.map((b) => b.executionTimeMs));

  const toggleAlgorithmRow = (algo: string) => {
    setExpandedAlgorithms((prev) => ({
      ...prev,
      [algo]: !prev[algo],
    }));
  };

  return (
    <div className="overflow-x-clip bg-[#F5EFE6] text-[#111827] pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <RaindropHeader
          asPageTitle
          kicker="Search & ML Lab · Unit I & IV"
          title="State-Space Search Benchmarking & ML Turnover"
          subtitle="Tune A* heuristic weights to benchmark BFS, DFS, Hill Climbing, and A* Search against your live floor state, and compare Symbolic rules against Statistical ML regression."
        />

        <button
          type="button"
          onClick={() => navigate('/admin/scenarios')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#059669] bg-[#ECFDF5] text-[#047857] font-semibold text-xs hover:bg-[#059669] hover:text-white transition-colors shrink-0 whitespace-nowrap"
        >
          Teacher Scenario Walkthroughs
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Part A: Weighted A* Heuristic Controls */}
      <section className="border-y border-[#DCD0BE] bg-[#ECE3D3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#DCD0BE]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#DC2626] font-semibold flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5" />
                Part A · Weighted A* Heuristic Controls
              </p>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#111827] mt-1">
                f(n) = w₂·Wait(n) + w₁·WastedSeats(n)
              </h2>
            </div>

            <button
              type="button"
              onClick={runBenchmarksNow}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#DC2626] text-white font-semibold text-sm hover:bg-[#B91C1C] transition-colors shrink-0"
            >
              <Cpu className="w-4 h-4" />
              Benchmark All 4 Algorithms
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#DCD0BE] border border-[#DCD0BE] bg-[#F5EFE6]">
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between font-mono text-xs mb-3">
                <label
                  htmlFor="w1-slider"
                  className="text-[#111827] font-medium"
                >
                  w₁ (Wasted Seats Weight)
                </label>
                <span className="text-[#DC2626] font-bold tabular-nums">
                  {weights.w1Waste.toFixed(1)}×
                </span>
              </div>
              <input
                id="w1-slider"
                type="range"
                min="0.5"
                max="3.0"
                step="0.5"
                value={weights.w1Waste}
                onChange={(e) =>
                  setWeights((prev) => ({
                    ...prev,
                    w1Waste: Number(e.target.value),
                  }))
                }
                className="w-full accent-[#DC2626]"
              />
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between font-mono text-xs mb-3">
                <label
                  htmlFor="w2-slider"
                  className="text-[#111827] font-medium"
                >
                  w₂ (Wait Latency Weight)
                </label>
                <span className="text-[#047857] font-bold tabular-nums">
                  {weights.w2Wait.toFixed(1)}×
                </span>
              </div>
              <input
                id="w2-slider"
                type="range"
                min="0.5"
                max="3.0"
                step="0.5"
                value={weights.w2Wait}
                onChange={(e) =>
                  setWeights((prev) => ({
                    ...prev,
                    w2Wait: Number(e.target.value),
                  }))
                }
                className="w-full accent-[#059669]"
              />
            </div>
          </div>

          {/* Interactive Horizontal Accordion Rows for BFS, DFS, Hill Climbing & A* */}
          <div className="bg-[#F5EFE6] border-t border-[#DCD0BE]">
            {benchmarks.map((b, idx) => {
              const isOpen = !!expandedAlgorithms[b.algorithm];
              const nodeBarPct = Math.max(
                10,
                Math.round((b.nodesExpanded / maxNodes) * 100),
              );
              const runtimeBarPct = Math.max(
                8,
                Math.round((b.executionTimeMs / maxRuntime) * 100),
              );

              return (
                <div
                  key={b.algorithm}
                  className={`border-b border-[#DCD0BE] transition-colors ${
                    isOpen ? 'bg-[#F5EFE6]' : 'hover:bg-[#EFE6D8]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleAlgorithmRow(b.algorithm)}
                    aria-expanded={isOpen}
                    className="w-full py-5 px-4 sm:px-6 text-left flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#EFE6D8] transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span
                        className={`font-mono text-xs font-semibold shrink-0 ${
                          b.isOptimal ? 'text-[#047857]' : 'text-[#DC2626]'
                        }`}
                      >
                        {String(idx + 1).padStart(2, '0')} —
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#111827]">
                            {b.algorithm}
                          </h3>
                          {b.isOptimal ? (
                            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 border border-[#059669]/40 text-[#047857] font-semibold">
                              Optimal Winner
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-50 border border-[#DC2626]/30 text-[#B91C1C] font-semibold">
                              Baseline
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 pl-9 md:pl-0 font-mono text-xs shrink-0 tabular-nums">
                      <div>
                        <span className="text-[10px] text-neutral-500 block">
                          Nodes
                        </span>
                        <span className="font-semibold text-[#111827]">
                          {b.nodesExpanded}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 block">
                          Seat Util
                        </span>
                        <span
                          className={`font-semibold ${
                            b.isOptimal ? 'text-[#047857]' : 'text-[#DC2626]'
                          }`}
                        >
                          {b.seatUtilizationPct}%
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-neutral-500 transition-transform ${
                          isOpen ? 'rotate-180 text-[#DC2626]' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 sm:px-6 pb-6 pt-2 pl-12 sm:pl-16 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="lg:col-span-6 space-y-3">
                        <p className="text-sm text-neutral-700 leading-relaxed">
                          {b.summary}
                        </p>

                        <div className="grid grid-cols-3 divide-x divide-[#DCD0BE] border border-[#DCD0BE] bg-[#ECE3D3] font-mono text-xs">
                          <div className="p-3">
                            <span className="text-[10px] text-neutral-500 block">
                              Nodes Expanded
                            </span>
                            <span className="text-[#111827] font-bold tabular-nums">
                              {b.nodesExpanded}
                            </span>
                          </div>
                          <div className="p-3">
                            <span className="text-[10px] text-neutral-500 block">
                              Runtime
                            </span>
                            <span className="text-[#111827] font-bold tabular-nums">
                              {b.executionTimeMs} ms
                            </span>
                          </div>
                          <div className="p-3">
                            <span className="text-[10px] text-neutral-500 block">
                              Wasted Seats
                            </span>
                            <span
                              className={`font-bold tabular-nums ${
                                b.wastedSeats === 0
                                  ? 'text-[#047857]'
                                  : 'text-[#DC2626]'
                              }`}
                            >
                              {b.wastedSeats}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Crimson Red (Baseline) vs Emerald Green (Optimal A*) Horizontal Bar Gauges */}
                      <div className="lg:col-span-6 space-y-3.5 pt-1">
                        <div>
                          <div className="flex justify-between font-mono text-[11px] mb-1.5 tabular-nums">
                            <span className="text-neutral-600">
                              Search State Expansion
                            </span>
                            <span
                              className={
                                b.isOptimal
                                  ? 'text-[#047857] font-semibold'
                                  : 'text-[#DC2626] font-semibold'
                              }
                            >
                              {b.nodesExpanded} / {maxNodes} nodes
                            </span>
                          </div>
                          <div className="h-2 bg-[#DCD0BE] overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                b.isOptimal ? 'bg-[#059669]' : 'bg-[#DC2626]'
                              }`}
                              style={{ width: `${nodeBarPct}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between font-mono text-[11px] mb-1.5 tabular-nums">
                            <span className="text-neutral-600">
                              Execution Latency & Seat Efficiency
                            </span>
                            <span
                              className={
                                b.isOptimal
                                  ? 'text-[#047857] font-semibold'
                                  : 'text-[#DC2626] font-semibold'
                              }
                            >
                              {b.executionTimeMs} ms · {b.seatUtilizationPct}% util
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="h-2 bg-[#DCD0BE] overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  b.isOptimal ? 'bg-[#059669]' : 'bg-[#DC2626]'
                                }`}
                                style={{ width: `${runtimeBarPct}%` }}
                              />
                            </div>
                            <div className="h-2 bg-[#DCD0BE] overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  b.isOptimal ? 'bg-[#059669]' : 'bg-[#DC2626]'
                                }`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(10, b.seatUtilizationPct),
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Part B: Symbolic vs Statistical ML Regression Comparator (50/50 Hairline Split) */}
      <section className="border-b border-[#DCD0BE] bg-[#F5EFE6]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-[#DCD0BE] items-stretch">
          <LateralSlideCard
            index={0}
            className="lg:col-span-6 px-4 sm:px-6 lg:px-8 py-12 space-y-6"
          >
            <div className="flex items-center justify-between border-b border-[#DCD0BE] pb-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
                  Part B · Symbolic vs ML MAE
                </p>
                <h2 className="font-serif text-2xl font-bold text-[#111827] mt-0.5">
                  Floor Turnover Model Comparison
                </h2>
              </div>
              <BarChart3 className="w-5 h-5 text-[#DC2626]" />
            </div>

            <div className="grid grid-cols-2 divide-x divide-[#DCD0BE] border border-[#DCD0BE] bg-[#ECE3D3] font-mono">
              <div className="p-5">
                <span className="text-[11px] text-[#DC2626] font-semibold block">
                  Symbolic Rule MAE
                </span>
                <span className="font-serif text-3xl font-bold text-[#111827] mt-1 block tabular-nums">
                  {turnoverComparison.symbolicMae} min
                </span>
                <span className="text-[11px] text-neutral-500">
                  D = 45 + 5 × Size
                </span>
              </div>

              <div className="p-5 bg-emerald-50/40">
                <span className="text-[11px] text-[#047857] font-semibold flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Statistical ML MAE
                </span>
                <span className="font-serif text-3xl font-bold text-[#047857] mt-1 block tabular-nums">
                  {turnoverComparison.mlMae} min
                </span>
                <span className="text-[11px] text-[#047857]">
                  59.6% lower error
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 pb-1">
                Active Floor Tables Remaining Time Forecast
              </p>
              <div className="divide-y divide-[#DCD0BE] border-y border-[#DCD0BE]">
                {turnoverComparison.predictions.map((pred) => (
                  <div
                    key={pred.tableId}
                    className="py-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs"
                  >
                    <div>
                      <span className="text-[#DC2626] font-semibold">
                        {pred.tableId}
                      </span>{' '}
                      <span className="text-neutral-700">
                        ({pred.partySize}p · {pred.course})
                      </span>
                    </div>
                    <div className="flex items-center gap-4 tabular-nums">
                      <span className="text-neutral-500">
                        Sym: {pred.symbolicEstimateMins}m
                      </span>
                      <span className="text-[#047857] font-semibold">
                        ML: {pred.mlEstimateMins}m
                      </span>
                      <span className="text-[#111827] font-semibold">
                        P(Free₁₀): {Math.round(pred.bayesianFreeIn10Prob * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </LateralSlideCard>

          {/* Interactive Test Custom Party Duration Simulator */}
          <LateralSlideCard
            index={1}
            className="lg:col-span-6 px-4 sm:px-6 lg:px-8 py-12 space-y-6 border-t lg:border-t-0 border-[#DCD0BE] bg-[#ECE3D3]"
          >
            <div className="flex items-center justify-between border-b border-[#DCD0BE] pb-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#059669] font-semibold">
                  Interactive Regressor Probe
                </p>
                <h2 className="font-serif text-2xl font-bold text-[#111827] mt-0.5">
                  Test Custom Party Duration
                </h2>
              </div>
              <Activity className="w-5 h-5 text-[#059669]" />
            </div>

            <div className="bg-[#F5EFE6] border border-[#DCD0BE] p-4">
              <div className="flex justify-between font-mono text-xs mb-2">
                <label
                  htmlFor="custom-size-slider"
                  className="text-[#111827] font-medium"
                >
                  Custom Party Size
                </label>
                <span className="text-[#DC2626] font-bold tabular-nums">
                  {customSize} Guests
                </span>
              </div>
              <input
                id="custom-size-slider"
                type="range"
                min="1"
                max="8"
                step="1"
                value={customSize}
                onChange={(e) => setCustomSize(Number(e.target.value))}
                className="w-full accent-[#DC2626]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#DCD0BE] border border-[#DCD0BE] bg-[#F5EFE6]">
              {[
                {
                  label: 'Weekend Service',
                  active: isWeekend,
                  toggle: () => setIsWeekend((v) => !v),
                },
                {
                  label: 'Peak Dinner Hour',
                  active: isPeakHour,
                  toggle: () => setIsPeakHour((v) => !v),
                },
                {
                  label: 'Ordered Drinks',
                  active: orderedDrinks,
                  toggle: () => setOrderedDrinks((v) => !v),
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.toggle}
                  aria-pressed={item.active}
                  className={`px-3 py-3 text-xs font-medium transition-colors ${
                    item.active
                      ? 'bg-emerald-50 text-[#047857] font-semibold'
                      : 'bg-[#F5EFE6] text-neutral-600 hover:bg-[#EFE6D8]'
                  }`}
                >
                  {item.label}: {item.active ? 'Yes' : 'No'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 divide-x divide-[#DCD0BE] border border-[#DCD0BE] bg-[#F5EFE6] font-mono">
              <div className="p-5">
                <span className="text-[11px] text-neutral-500 block">
                  Symbolic Formula Output
                </span>
                <span className="font-serif text-3xl font-bold text-[#111827] mt-1 block tabular-nums">
                  {customPrediction.symbolicTotalMins} min
                </span>
                <span className="text-[11px] text-neutral-500">
                  {customPrediction.symbolicFormula}
                </span>
              </div>
              <div className="p-5 bg-red-50/40">
                <span className="text-[11px] text-[#DC2626] font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  ML Regression Forecast
                </span>
                <span className="font-serif text-3xl font-bold text-[#DC2626] mt-1 block tabular-nums">
                  {customPrediction.mlTotalMins} min
                </span>
                <span className="text-[11px] text-neutral-700 tabular-nums">
                  Variance: {customPrediction.deltaMins >= 0 ? '+' : ''}
                  {customPrediction.deltaMins} min vs rule
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                ML Feature Attribution
              </p>
              <div className="divide-y divide-[#DCD0BE] border-y border-[#DCD0BE] bg-[#F5EFE6]">
                {customPrediction.featureContributions.map((feat) => (
                  <div
                    key={feat.feature}
                    className="flex items-center justify-between font-mono text-xs px-4 py-2.5"
                  >
                    <span className="text-neutral-700">{feat.feature}</span>
                    <span
                      className={`tabular-nums font-semibold ${
                        feat.deltaMins >= 0
                          ? 'text-[#DC2626]'
                          : 'text-[#047857]'
                      }`}
                    >
                      {feat.deltaMins >= 0
                        ? `+${feat.deltaMins}`
                        : feat.deltaMins}{' '}
                      min
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </LateralSlideCard>
        </div>
      </section>
    </div>
  );
}
