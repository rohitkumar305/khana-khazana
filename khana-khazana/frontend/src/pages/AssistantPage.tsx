import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  MessageSquareText,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import {
  fetchGroqHealthStatus,
  queryGroqAssistant,
  type GroqHealthStatus,
} from '../services/aiEngine';
import {
  RESTAURANT_POLICIES,
  RESTAURANT_POLICIES_CHUNKS,
  SIGNATURE_MENU_KNOWLEDGE_BASE,
} from '../../../backend/engine/data';
import type { MaitreDMessage } from '../../../backend/engine/types';
import { RaindropHeader } from '../components/MotionPrimitives';

const TEST_PROMPTS_CUSTOMER = [
  'Can a wheelchair party of 5 sit together?',
  'Which dishes are nut-free?',
  'Is Truffle Paneer Tikka in stock?',
  'Do you have a rooftop pool?',
];

const TEST_PROMPTS_ADMIN = [
  'Can a wheelchair party of 5 sit together?',
  'Which dishes are nut-free?',
  'Is Black Truffle Shavings in stock?',
  'Do you have a rooftop pool?',
];

export function AssistantPage() {
  const { portalMode, tables, queue, waiters, ingredients, reservations, menuDishes } =
    useRestaurant();

  const isCustomer = portalMode === 'customer';
  const [inspectorTab, setInspectorTab] = useState<
    'policies' | 'allergens' | 'inventory' | 'json'
  >('policies');
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [groqHealth, setGroqHealth] = useState<GroqHealthStatus>({
    groqConfigured: false,
    groqModel: 'openai/gpt-oss-120b',
    dbConnected: false,
  });

  const [messages, setMessages] = useState<MaitreDMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: isCustomer
        ? 'Welcome to Khana-Khazana. I am powered by Groq (openai/gpt-oss-120b) and strictly grounded in our live NeonDB floor availability, kitchen stock, allergen registry, and dining policies.'
        : 'Welcome to Floor Command. The Grounded AI Maître D’ is wired to Groq (openai/gpt-oss-120b) with live T1–T10 NeonDB telemetry, exact pantry gram counts, and restaurant_policies.md.',
      sources: ['[restaurant_policies.md]', '[live_floor_db]'],
      model: 'openai/gpt-oss-120b',
      provider: 'groq',
      timestamp: 'Ready',
    },
  ]);

  useEffect(() => {
    let active = true;
    fetchGroqHealthStatus().then((status) => {
      if (active) setGroqHealth(status);
    });
    return () => {
      active = false;
    };
  }, []);

  const activePrompts = isCustomer
    ? TEST_PROMPTS_CUSTOMER
    : TEST_PROMPTS_ADMIN;

  const sendQuery = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`;

    const userMsg: MaitreDMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      sources: [],
      timestamp: ts,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const result = await queryGroqAssistant({
        message: trimmed,
        portal: portalMode,
        tables,
        queue,
        waiters,
        ingredients,
        reservations,
        menuDishes,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: result.content,
          sources: result.sources,
          refusalTriggered: result.refusalTriggered,
          latencyMs: result.latencyMs,
          model: result.model,
          provider: result.provider,
          timestamp: ts,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content:
            err instanceof Error
              ? err.message
              : 'Unable to reach Groq Cloud API. Verify GROQ_API_KEY in server environment variables.',
          sources: [],
          isError: true,
          model: groqHealth.groqModel,
          provider: 'groq',
          timestamp: ts,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="overflow-x-clip bg-[#F5EFE6] text-[#111827] pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <RaindropHeader
          asPageTitle
          kicker={
            isCustomer
              ? 'Customer Portal · Groq Grounded Concierge'
              : 'Admin Command · Groq Grounded Maître D’'
          }
          title={
            isCustomer
              ? 'Groq AI Guest Concierge & Allergen Guide'
              : 'Zero-Hallucination Groq AI Maître D’ & Context Inspector'
          }
          subtitle="Powered by Groq Cloud (openai/gpt-oss-120b) with strict RAG grounding over Khana-Khazana policies, allergen registries, live T1–T10 occupancy, and NeonDB kitchen stock."
        />
      </div>

      {/* Full-Width 2-Column Split Architectural Workspace (40% Left / 60% Right) */}
      <section className="border-y border-[#DCD0BE] bg-[#F5EFE6]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-[#DCD0BE] items-stretch">
          {/* Left Column (~40%): Live Knowledge Base & Floor Context Inspector + One-Click Test Prompts */}
          <div className="lg:col-span-5 px-4 sm:px-6 lg:px-8 py-9 space-y-6 bg-[#ECE3D3]">
            <div className="flex items-start justify-between border-b border-[#DCD0BE] pb-4 gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#DC2626] font-semibold">
                  01 — RAG Context Payload
                </p>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#111827] mt-1">
                  Knowledge Base & Live Floor
                </h2>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Hours: {RESTAURANT_POLICIES.hours}
                </p>
              </div>
              <Database className="w-5 h-5 text-[#059669] shrink-0 mt-1" />
            </div>

            {/* Inspector Tabs */}
            <div className="flex items-center gap-4 sm:gap-5 border-b border-[#DCD0BE] overflow-x-auto">
              {(
                [
                  { id: 'policies', label: 'Policies' },
                  { id: 'allergens', label: 'Allergens' },
                  { id: 'inventory', label: 'Live Pantry' },
                  { id: 'json', label: 'Floor JSON' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInspectorTab(tab.id)}
                  className={`pb-2.5 font-mono text-[11px] sm:text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    inspectorTab === tab.id
                      ? 'border-[#DC2626] text-[#DC2626]'
                      : 'border-transparent text-neutral-600 hover:text-[#111827]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Inspector Body */}
            {inspectorTab === 'policies' ? (
              <div className="divide-y divide-[#DCD0BE] max-h-[340px] overflow-y-auto pr-1">
                {RESTAURANT_POLICIES_CHUNKS.map((chunk) => (
                  <div key={chunk.id} className="py-3 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-[#DC2626] font-semibold flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {chunk.id} · {chunk.section}
                      </span>
                      <span className="text-neutral-500">[{chunk.sourceFile}]</span>
                    </div>
                    <p className="text-xs text-neutral-700 leading-relaxed">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : inspectorTab === 'allergens' ? (
              <div className="divide-y divide-[#DCD0BE] max-h-[340px] overflow-y-auto pr-1">
                {SIGNATURE_MENU_KNOWLEDGE_BASE.map((dish) => (
                  <div
                    key={dish.name}
                    className="py-3 first:pt-0 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#111827]">
                        {dish.name} · ₹{dish.price}
                      </p>
                      <p className="font-mono text-[11px] text-neutral-600 mt-0.5">
                        Allergens: {dish.allergens.join(', ')}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                        dish.nutFree ? 'text-[#047857]' : 'text-[#DC2626]'
                      }`}
                    >
                      {dish.nutFree ? 'Nut-Free' : 'Contains Nuts'}
                    </span>
                  </div>
                ))}
              </div>
            ) : inspectorTab === 'inventory' ? (
              <div className="divide-y divide-[#DCD0BE] max-h-[340px] overflow-y-auto pr-1">
                {ingredients.map((ing) => (
                  <div
                    key={ing.id}
                    className="py-2.5 first:pt-0 flex items-center justify-between text-xs gap-2"
                  >
                    <div>
                      <p className="font-semibold text-[#111827]">{ing.name}</p>
                      <p className="text-[11px] text-neutral-500">
                        {ing.perOrderHighlight}
                      </p>
                    </div>
                    <span
                      className={`font-mono font-semibold tabular-nums shrink-0 ${
                        ing.stock <= 0 ? 'text-[#DC2626]' : 'text-[#047857]'
                      }`}
                    >
                      {ing.stock} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="bg-[#FBF8F2] border border-[#DCD0BE] p-3.5 font-mono text-[11px] text-[#047857] max-h-[340px] overflow-auto">
                {JSON.stringify(
                  {
                    tables: tables.map((t) => ({
                      id: t.id,
                      cap: t.capacity,
                      zone: t.zone,
                      accessible: t.isAccessible,
                      status: t.status,
                      course: t.currentCourse,
                    })),
                    waitingQueue: queue.filter((p) => p.status === 'WAITING'),
                    reservationsCount: reservations.length,
                  },
                  null,
                  2,
                )}
              </pre>
            )}

            {/* One-Click Grounded & Guardrail Test Prompts */}
            <div className="pt-4 border-t border-[#DCD0BE] space-y-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#047857] font-semibold">
                One-Click Verification Prompts
              </p>
              <div className="divide-y divide-[#DCD0BE] border-y border-[#DCD0BE] bg-[#FBF8F2]">
                {activePrompts.map((promptText) => {
                  const isRefusalTest = promptText.toLowerCase().includes('pool');
                  return (
                    <button
                      key={promptText}
                      type="button"
                      onClick={() => sendQuery(promptText)}
                      disabled={isSending}
                      className="w-full px-3 py-2.5 text-left text-xs flex items-center justify-between gap-2 hover:bg-[#ECE3D3]/60 transition-colors disabled:opacity-50"
                    >
                      <span
                        className={
                          isRefusalTest
                            ? 'text-[#B91C1C] font-medium'
                            : 'text-[#111827] font-medium'
                        }
                      >
                        {isRefusalTest
                          ? `Guardrail Test: ${promptText}`
                          : promptText}
                      </span>
                      <span
                        className={`font-mono text-[10px] shrink-0 ${
                          isRefusalTest ? 'text-[#DC2626]' : 'text-[#059669]'
                        }`}
                      >
                        Run →
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (~60%): Editorial Groq Conversation Stream */}
          <div className="lg:col-span-7 px-4 sm:px-6 lg:px-8 py-9 flex flex-col min-h-[620px] border-t lg:border-t-0 border-[#DCD0BE] bg-[#FBF8F2]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCD0BE] pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <MessageSquareText className="w-5 h-5 text-[#DC2626]" />
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#111827]">
                    {isCustomer
                      ? 'Khana-Khazana AI Concierge'
                      : "Grounded AI Maître D'"}
                  </h2>
                  <p className="font-mono text-[11px] text-neutral-600 mt-0.5">
                    Temperature 0.1 · Strict Knowledge Base + Live Floor Verification
                  </p>
                </div>
              </div>

              <div
                className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                  groqHealth.groqConfigured
                    ? 'border-[#059669]/40 bg-emerald-50/70 text-[#047857]'
                    : 'border-amber-600/40 bg-amber-50/70 text-amber-800'
                }`}
              >
                {groqHealth.groqConfigured ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                )}
                <span>
                  Groq • {groqHealth.groqModel} •{' '}
                  {groqHealth.groqConfigured ? 'Live API' : 'Server Key Not Configured'}
                </span>
              </div>
            </div>

            {/* Editorial Conversation Feed (Zero Generic Rounded Box Cards) */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#DCD0BE] pr-1 mb-5">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`py-4 first:pt-1 ${
                    m.role === 'user'
                      ? 'bg-[#ECE3D3]/45 px-4 border-b border-[#DCD0BE]'
                      : m.isError || m.refusalTriggered
                      ? 'bg-red-50/40 px-4'
                      : 'px-1'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-neutral-500 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`uppercase tracking-wider font-semibold ${
                          m.isError || m.refusalTriggered
                            ? 'text-[#DC2626]'
                            : m.role === 'user'
                            ? 'text-[#DC2626]'
                            : 'text-[#047857]'
                        }`}
                      >
                        {m.role === 'user'
                          ? isCustomer
                            ? 'Guest Prompt'
                            : 'Admin Query'
                          : isCustomer
                          ? 'AI Concierge'
                          : "AI Maître D'"}
                      </span>

                      {m.role === 'assistant' && !m.refusalTriggered && !m.isError && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-[#059669]/30 text-[#047857] font-semibold">
                          <Sparkles className="w-2.5 h-2.5" />
                          Groq • {m.model ?? 'openai/gpt-oss-120b'} • Live API
                        </span>
                      )}

                      {m.isError && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-[#DC2626]/30 text-[#B91C1C] font-semibold">
                          <AlertCircle className="w-2.5 h-2.5" />
                          API Error
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 tabular-nums">
                      {typeof m.latencyMs === 'number' && (
                        <span className="inline-flex items-center gap-1 text-neutral-600">
                          <Clock className="w-3 h-3" />
                          {m.latencyMs}ms
                        </span>
                      )}
                      <span>{m.timestamp}</span>
                    </div>
                  </div>

                  <p
                    className={`text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'font-medium text-[#991B1B]'
                        : m.isError
                        ? 'font-medium text-[#B91C1C]'
                        : 'text-[#111827]'
                    }`}
                  >
                    {m.content}
                  </p>

                  {m.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-[#DCD0BE]/70 flex flex-wrap items-center gap-2">
                      {m.refusalTriggered ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#DC2626] font-semibold">
                          <ShieldAlert className="w-3 h-3" />
                          Strict Hallucination Refusal
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#047857] font-semibold">
                          <ShieldCheck className="w-3 h-3" />
                          Citations:
                        </span>
                      )}
                      {m.sources.map((src) => (
                        <span
                          key={src}
                          className="px-2 py-0.5 bg-[#ECE3D3] border border-[#DCD0BE] font-mono text-[10px] text-[#111827]"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="py-4 px-2 font-mono text-xs text-[#047857]">
                  Querying Groq (openai/gpt-oss-120b) against restaurant_policies.md & live NeonDB floor state...
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendQuery(input);
              }}
              className="flex gap-3 pt-4 border-t border-[#DCD0BE]"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about nut-free dishes, wheelchair parties of 5, live pantry stock, or test guardrail..."
                aria-label={isCustomer ? 'Ask AI Concierge' : "Ask AI Maître D'"}
                className="flex-1 bg-transparent border-b border-[#C9BCAA] px-2 py-2.5 text-sm text-[#111827] placeholder:text-neutral-400 focus:outline-none focus:border-[#DC2626]"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="px-6 py-2.5 rounded-full bg-[#DC2626] text-white font-semibold text-sm hover:bg-[#B91C1C] disabled:opacity-50 transition-colors inline-flex items-center gap-2 shrink-0"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
