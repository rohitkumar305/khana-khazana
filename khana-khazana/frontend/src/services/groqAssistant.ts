import type {
  IngredientItem,
  MaitreDMessage,
  MenuDish,
  ReservationRecord,
  RestaurantTable,
  WaitingParty,
  WaiterAgent,
} from '../../../backend/engine/types';
import {
  buildGroqKnowledgeContext,
  HALLUCINATION_REFUSAL_TEXT,
} from '../../../backend/engine/ragGrounding';
import { resolveApiUrl } from '../api/backendService';

export interface GroqAssistantQueryParams {
  message: string;
  portal: 'customer' | 'admin';
  tables: RestaurantTable[];
  queue: WaitingParty[];
  waiters: WaiterAgent[];
  ingredients: IngredientItem[];
  reservations: ReservationRecord[];
  menuDishes?: MenuDish[];
}

export interface GroqAssistantResponse
  extends Pick<
    MaitreDMessage,
    'content' | 'sources' | 'refusalTriggered' | 'latencyMs' | 'model' | 'provider'
  > {
  grounded: boolean;
}

export interface GroqHealthStatus {
  groqConfigured: boolean;
  groqModel: string;
  dbConnected: boolean;
}

export async function fetchGroqHealthStatus(): Promise<GroqHealthStatus> {
  try {
    const resp = await fetch(resolveApiUrl('/api/health'));
    if (!resp.ok) {
      return {
        groqConfigured: false,
        groqModel: 'openai/gpt-oss-120b',
        dbConnected: false,
      };
    }
    const data = (await resp.json()) as {
      groqConfigured?: boolean;
      groqModel?: string;
      dbConnected?: boolean;
    };
    return {
      groqConfigured: Boolean(data.groqConfigured),
      groqModel: data.groqModel ?? 'openai/gpt-oss-120b',
      dbConnected: Boolean(data.dbConnected),
    };
  } catch {
    return {
      groqConfigured: false,
      groqModel: 'openai/gpt-oss-120b',
      dbConnected: false,
    };
  }
}

export async function queryGroqAssistant(
  params: GroqAssistantQueryParams,
): Promise<GroqAssistantResponse> {
  const t0 = performance.now();

  const resp = await fetch(resolveApiUrl('/api/groq/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    let message = `Groq API returned HTTP ${resp.status}`;
    try {
      const errData = (await resp.json()) as { error?: string };
      if (errData?.error) message = errData.error;
    } catch {
      // Ignore parse failure
    }
    throw new Error(message);
  }

  const data = (await resp.json()) as {
    reply?: string;
    sources?: string[];
    refusalTriggered?: boolean;
    latencyMs?: number;
    model?: string;
    provider?: 'groq';
    grounded?: boolean;
  };

  if (!data.reply) {
    throw new Error('Groq API returned an empty response.');
  }

  return {
    content: data.reply,
    sources:
      Array.isArray(data.sources) && data.sources.length > 0
        ? data.sources
        : ['[restaurant_policies.md]', '[live_floor_db]'],
    refusalTriggered: Boolean(data.refusalTriggered),
    latencyMs: Math.max(
      1,
      Math.round(data.latencyMs ?? performance.now() - t0),
    ),
    model: data.model ?? 'openai/gpt-oss-120b',
    provider: data.provider ?? 'groq',
    grounded: data.grounded ?? true,
  };
}

export { buildGroqKnowledgeContext, HALLUCINATION_REFUSAL_TEXT };
