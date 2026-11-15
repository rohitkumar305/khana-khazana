/**
 * Modular Backend Service Layer for Khana-Khazana Dual-Portal Architecture.
 *
 * Connected strictly to Express + NeonDB PostgreSQL (`/api/*`) on local Node.js and Vercel Serverless.
 */

import type {
  AgentEvent,
  AllocationResult,
  AStarWeights,
  BookingValidationRequest,
  BookingValidationResponse,
  CourseStage,
  IngredientItem,
  KitchenOrder,
  MaitreDMessage,
  MenuDish,
  OrderIngredientValidationRequest,
  OrderIngredientValidationResponse,
  ReservationRecord,
  RestaurantTable,
  TableStatus,
  WaitingParty,
  WaiterAgent,
  XaiAuditLog,
} from '../../../backend/engine/types';

export interface HydratedFloorPayload {
  dbConnected: boolean;
  dbLatencyMs: number;
  tables: RestaurantTable[];
  queue: WaitingParty[];
  reservations: ReservationRecord[];
  ingredients: IngredientItem[];
  menuDishes: MenuDish[];
  orders: KitchenOrder[];
  waiters: WaiterAgent[];
  events: AgentEvent[];
  xaiLogs: XaiAuditLog[];
}

export function normalizeApiBase(rawInput: string, browserHostname?: string): string {
  const raw = rawInput.trim().replace(/\/+$/, '');
  if (!raw) return '';
  if (!/^https?:\/\/[^/\s]+/i.test(raw)) {
    return '';
  }
  if (browserHostname) {
    const isBrowserLocal =
      browserHostname === 'localhost' || browserHostname === '127.0.0.1';
    const isConfiguredLocal =
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw);
    if (!isBrowserLocal && isConfiguredLocal) {
      return '';
    }
  }
  return raw;
}

export function resolveApiBase(): string {
  const raw = import.meta.env?.VITE_API_BASE_URL ?? '';
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : undefined;
  return normalizeApiBase(raw, hostname);
}

export function resolveApiUrl(apiPath: string): string {
  return `${resolveApiBase()}${apiPath}`;
}

async function readErrorMessage(resp: Response, fallback: string): Promise<string> {
  try {
    const data = (await resp.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // Ignore non-JSON error body
  }
  return `${fallback} (HTTP ${resp.status})`;
}

export async function fetchFloorStateFromApi(): Promise<HydratedFloorPayload> {
  const resp = await fetch(resolveApiUrl('/api/floor/state'));
  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp, 'Failed to connect to NeonDB floor state'));
  }
  const data = (await resp.json()) as HydratedFloorPayload & { ok?: boolean; error?: string };
  if (!data.ok) {
    throw new Error(data.error || 'NeonDB floor snapshot returned invalid response.');
  }
  return data;
}

export async function validateAndCreateBooking(
  payload: BookingValidationRequest,
  tables: RestaurantTable[],
  reservations: ReservationRecord[],
): Promise<BookingValidationResponse> {
  const t0 = performance.now();
  const resp = await fetch(resolveApiUrl('/api/bookings/validate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request: payload,
      tables,
      reservations,
    }),
  });
  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp, 'Booking validation failed'));
  }
  const data = (await resp.json()) as BookingValidationResponse;
  return {
    ...data,
    persistedToDb: Boolean(data.persistedToDb),
    responseTimeMs: Math.max(
      1,
      Math.round(data.responseTimeMs || performance.now() - t0),
    ),
  };
}

export async function cancelReservationApi(
  bookingId: string,
): Promise<{ ok: boolean; reservation: ReservationRecord }> {
  const resp = await fetch(
    resolveApiUrl(`/api/reservations/${encodeURIComponent(bookingId)}/cancel`),
    {
      method: 'POST',
    },
  );
  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp, 'Failed to cancel reservation'));
  }
  return (await resp.json()) as { ok: boolean; reservation: ReservationRecord };
}

export async function checkInGuestViaApi(
  bookingIdOrPartyId: string,
  weights?: AStarWeights,
): Promise<{
  allocation: AllocationResult;
  responseTimeMs: number;
  persistedToDb?: boolean;
  xaiLog?: XaiAuditLog;
  agentEvent?: AgentEvent;
}> {
  const resp = await fetch(resolveApiUrl('/api/bookings/check-in'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingIdOrPartyId, weights }),
  });
  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp, 'Guest check-in failed'));
  }
  return (await resp.json()) as {
    allocation: AllocationResult;
    responseTimeMs: number;
    persistedToDb?: boolean;
    xaiLog?: XaiAuditLog;
    agentEvent?: AgentEvent;
  };
}

export async function validateOrderIngredients(
  payload: OrderIngredientValidationRequest,
  menuDishes: MenuDish[],
  ingredients: IngredientItem[],
): Promise<OrderIngredientValidationResponse & { agentEvent?: AgentEvent }> {
  const t0 = performance.now();
  const resp = await fetch(resolveApiUrl('/api/orders/validate-ingredients'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request: payload,
      menuDishes,
      ingredients,
    }),
  });

  if (resp.status === 409) {
    const conflictData = (await resp.json()) as OrderIngredientValidationResponse & {
      agentEvent?: AgentEvent;
      error?: string;
    };
    if (Array.isArray(conflictData.conflicts) && conflictData.conflicts.length > 0) {
      return {
        ...conflictData,
        ok: false,
        persistedToDb: false,
        responseTimeMs: Math.max(
          1,
          Math.round(conflictData.responseTimeMs || performance.now() - t0),
        ),
      };
    }
    throw new Error(conflictData.error || 'Insufficient ingredient stock for order.');
  }

  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp, 'Order placement failed'));
  }

  const data = (await resp.json()) as OrderIngredientValidationResponse & {
    agentEvent?: AgentEvent;
  };
  return {
    ...data,
    persistedToDb: Boolean(data.persistedToDb),
    responseTimeMs: Math.max(
      1,
      Math.round(data.responseTimeMs || performance.now() - t0),
    ),
  };
}

export async function advanceOrderStatusApi(
  orderId: string,
): Promise<KitchenOrder> {
  const resp = await fetch(
    resolveApiUrl(`/api/orders/${encodeURIComponent(orderId)}/advance`),
    {
      method: 'PATCH',
    },
  );
  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp, 'Failed to advance order status'));
  }
  const data = (await resp.json()) as { order?: KitchenOrder };
  if (!data.order) {
    throw new Error('Updated order payload missing from server response.');
  }
  return data.order;
}

export async function updateIngredientStockApi(
  ingredientId: string,
  stock: number,
): Promise<IngredientItem> {
  const resp = await fetch(
    resolveApiUrl(`/api/ingredients/${encodeURIComponent(ingredientId)}`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock }),
    },
  );
  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp, 'Failed to update ingredient stock'));
  }
  const data = (await resp.json()) as { ingredient?: IngredientItem };
  if (!data.ingredient) {
    throw new Error('Updated ingredient payload missing from server response.');
  }
  return data.ingredient;
}

export async function updateTableStateApi(
  tableId: string,
  status: TableStatus,
  course?: CourseStage,
): Promise<RestaurantTable> {
  const resp = await fetch(
    resolveApiUrl(`/api/tables/${encodeURIComponent(tableId)}`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, course }),
    },
  );
  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp, 'Failed to update table state'));
  }
  const data = (await resp.json()) as { table?: RestaurantTable };
  if (!data.table) {
    throw new Error('Updated table payload missing from server response.');
  }
  return data.table;
}

export async function stepSimulationTickApi(tickCount: number): Promise<{
  tables: RestaurantTable[];
  queue: WaitingParty[];
  waiters: WaiterAgent[];
  newEvents: AgentEvent[];
}> {
  const resp = await fetch(resolveApiUrl('/api/simulation/tick'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickCount }),
  });
  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp, 'Failed to advance simulation tick'));
  }
  return (await resp.json()) as {
    tables: RestaurantTable[];
    queue: WaitingParty[];
    waiters: WaiterAgent[];
    newEvents: AgentEvent[];
  };
}

export async function resetFloorApi(): Promise<HydratedFloorPayload> {
  const resp = await fetch(resolveApiUrl('/api/floor/reset'), {
    method: 'POST',
  });
  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp, 'Failed to reset floor state'));
  }
  const data = (await resp.json()) as HydratedFloorPayload & { ok?: boolean; error?: string };
  if (!data.ok) {
    throw new Error(data.error || 'Floor reset failed.');
  }
  return data;
}

export async function allocateTableViaAStar(
  tables: RestaurantTable[],
  party: WaitingParty,
  remainingQueueCount: number,
  weights?: AStarWeights,
): Promise<{ result: AllocationResult; responseTimeMs: number }> {
  const t0 = performance.now();
  const resp = await fetch(resolveApiUrl('/api/ai/allocate-table'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tables,
      party,
      remainingQueueCount,
      weights,
    }),
  });
  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp, 'A* allocation failed'));
  }
  const data = (await resp.json()) as { result: AllocationResult };
  return {
    result: data.result,
    responseTimeMs: Math.max(1, Math.round(performance.now() - t0)),
  };
}

export async function queryMaitreDRag(params: {
  message: string;
  portal: 'customer' | 'admin';
  tables: RestaurantTable[];
  queue: WaitingParty[];
  waiters: WaiterAgent[];
  ingredients: IngredientItem[];
  reservations: ReservationRecord[];
  menuDishes?: MenuDish[];
}): Promise<
  Pick<
    MaitreDMessage,
    'content' | 'sources' | 'refusalTriggered' | 'latencyMs' | 'model' | 'provider'
  >
> {
  const t0 = performance.now();
  const resp = await fetch(resolveApiUrl('/api/groq/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp, 'Groq assistant request failed'));
  }
  const data = (await resp.json()) as {
    reply?: string;
    sources?: string[];
    refusalTriggered?: boolean;
    latencyMs?: number;
    model?: string;
    provider?: 'groq';
  };
  if (!data.reply) {
    throw new Error('Groq assistant returned an empty reply.');
  }
  return {
    content: data.reply,
    sources:
      Array.isArray(data.sources) && data.sources.length > 0
        ? data.sources
        : ['[restaurant_policies.md]', '[live_floor_db]'],
    refusalTriggered: Boolean(data.refusalTriggered),
    latencyMs: data.latencyMs ?? Math.round(performance.now() - t0),
    model: data.model ?? 'openai/gpt-oss-120b',
    provider: data.provider ?? 'groq',
  };
}
