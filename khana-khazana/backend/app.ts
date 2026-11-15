import 'dotenv/config';
import express, { type Express } from 'express';
import {
  runAStarAllocation,
  stepMultiAgentSimulation,
} from './engine/aiEngine';
import {
  validateBookingWorkflow,
  validateOrderIngredientsWorkflow,
} from './engine/workflows';
import {
  buildGroqKnowledgeContext,
  HALLUCINATION_REFUSAL_TEXT,
} from './engine/ragGrounding';
import {
  cancelReservationInDb,
  checkDbHealth,
  ensureSchemaAndSeed,
  fetchFullFloorSnapshot,
  InsufficientStockError,
  persistBookingTransaction,
  persistGuestArrivalTransaction,
  persistIngredientStockUpdate,
  persistOrderAndInventoryTransaction,
  persistOrderStatusAdvance,
  persistSimulationStep,
  persistTableStateUpdate,
  resetNeonFloorToSeed,
} from './db/neon';
import type {
  AgentEvent,
  AStarWeights,
  BookingValidationRequest,
  CourseStage,
  OrderIngredientValidationRequest,
  OrderStatus,
  RestaurantTable,
  TableStatus,
  WaitingParty,
  XaiAuditLog,
} from './engine/types';

interface MaitreDRequestBody {
  message?: string;
  portal?: 'customer' | 'admin';
}

function nowTimeString(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

export function isGroqConfigured(): boolean {
  const key = (process.env.GROQ_API_KEY ?? '').trim();
  return Boolean(key && key !== 'YOUR_GROQ_API_KEY' && key !== 'MY_GROQ_API_KEY');
}

function parseGroqJsonContent(raw: string): {
  reply?: string;
  sources?: string[];
  refusalTriggered?: boolean;
} | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as {
      reply?: string;
      sources?: string[];
      refusalTriggered?: boolean;
    };
  } catch {
    const braceStart = cleaned.indexOf('{');
    const braceEnd = cleaned.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(cleaned.slice(braceStart, braceEnd + 1)) as {
          reply?: string;
          sources?: string[];
          refusalTriggered?: boolean;
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function createApiApp(): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', async (_req, res) => {
    await ensureSchemaAndSeed().catch(() => false);
    const health = await checkDbHealth();
    res.json({
      ok: health.connected,
      service: 'khana-khazana-dual-portal',
      dbConnected: health.connected,
      dbLatencyMs: health.latencyMs,
      database: 'neondb',
      groqConfigured: isGroqConfigured(),
      groqModel: 'openai/gpt-oss-120b',
    });
  });

  // Full Floor & Telemetry Snapshot from NeonDB
  app.get('/api/floor/state', async (_req, res) => {
    try {
      const snap = await fetchFullFloorSnapshot();
      if (!snap) {
        res.status(503).json({
          ok: false,
          error: 'NeonDB connection unavailable.',
        });
        return;
      }
      res.json({ ok: true, ...snap });
    } catch (err) {
      console.error('[/api/floor/state] Error:', err);
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to fetch floor state',
      });
    }
  });

  // Workflow A: Smart Booking Validation, NeonDB Lock & Pass Dispatch
  app.post('/api/bookings/validate', async (req, res) => {
    const t0 = performance.now();
    const body = (req.body ?? {}) as {
      request?: BookingValidationRequest;
    };
    const r = body.request;
    if (!r) {
      res.status(400).json({ error: 'Invalid booking validation payload.' });
      return;
    }
    if (!r.guestName?.trim() || !r.email?.trim() || !r.phone?.trim() || !r.dateTime?.trim()) {
      res.status(400).json({
        error: 'Guest name, email, phone number, and date/time slot are required.',
      });
      return;
    }
    if (!Number.isFinite(r.partySize) || r.partySize < 1 || r.partySize > 10) {
      res.status(400).json({ error: 'Party size must be between 1 and 10 guests.' });
      return;
    }
    const parsedSlot = Date.parse(r.dateTime);
    if (Number.isNaN(parsedSlot)) {
      res.status(400).json({ error: 'Invalid reservation date and time format.' });
      return;
    }
    if (parsedSlot < Date.now() - 15 * 60_000) {
      res.status(400).json({
        error: 'Cannot create a reservation in the past. Please choose an upcoming time slot.',
      });
      return;
    }

    try {
      const snap = await fetchFullFloorSnapshot();
      if (!snap) {
        res.status(503).json({ error: 'NeonDB connection unavailable.' });
        return;
      }

      const result = validateBookingWorkflow(
        r,
        snap.tables,
        snap.reservations,
      );

      if (result.fulfillable && result.reservation) {
        const rec = result.reservation;
        const newParty: WaitingParty = {
          id: `P-${rec.bookingId.replace('KK-', '')}`,
          name: rec.guestName,
          size: rec.partySize,
          isVip: rec.isVip,
          needsWheelchair: rec.needsWheelchair,
          preferredZone: rec.preferredZone,
          dietaryNotes: rec.specialRequests,
          waitMins: 0,
          status: 'WAITING',
          bookingId: rec.bookingId,
        };
        const newXaiLog: XaiAuditLog = {
          id: `xai-${Date.now()}`,
          timestamp: rec.createdAt,
          partyName: rec.guestName,
          partySize: rec.partySize,
          assignedTables: rec.assignedTableIds,
          algorithm: 'Forward-Chaining + NeonDB Lock',
          fScore: rec.fScore,
          bayesianProb: rec.bayesianConfidencePct / 100,
          rulesApplied: rec.triggeredRules,
          justification: `Booked ${rec.assignedTableIds.join(
            ' + ',
          )} (${rec.bookingId}) with pass confirmation for ${rec.email}.`,
        };
        const newEvent: AgentEvent = {
          id: `evt-bk-${Date.now()}`,
          tick: 0,
          timestamp: rec.createdAt,
          agentId: 'Host-01',
          agentName: 'Host-01 · Concierge',
          agentType: 'Host (Goal-Based)',
          utilityScore: 0.97,
          targetTableId: rec.assignedTableIds[0] ?? null,
          message: `Workflow A locked ${rec.assignedTableIds.join(
            ' + ',
          )} for ${rec.guestName} (${rec.bookingId}) in NeonDB.`,
        };

        await persistBookingTransaction({
          reservation: rec,
          party: newParty,
          xaiLog: newXaiLog,
          agentEvent: newEvent,
        });
      }

      res.json({
        ...result,
        persistedToDb: Boolean(result.fulfillable && result.reservation),
        responseTimeMs: Math.max(1, Math.round(performance.now() - t0)),
      });
    } catch (err) {
      console.error('[/api/bookings/validate] Error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Booking validation failed',
      });
    }
  });

  app.post('/api/reservations/:bookingId/cancel', async (req, res) => {
    try {
      const snap = await fetchFullFloorSnapshot();
      if (!snap) {
        res.status(503).json({ error: 'NeonDB connection unavailable.' });
        return;
      }
      const outcome = await cancelReservationInDb(req.params.bookingId);
      if (!outcome.ok) {
        res.status(404).json({ error: 'Active reservation not found.' });
        return;
      }
      res.json({ ok: true, reservation: outcome.reservation });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to cancel reservation',
      });
    }
  });

  // Workflow B (Part 2): Guest Arrival Check-In + A* Allocation + NeonDB Persistence
  app.post('/api/bookings/check-in', async (req, res) => {
    const t0 = performance.now();
    const body = (req.body ?? {}) as {
      bookingIdOrPartyId?: string;
      weights?: AStarWeights;
    };
    if (!body.bookingIdOrPartyId) {
      res.status(400).json({ error: 'bookingIdOrPartyId is required.' });
      return;
    }

    try {
      const snap = await fetchFullFloorSnapshot();
      if (!snap) {
        res.status(503).json({ error: 'NeonDB connection unavailable.' });
        return;
      }

      const idOrBooking = body.bookingIdOrPartyId;
      const matchedParty = snap.queue.find(
        (p) =>
          (p.id === idOrBooking || p.bookingId === idOrBooking) &&
          p.status === 'WAITING',
      );
      const matchedRes = snap.reservations.find(
        (r) => r.bookingId === idOrBooking && r.status !== 'CANCELLED',
      );

      const targetParty: WaitingParty | null =
        matchedParty ??
        (matchedRes
          ? {
              id: `P-${matchedRes.bookingId.replace('KK-', '')}`,
              name: matchedRes.guestName,
              size: matchedRes.partySize,
              isVip: matchedRes.isVip,
              needsWheelchair: matchedRes.needsWheelchair,
              preferredZone: matchedRes.preferredZone,
              dietaryNotes: matchedRes.specialRequests,
              waitMins: 0,
              status: 'WAITING',
              bookingId: matchedRes.bookingId,
            }
          : null);

      if (!targetParty) {
        res.status(404).json({ error: 'Waiting party or reservation not found.' });
        return;
      }

      const remaining = Math.max(
        0,
        snap.queue.filter((p) => p.status === 'WAITING').length - 1,
      );
      const allocation = runAStarAllocation(
        snap.tables,
        targetParty,
        remaining,
        body.weights,
      );
      const ts = nowTimeString();
      const responseTimeMs = Math.max(1, Math.round(performance.now() - t0));

      const xaiLog: XaiAuditLog = {
        id: `xai-arr-${Date.now()}`,
        timestamp: ts,
        partyName: targetParty.name,
        partySize: targetParty.size,
        assignedTables:
          allocation.assignedTableIds.length > 0
            ? allocation.assignedTableIds
            : ['Waitlist'],
        algorithm: 'A* Check-In Dispatch',
        fScore: allocation.fScore,
        bayesianProb: allocation.bayesianProb,
        rulesApplied:
          allocation.triggeredRules.length > 0
            ? allocation.triggeredRules
            : ['Minimal Waste Heuristic'],
        justification: allocation.explanation,
      };

      const agentEvent: AgentEvent = {
        id: `evt-arr-${Date.now()}`,
        tick: 0,
        timestamp: ts,
        agentId: 'Host-01',
        agentName: 'Host-01 · Concierge',
        agentType: 'Host (Goal-Based)',
        utilityScore: 0.98,
        targetTableId: allocation.assignedTableIds[0] ?? null,
        message: `Guest Arrived (${targetParty.name}) → A* assigned ${allocation.assignedTableIds.join(
          ' + ',
        )} & synced NeonDB (${responseTimeMs}ms).`,
      };

      if (allocation.success) {
        await persistGuestArrivalTransaction({
          assignedTableIds: allocation.assignedTableIds,
          party: targetParty,
          bookingId: targetParty.bookingId ?? matchedRes?.bookingId ?? null,
          xaiLog,
          agentEvent,
        });
      }

      res.json({
        allocation,
        responseTimeMs,
        persistedToDb: allocation.success,
        xaiLog,
        agentEvent,
      });
    } catch (err) {
      console.error('[/api/bookings/check-in] Error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Check-in failed',
      });
    }
  });

  // Workflow B (Part 1): Atomic Recipe-to-Ingredient Inventory Verification + NeonDB Deduction
  app.post('/api/orders/validate-ingredients', async (req, res) => {
    const t0 = performance.now();
    const body = (req.body ?? {}) as {
      request?: OrderIngredientValidationRequest;
    };
    const orderReq = body.request;
    if (!orderReq || !Array.isArray(orderReq.items) || orderReq.items.length === 0) {
      res.status(400).json({ error: 'At least one menu item is required to place an order.' });
      return;
    }

    try {
      const snap = await fetchFullFloorSnapshot();
      if (!snap) {
        res.status(503).json({ error: 'NeonDB connection unavailable.' });
        return;
      }

      const tbl = snap.tables.find((t) => t.id === orderReq.tableId);
      if (!tbl) {
        res.status(404).json({ error: `Table ${orderReq.tableId} does not exist.` });
        return;
      }

      const result = validateOrderIngredientsWorkflow(
        orderReq,
        snap.menuDishes,
        snap.ingredients,
      );

      if (result.ok && result.order) {
        const dishById = new Map(snap.menuDishes.map((d) => [d.id, d]));
        const deductionMap = new Map<string, number>();
        for (const item of orderReq.items) {
          const dish = dishById.get(item.dishId);
          if (!dish || item.quantity <= 0) continue;
          for (const r of dish.recipe) {
            deductionMap.set(
              r.ingredientId,
              (deductionMap.get(r.ingredientId) ?? 0) + r.amount * item.quantity,
            );
          }
        }
        const deductions = Array.from(deductionMap.entries()).map(
          ([ingredientId, amount]) => ({ ingredientId, amount }),
        );

        const matchingWaiter =
          snap.waiters.find(
            (w) => w.role === 'Waiter (Utility-Based)' && w.zone === tbl.zone,
          ) ?? snap.waiters[0];

        result.order.dispatchedAgentId = matchingWaiter?.id ?? 'W1';
        const responseTimeMs = Math.max(1, Math.round(performance.now() - t0));

        const agentEvent: AgentEvent = {
          id: `evt-ord-${Date.now()}`,
          tick: 0,
          timestamp: result.order.createdAt,
          agentId: matchingWaiter?.id ?? 'W1',
          agentName: matchingWaiter?.name ?? 'W1 · Arjun',
          agentType: 'Waiter (Utility-Based)',
          utilityScore: 0.95,
          targetTableId: orderReq.tableId,
          message: `QR Order ${result.order.orderId} committed atomically in NeonDB (${responseTimeMs}ms) → Dispatched to ${
            matchingWaiter?.name ?? 'Waiter'
          } for ${orderReq.tableId}.`,
        };

        try {
          const persistedIngredients = await persistOrderAndInventoryTransaction({
            order: result.order,
            deductions,
            waiterId: matchingWaiter?.id ?? 'W1',
            agentEvent,
          });

          res.json({
            ...result,
            updatedIngredients: persistedIngredients,
            persistedToDb: true,
            responseTimeMs,
            agentEvent,
          });
          return;
        } catch (txErr) {
          if (txErr instanceof InsufficientStockError) {
            const latestSnap = await fetchFullFloorSnapshot();
            const retryResult = latestSnap
              ? validateOrderIngredientsWorkflow(
                  orderReq,
                  latestSnap.menuDishes,
                  latestSnap.ingredients,
                )
              : result;
            res.status(409).json({
              ...retryResult,
              ok: false,
              persistedToDb: false,
              responseTimeMs: Math.max(1, Math.round(performance.now() - t0)),
            });
            return;
          }
          throw txErr;
        }
      }

      res.json({
        ...result,
        persistedToDb: false,
        responseTimeMs: Math.max(1, Math.round(performance.now() - t0)),
      });
    } catch (err) {
      console.error('[/api/orders/validate-ingredients] Error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Order validation failed',
      });
    }
  });

  app.patch('/api/orders/:orderId/advance', async (req, res) => {
    try {
      const snap = await fetchFullFloorSnapshot();
      if (!snap) {
        res.status(503).json({ error: 'NeonDB connection unavailable.' });
        return;
      }
      const target = snap.orders.find((o) => o.orderId === req.params.orderId);
      if (!target) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      const nextStatus: OrderStatus =
        target.status === 'Order Received'
          ? 'Preparing'
          : target.status === 'Preparing'
          ? 'Waiter En Route'
          : 'Served';
      const updated = await persistOrderStatusAdvance(
        req.params.orderId,
        nextStatus,
      );
      res.json({ ok: true, order: updated });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to advance order',
      });
    }
  });

  app.patch('/api/ingredients/:id', async (req, res) => {
    const body = (req.body ?? {}) as { stock?: number };
    if (typeof body.stock !== 'number' || Number.isNaN(body.stock)) {
      res.status(400).json({ error: 'Numeric stock value required.' });
      return;
    }
    try {
      const updated = await persistIngredientStockUpdate(
        req.params.id,
        body.stock,
      );
      if (!updated) {
        res.status(404).json({ error: 'Ingredient not found.' });
        return;
      }
      res.json({ ok: true, ingredient: updated });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Stock update failed',
      });
    }
  });

  app.patch('/api/tables/:id', async (req, res) => {
    const body = (req.body ?? {}) as {
      status?: TableStatus;
      course?: CourseStage;
    };
    if (!body.status) {
      res.status(400).json({ error: 'status is required.' });
      return;
    }
    try {
      const snap = await fetchFullFloorSnapshot();
      if (!snap) {
        res.status(503).json({ error: 'NeonDB connection unavailable.' });
        return;
      }
      const current = snap.tables.find((t) => t.id === req.params.id);
      if (!current) {
        res.status(404).json({ error: 'Table not found.' });
        return;
      }
      const resolvedCourse: CourseStage =
        body.course ??
        (body.status === 'Free' || body.status === 'Dirty'
          ? 'None'
          : body.status === 'Paying'
          ? 'Billing'
          : current.currentCourse === 'None'
          ? 'Mains'
          : current.currentCourse);

      const clearParty = body.status === 'Free' || body.status === 'Dirty';
      const elapsedMins = clearParty
        ? 0
        : body.status === 'Paying'
        ? Math.max(50, current.elapsedMins)
        : current.elapsedMins;

      const updated = await persistTableStateUpdate({
        tableId: req.params.id,
        status: body.status,
        currentCourse: resolvedCourse,
        elapsedMins,
        clearParty,
      });
      res.json({ ok: true, table: updated });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Table update failed',
      });
    }
  });

  app.post('/api/simulation/tick', async (req, res) => {
    const body = (req.body ?? {}) as { tickCount?: number };
    try {
      const snap = await fetchFullFloorSnapshot();
      if (!snap) {
        res.status(503).json({ error: 'NeonDB connection unavailable.' });
        return;
      }
      const tickCount =
        typeof body.tickCount === 'number' ? body.tickCount : 0;
      const sim = stepMultiAgentSimulation(
        snap.tables,
        snap.queue,
        snap.waiters,
        tickCount,
      );
      await persistSimulationStep(sim);
      res.json({ ok: true, ...sim });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Simulation step failed',
      });
    }
  });

  app.post('/api/floor/reset', async (_req, res) => {
    try {
      const snap = await resetNeonFloorToSeed();
      if (!snap) {
        res.status(503).json({ error: 'NeonDB connection unavailable.' });
        return;
      }
      res.json({ ok: true, ...snap });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Floor reset failed',
      });
    }
  });

  // Standalone A* Allocation endpoint
  app.post('/api/ai/allocate-table', (req, res) => {
    const body = (req.body ?? {}) as {
      tables?: RestaurantTable[];
      party?: WaitingParty;
      remainingQueueCount?: number;
      weights?: AStarWeights;
    };
    if (!Array.isArray(body.tables) || !body.party) {
      res.status(400).json({ error: 'Invalid table allocation payload.' });
      return;
    }
    const result = runAStarAllocation(
      body.tables,
      body.party,
      typeof body.remainingQueueCount === 'number' ? body.remainingQueueCount : 0,
      body.weights,
    );
    res.json({ result });
  });

  // Grounded Groq Cloud API (openai/gpt-oss-120b) strictly live
  async function handleGroundedAssistantRequest(
    body: MaitreDRequestBody,
  ): Promise<
    | {
        ok: true;
        reply: string;
        sources: string[];
        refusalTriggered: boolean;
        grounded: boolean;
        latencyMs: number;
        model: string;
        provider: 'groq';
      }
    | { ok: false; status: number; error: string }
  > {
    const t0 = performance.now();
    const userMessage =
      typeof body.message === 'string' ? body.message.trim() : '';
    const portal = body.portal === 'customer' ? 'customer' : 'admin';

    const groqApiKey = (process.env.GROQ_API_KEY ?? '').trim();
    if (!isGroqConfigured()) {
      return {
        ok: false,
        status: 503,
        error: 'GROQ_API_KEY is not configured on the server.',
      };
    }

    const snap = await fetchFullFloorSnapshot().catch(() => null);
    if (!snap) {
      return {
        ok: false,
        status: 503,
        error: 'NeonDB connection unavailable for grounded assistant context.',
      };
    }

    const ragContext = buildGroqKnowledgeContext({
      portal,
      tables: snap.tables,
      queue: snap.queue,
      waiters: snap.waiters,
      ingredients: snap.ingredients,
      reservations: snap.reservations,
      menuDishes: snap.menuDishes,
    });

    const systemPrompt = `You are the Grounded AI ${
      portal === 'customer' ? 'Concierge' : "Maître D'"
    } for Khana-Khazana ("Where Culinary Heritage Meets Autonomous Intelligence").
INSTRUCTIONS:
1. If the user greets you or asks who you are / what you can help with (e.g. "hi", "hello", "who are you"), warmly introduce yourself as the Khana-Khazana AI ${
      portal === 'customer' ? 'Concierge' : "Maître D'"
    } powered by Groq (openai/gpt-oss-120b), mention our operating hours (11:30 AM – 11:30 PM), dining zones (Window, Main Hall, VIP Lounge), and invite questions about live tables, wheelchair accessibility (T3+T4), allergens, or live kitchen stock. Set "refusalTriggered": false.
2. Answer restaurant questions concisely (2-3 clear sentences) and politely using ONLY the injected Restaurant Knowledge Base and Live Floor & Kitchen State below. Cite exact table IDs (T1-T10), dish prices/allergens, or live gram/unit ingredient stock counts whenever relevant.
3. If asked about ANYTHING outside Khana-Khazana or unverified in the context below (e.g., rooftop pool, spa, hotel rooms, weather, stock market, general trivia), reply strictly verbatim with:
"${HALLUCINATION_REFUSAL_TEXT}" and set "refusalTriggered": true.
4. Always respond with a valid JSON object: {"reply": string, "sources": string[], "refusalTriggered": boolean} where "sources" uses ["[restaurant_policies.md]", "[live_floor_db]"].

${ragContext}`;

    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 12000);

      const groqResp = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqApiKey}`,
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
          }),
          signal: controller.signal,
        },
      ).finally(() => clearTimeout(timeoutHandle));

      if (!groqResp.ok) {
        const errText = await groqResp.text().catch(() => '');
        return {
          ok: false,
          status: 502,
          error: `Groq API returned HTTP ${groqResp.status}${
            errText ? `: ${errText.slice(0, 140)}` : ''
          }`,
        };
      }

      const completion = (await groqResp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = completion.choices?.[0]?.message?.content?.trim() ?? '';
      const parsed = parseGroqJsonContent(rawContent);

      if (parsed?.reply && typeof parsed.reply === 'string') {
        const isRefusal =
          Boolean(parsed.refusalTriggered) ||
          parsed.reply.trim() === HALLUCINATION_REFUSAL_TEXT;
        return {
          ok: true,
          reply: isRefusal ? HALLUCINATION_REFUSAL_TEXT : parsed.reply.trim(),
          sources:
            Array.isArray(parsed.sources) && parsed.sources.length > 0
              ? parsed.sources
              : ['[restaurant_policies.md]', '[live_floor_db]'],
          refusalTriggered: isRefusal,
          grounded: true,
          latencyMs: Math.max(1, Math.round(performance.now() - t0)),
          model: 'openai/gpt-oss-120b',
          provider: 'groq',
        };
      }

      if (rawContent) {
        const isRefusal = rawContent === HALLUCINATION_REFUSAL_TEXT;
        return {
          ok: true,
          reply: rawContent,
          sources: ['[restaurant_policies.md]', '[live_floor_db]'],
          refusalTriggered: isRefusal,
          grounded: true,
          latencyMs: Math.max(1, Math.round(performance.now() - t0)),
          model: 'openai/gpt-oss-120b',
          provider: 'groq',
        };
      }

      return {
        ok: false,
        status: 502,
        error: 'Groq API returned an empty response.',
      };
    } catch (err) {
      return {
        ok: false,
        status: 502,
        error: err instanceof Error ? err.message : 'Groq API request failed.',
      };
    }
  }

  app.post('/api/groq/chat', async (req, res) => {
    const body = (req.body ?? {}) as MaitreDRequestBody;
    if (typeof body.message !== 'string' || !body.message.trim()) {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }
    const result = await handleGroundedAssistantRequest(body);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  app.post('/api/maitre-d', async (req, res) => {
    const body = (req.body ?? {}) as MaitreDRequestBody;
    if (typeof body.message !== 'string' || !body.message.trim()) {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }
    const result = await handleGroundedAssistantRequest(body);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  return app;
}
