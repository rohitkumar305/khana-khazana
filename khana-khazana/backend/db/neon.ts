import { Pool, type PoolClient } from 'pg';
import { SCHEMA_SQL } from './schemaSql';
import {
  INITIAL_INGREDIENTS,
  INITIAL_TABLES,
  INITIAL_WAITERS,
  MENU_DISHES,
} from '../engine/data';
import type {
  AgentEvent,
  CourseStage,
  IngredientItem,
  KitchenOrder,
  MenuDish,
  OrderStatus,
  ReservationRecord,
  RestaurantTable,
  TableStatus,
  WaiterAgent,
  WaitingParty,
  XaiAuditLog,
} from '../engine/types';

export class InsufficientStockError extends Error {
  ingredientId: string;
  constructor(ingredientId: string) {
    super(`Insufficient stock for ingredient ${ingredientId}`);
    this.name = 'InsufficientStockError';
    this.ingredientId = ingredientId;
  }
}

let pool: Pool | null = null;
let schemaReadyPromise: Promise<boolean> | null = null;

export function getDbPool(): Pool | null {
  const connStr = process.env.DATABASE_URL?.trim();
  if (!connStr) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: connStr,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }
  return pool;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const db = getDbPool();
  if (!db) {
    throw new Error('DATABASE_URL is not configured');
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function syncCatalogData(client: PoolClient): Promise<void> {
  for (const ing of INITIAL_INGREDIENTS) {
    await client.query(
      `INSERT INTO ingredients (
        id, name, unit, stock, par_level, per_order_highlight
      ) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO NOTHING`,
      [
        ing.id,
        ing.name,
        ing.unit,
        ing.stock,
        ing.parLevel,
        ing.perOrderHighlight,
      ],
    );
  }

  const dishIds = MENU_DISHES.map((d) => d.id);
  if (dishIds.length > 0) {
    await client.query(`DELETE FROM menu_dishes WHERE NOT (id = ANY($1::text[]))`, [
      dishIds,
    ]);
  }

  for (const dish of MENU_DISHES) {
    await client.query(
      `INSERT INTO menu_dishes (
        id, name, category, description, price, prep_mins,
        dietary_tags, is_veg, image, recipe, substitute_dish_ids
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        prep_mins = EXCLUDED.prep_mins,
        dietary_tags = EXCLUDED.dietary_tags,
        is_veg = EXCLUDED.is_veg,
        image = EXCLUDED.image,
        recipe = EXCLUDED.recipe,
        substitute_dish_ids = EXCLUDED.substitute_dish_ids`,
      [
        dish.id,
        dish.name,
        dish.category,
        dish.description,
        dish.price,
        dish.prepMins,
        JSON.stringify(dish.dietaryTags),
        dish.isVeg,
        dish.image,
        JSON.stringify(dish.recipe),
        JSON.stringify(dish.substituteDishIds),
      ],
    );
  }
}

async function seedInitialData(client: PoolClient): Promise<void> {
  for (const t of INITIAL_TABLES) {
    await client.query(
      `INSERT INTO restaurant_tables (
        id, label, capacity, zone, is_accessible, is_vip_booth, combinable_with,
        status, current_course, elapsed_mins, assigned_party_id, assigned_party_name,
        assigned_party_size, active_booking_id, grid_col, grid_row
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (id) DO NOTHING`,
      [
        t.id,
        t.label,
        t.capacity,
        t.zone,
        t.isAccessible,
        t.isVipBooth,
        t.combinableWith,
        t.status,
        t.currentCourse,
        t.elapsedMins,
        t.assignedPartyId,
        t.assignedPartyName,
        t.assignedPartySize,
        t.activeBookingId ?? null,
        t.gridCol,
        t.gridRow,
      ],
    );
  }

  await syncCatalogData(client);

  for (const w of INITIAL_WAITERS) {
    await client.query(
      `INSERT INTO waiter_agents (
        id, name, role, zone, current_action, target_table_id,
        energy_pct, utility_score, utility_breakdown, tasks_completed
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
      ON CONFLICT (id) DO NOTHING`,
      [
        w.id,
        w.name,
        w.role,
        w.zone,
        w.currentAction,
        w.targetTableId,
        w.energyPct,
        w.utilityScore,
        JSON.stringify(w.utilityBreakdown),
        w.tasksCompleted,
      ],
    );
  }
}

export async function ensureSchemaAndSeed(): Promise<boolean> {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    const db = getDbPool();
    if (!db) return false;

    try {
      await withTransaction(async (client) => {
        await client.query(SCHEMA_SQL);
        const { rows } = await client.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM restaurant_tables',
        );
        const count = Number(rows[0]?.count ?? '0');
        if (count === 0) {
          await seedInitialData(client);
        } else {
          await syncCatalogData(client);
        }
      });
      return true;
    } catch (err) {
      console.error('NeonDB initialization failed:', err);
      schemaReadyPromise = null;
      return false;
    }
  })();

  return schemaReadyPromise;
}

export async function checkDbHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  error?: string;
}> {
  const db = getDbPool();
  if (!db) {
    return { connected: false, latencyMs: 0, error: 'DATABASE_URL not set' };
  }
  const t0 = performance.now();
  try {
    await db.query('SELECT 1');
    return {
      connected: true,
      latencyMs: Math.max(1, Math.round(performance.now() - t0)),
    };
  } catch (err) {
    return {
      connected: false,
      latencyMs: 0,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

function mapTableRow(row: Record<string, unknown>): RestaurantTable {
  return {
    id: String(row.id),
    label: String(row.label),
    capacity: Number(row.capacity),
    zone: row.zone as RestaurantTable['zone'],
    isAccessible: Boolean(row.is_accessible),
    isVipBooth: Boolean(row.is_vip_booth),
    combinableWith: row.combinable_with ? String(row.combinable_with) : null,
    status: row.status as TableStatus,
    currentCourse: row.current_course as CourseStage,
    elapsedMins: Number(row.elapsed_mins),
    assignedPartyId: row.assigned_party_id ? String(row.assigned_party_id) : null,
    assignedPartyName: row.assigned_party_name
      ? String(row.assigned_party_name)
      : null,
    assignedPartySize:
      row.assigned_party_size !== null && row.assigned_party_size !== undefined
        ? Number(row.assigned_party_size)
        : null,
    activeBookingId: row.active_booking_id ? String(row.active_booking_id) : null,
    gridCol: Number(row.grid_col),
    gridRow: Number(row.grid_row),
  };
}

function mapQueueRow(row: Record<string, unknown>): WaitingParty {
  return {
    id: String(row.id),
    name: String(row.name),
    size: Number(row.size),
    isVip: Boolean(row.is_vip),
    needsWheelchair: Boolean(row.needs_wheelchair),
    preferredZone: row.preferred_zone as WaitingParty['preferredZone'],
    dietaryNotes: row.dietary_notes ? String(row.dietary_notes) : '',
    waitMins: Number(row.wait_mins),
    status: row.status as WaitingParty['status'],
    bookingId: row.booking_id ? String(row.booking_id) : undefined,
  };
}

function mapReservationRow(row: Record<string, unknown>): ReservationRecord {
  return {
    bookingId: String(row.booking_id),
    guestName: String(row.guest_name),
    email: String(row.email),
    phone: String(row.phone),
    dateTime: String(row.date_time),
    partySize: Number(row.party_size),
    preferredZone: row.preferred_zone as ReservationRecord['preferredZone'],
    needsWheelchair: Boolean(row.needs_wheelchair),
    isVip: Boolean(row.is_vip),
    specialRequests: String(row.special_requests ?? ''),
    status: row.status as ReservationRecord['status'],
    assignedTableIds: Array.isArray(row.assigned_table_ids)
      ? (row.assigned_table_ids as string[])
      : [],
    qrPassCode: String(row.qr_pass_code),
    triggeredRules: Array.isArray(row.triggered_rules)
      ? (row.triggered_rules as string[])
      : [],
    bayesianConfidencePct: Number(row.bayesian_confidence_pct),
    fScore: Number(row.f_score),
    createdAt: String(row.created_at),
  };
}

function mapIngredientRow(row: Record<string, unknown>): IngredientItem {
  return {
    id: String(row.id),
    name: String(row.name),
    unit: row.unit as IngredientItem['unit'],
    stock: Number(row.stock),
    parLevel: Number(row.par_level),
    perOrderHighlight: String(row.per_order_highlight),
  };
}

function mapDishRow(row: Record<string, unknown>): MenuDish {
  return {
    id: String(row.id),
    name: String(row.name),
    category: row.category as MenuDish['category'],
    description: String(row.description),
    price: Number(row.price),
    prepMins: Number(row.prep_mins),
    dietaryTags: Array.isArray(row.dietary_tags)
      ? (row.dietary_tags as string[])
      : [],
    isVeg: Boolean(row.is_veg),
    image: String(row.image),
    recipe: Array.isArray(row.recipe)
      ? (row.recipe as MenuDish['recipe'])
      : [],
    substituteDishIds: Array.isArray(row.substitute_dish_ids)
      ? (row.substitute_dish_ids as string[])
      : [],
  };
}

function mapOrderRow(row: Record<string, unknown>): KitchenOrder {
  return {
    orderId: String(row.order_id),
    tableId: String(row.table_id),
    bookingId: row.booking_id ? String(row.booking_id) : null,
    items: Array.isArray(row.items)
      ? (row.items as KitchenOrder['items'])
      : [],
    totalAmount: Number(row.total_amount),
    prepTimeMins: Number(row.prep_time_mins),
    status: row.status as OrderStatus,
    dispatchedAgentId: String(row.dispatched_agent_id),
    createdAt: String(row.created_at),
  };
}

function mapWaiterRow(row: Record<string, unknown>): WaiterAgent {
  return {
    id: String(row.id),
    name: String(row.name),
    role: row.role as WaiterAgent['role'],
    zone: row.zone as WaiterAgent['zone'],
    currentAction: row.current_action as WaiterAgent['currentAction'],
    targetTableId: row.target_table_id ? String(row.target_table_id) : null,
    energyPct: Number(row.energy_pct),
    utilityScore: Number(row.utility_score),
    utilityBreakdown:
      (row.utility_breakdown as WaiterAgent['utilityBreakdown']) ?? {
        urgency: 0,
        vipBonus: 0,
        distancePenalty: 0,
        loadPenalty: 0,
        totalUtility: 0,
      },
    tasksCompleted: Number(row.tasks_completed),
  };
}

function mapEventRow(row: Record<string, unknown>): AgentEvent {
  return {
    id: String(row.id),
    tick: Number(row.tick),
    timestamp: String(row.timestamp),
    agentId: String(row.agent_id),
    agentName: String(row.agent_name),
    agentType: row.agent_type as AgentEvent['agentType'],
    utilityScore:
      row.utility_score !== null && row.utility_score !== undefined
        ? Number(row.utility_score)
        : null,
    targetTableId: row.target_table_id ? String(row.target_table_id) : null,
    message: String(row.message),
  };
}

function mapXaiRow(row: Record<string, unknown>): XaiAuditLog {
  return {
    id: String(row.id),
    timestamp: String(row.timestamp),
    partyName: String(row.party_name),
    partySize: Number(row.party_size),
    assignedTables: Array.isArray(row.assigned_tables)
      ? (row.assigned_tables as string[])
      : [],
    algorithm: String(row.algorithm),
    fScore: Number(row.f_score),
    bayesianProb: Number(row.bayesian_prob),
    rulesApplied: Array.isArray(row.rules_applied)
      ? (row.rules_applied as string[])
      : [],
    justification: String(row.justification),
  };
}

export interface NeonFloorSnapshot {
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

export async function fetchFullFloorSnapshot(): Promise<NeonFloorSnapshot | null> {
  const ready = await ensureSchemaAndSeed();
  const db = getDbPool();
  if (!ready || !db) return null;

  const t0 = performance.now();
  const [
    tablesRes,
    queueRes,
    resRes,
    ingRes,
    dishRes,
    ordRes,
    waiterRes,
    evtRes,
    xaiRes,
  ] = await Promise.all([
    db.query(
      `SELECT * FROM restaurant_tables ORDER BY COALESCE(NULLIF(regexp_replace(id, '[^0-9]', '', 'g'), ''), '0')::int ASC`,
    ),
    db.query(`SELECT * FROM waiting_queue ORDER BY created_ts DESC`),
    db.query(`SELECT * FROM reservations ORDER BY created_ts DESC`),
    db.query(`SELECT * FROM ingredients ORDER BY id ASC`),
    db.query(`SELECT * FROM menu_dishes ORDER BY id ASC`),
    db.query(`SELECT * FROM kitchen_orders ORDER BY created_ts DESC`),
    db.query(`SELECT * FROM waiter_agents ORDER BY id ASC`),
    db.query(`SELECT * FROM agent_events ORDER BY created_ts DESC LIMIT 32`),
    db.query(`SELECT * FROM xai_audit_logs ORDER BY created_ts DESC LIMIT 32`),
  ]);

  return {
    dbConnected: true,
    dbLatencyMs: Math.max(1, Math.round(performance.now() - t0)),
    tables: tablesRes.rows.map(mapTableRow),
    queue: queueRes.rows.map(mapQueueRow),
    reservations: resRes.rows.map(mapReservationRow),
    ingredients: ingRes.rows.map(mapIngredientRow),
    menuDishes: dishRes.rows.map(mapDishRow),
    orders: ordRes.rows.map(mapOrderRow),
    waiters: waiterRes.rows.map(mapWaiterRow),
    events: evtRes.rows.map(mapEventRow),
    xaiLogs: xaiRes.rows.map(mapXaiRow),
  };
}

export async function persistBookingTransaction(params: {
  reservation: ReservationRecord;
  party: WaitingParty;
  xaiLog: XaiAuditLog;
  agentEvent: AgentEvent;
}): Promise<void> {
  await withTransaction(async (client) => {
    const { reservation: r, party: p, xaiLog: x, agentEvent: e } = params;

    await client.query(
      `INSERT INTO reservations (
        booking_id, guest_name, email, phone, date_time, party_size,
        preferred_zone, needs_wheelchair, is_vip, special_requests, status,
        assigned_table_ids, qr_pass_code, triggered_rules,
        bayesian_confidence_pct, f_score, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14::jsonb,$15,$16,$17)`,
      [
        r.bookingId,
        r.guestName,
        r.email,
        r.phone,
        r.dateTime,
        r.partySize,
        r.preferredZone,
        r.needsWheelchair,
        r.isVip,
        r.specialRequests,
        r.status,
        JSON.stringify(r.assignedTableIds),
        r.qrPassCode,
        JSON.stringify(r.triggeredRules),
        r.bayesianConfidencePct,
        r.fScore,
        r.createdAt,
      ],
    );

    await client.query(
      `INSERT INTO waiting_queue (
        id, name, size, is_vip, needs_wheelchair, preferred_zone,
        dietary_notes, wait_mins, status, booking_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [
        p.id,
        p.name,
        p.size,
        p.isVip,
        p.needsWheelchair,
        p.preferredZone,
        p.dietaryNotes ?? '',
        p.waitMins,
        p.status,
        p.bookingId ?? null,
      ],
    );

    await client.query(
      `INSERT INTO xai_audit_logs (
        id, timestamp, party_name, party_size, assigned_tables,
        algorithm, f_score, bayesian_prob, rules_applied, justification
      ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::jsonb,$10)`,
      [
        x.id,
        x.timestamp,
        x.partyName,
        x.partySize,
        JSON.stringify(x.assignedTables),
        x.algorithm,
        x.fScore,
        x.bayesianProb,
        JSON.stringify(x.rulesApplied),
        x.justification,
      ],
    );

    await client.query(
      `INSERT INTO agent_events (
        id, tick, timestamp, agent_id, agent_name, agent_type,
        utility_score, target_table_id, message
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        e.id,
        e.tick,
        e.timestamp,
        e.agentId,
        e.agentName,
        e.agentType,
        e.utilityScore,
        e.targetTableId,
        e.message,
      ],
    );
  });
}

export async function persistGuestArrivalTransaction(params: {
  assignedTableIds: string[];
  party: WaitingParty;
  bookingId: string | null;
  xaiLog: XaiAuditLog;
  agentEvent: AgentEvent;
}): Promise<void> {
  await withTransaction(async (client) => {
    const { assignedTableIds, party, bookingId, xaiLog, agentEvent } = params;

    if (assignedTableIds.length > 0) {
      await client.query(
        `UPDATE restaurant_tables
         SET status = 'Occupied',
             current_course = 'Appetizer',
             elapsed_mins = 0,
             assigned_party_id = $1,
             assigned_party_name = $2,
             assigned_party_size = $3,
             active_booking_id = $4,
             updated_at = NOW()
         WHERE id = ANY($5::text[])`,
        [
          party.id,
          party.name,
          party.size,
          bookingId ?? 'WALKIN',
          assignedTableIds,
        ],
      );
    }

    await client.query(
      `UPDATE waiting_queue
       SET status = 'SEATED'
       WHERE id = $1 OR ($2::text IS NOT NULL AND booking_id = $2)`,
      [party.id, bookingId],
    );

    if (bookingId) {
      await client.query(
        `UPDATE reservations
         SET status = 'SEATED',
             assigned_table_ids = $2::jsonb
         WHERE booking_id = $1`,
        [bookingId, JSON.stringify(assignedTableIds)],
      );
    }

    await client.query(
      `INSERT INTO xai_audit_logs (
        id, timestamp, party_name, party_size, assigned_tables,
        algorithm, f_score, bayesian_prob, rules_applied, justification
      ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::jsonb,$10)`,
      [
        xaiLog.id,
        xaiLog.timestamp,
        xaiLog.partyName,
        xaiLog.partySize,
        JSON.stringify(xaiLog.assignedTables),
        xaiLog.algorithm,
        xaiLog.fScore,
        xaiLog.bayesianProb,
        JSON.stringify(xaiLog.rulesApplied),
        xaiLog.justification,
      ],
    );

    await client.query(
      `INSERT INTO agent_events (
        id, tick, timestamp, agent_id, agent_name, agent_type,
        utility_score, target_table_id, message
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        agentEvent.id,
        agentEvent.tick,
        agentEvent.timestamp,
        agentEvent.agentId,
        agentEvent.agentName,
        agentEvent.agentType,
        agentEvent.utilityScore,
        agentEvent.targetTableId,
        agentEvent.message,
      ],
    );
  });
}

export async function persistOrderAndInventoryTransaction(params: {
  order: KitchenOrder;
  deductions: Array<{ ingredientId: string; amount: number }>;
  waiterId: string;
  agentEvent: AgentEvent;
}): Promise<IngredientItem[]> {
  return withTransaction(async (client) => {
    for (const d of params.deductions) {
      if (d.amount <= 0) continue;
      const upd = await client.query(
        `UPDATE ingredients
         SET stock = stock - $2, updated_at = NOW()
         WHERE id = $1 AND stock >= $2
         RETURNING *`,
        [d.ingredientId, d.amount],
      );
      if (upd.rowCount === 0) {
        throw new InsufficientStockError(d.ingredientId);
      }
    }

    const o = params.order;
    await client.query(
      `INSERT INTO kitchen_orders (
        order_id, table_id, booking_id, items, total_amount,
        prep_time_mins, status, dispatched_agent_id, created_at
      ) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)`,
      [
        o.orderId,
        o.tableId,
        o.bookingId,
        JSON.stringify(o.items),
        o.totalAmount,
        o.prepTimeMins,
        o.status,
        o.dispatchedAgentId,
        o.createdAt,
      ],
    );

    await client.query(
      `UPDATE waiter_agents
       SET current_action = 'ServeOrder',
           target_table_id = $2,
           tasks_completed = tasks_completed + 1
       WHERE id = $1`,
      [params.waiterId, o.tableId],
    );

    const e = params.agentEvent;
    await client.query(
      `INSERT INTO agent_events (
        id, tick, timestamp, agent_id, agent_name, agent_type,
        utility_score, target_table_id, message
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        e.id,
        e.tick,
        e.timestamp,
        e.agentId,
        e.agentName,
        e.agentType,
        e.utilityScore,
        e.targetTableId,
        e.message,
      ],
    );

    const { rows } = await client.query(
      `SELECT * FROM ingredients ORDER BY id ASC`,
    );
    return rows.map(mapIngredientRow);
  });
}

export async function persistTableStateUpdate(params: {
  tableId: string;
  status: TableStatus;
  currentCourse: CourseStage;
  elapsedMins: number;
  clearParty: boolean;
}): Promise<RestaurantTable | null> {
  const db = getDbPool();
  if (!db) return null;

  return withTransaction(async (client) => {
    const prevRes = await client.query<{ active_booking_id: string | null }>(
      `SELECT active_booking_id FROM restaurant_tables WHERE id = $1`,
      [params.tableId],
    );
    const prevBookingId = prevRes.rows[0]?.active_booking_id ?? null;

    const { rows } = await client.query(
      `UPDATE restaurant_tables
       SET status = $2,
           current_course = $3,
           elapsed_mins = $4,
           assigned_party_id = CASE WHEN $5 THEN NULL ELSE assigned_party_id END,
           assigned_party_name = CASE WHEN $5 THEN NULL ELSE assigned_party_name END,
           assigned_party_size = CASE WHEN $5 THEN NULL ELSE assigned_party_size END,
           active_booking_id = CASE WHEN $5 THEN NULL ELSE active_booking_id END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        params.tableId,
        params.status,
        params.currentCourse,
        params.elapsedMins,
        params.clearParty,
      ],
    );

    if (params.clearParty && prevBookingId && prevBookingId !== 'WALKIN') {
      await client.query(
        `UPDATE reservations
         SET status = 'COMPLETED'
         WHERE booking_id = $1 AND status = 'SEATED'`,
        [prevBookingId],
      );
    }

    return rows[0] ? mapTableRow(rows[0]) : null;
  });
}

export async function persistIngredientStockUpdate(
  ingredientId: string,
  stock: number,
): Promise<IngredientItem | null> {
  const db = getDbPool();
  if (!db) return null;
  const { rows } = await db.query(
    `UPDATE ingredients SET stock = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [ingredientId, Math.max(0, Math.round(stock))],
  );
  return rows[0] ? mapIngredientRow(rows[0]) : null;
}

export async function persistOrderStatusAdvance(
  orderId: string,
  nextStatus: OrderStatus,
): Promise<KitchenOrder | null> {
  const db = getDbPool();
  if (!db) return null;
  const { rows } = await db.query(
    `UPDATE kitchen_orders SET status = $2 WHERE order_id = $1 RETURNING *`,
    [orderId, nextStatus],
  );
  return rows[0] ? mapOrderRow(rows[0]) : null;
}

export async function persistSimulationStep(params: {
  tables: RestaurantTable[];
  queue: WaitingParty[];
  waiters: WaiterAgent[];
  newEvents: AgentEvent[];
}): Promise<void> {
  await withTransaction(async (client) => {
    for (const t of params.tables) {
      const prevRes = await client.query<{ active_booking_id: string | null }>(
        `SELECT active_booking_id FROM restaurant_tables WHERE id = $1`,
        [t.id],
      );
      const prevBookingId = prevRes.rows[0]?.active_booking_id ?? null;

      await client.query(
        `UPDATE restaurant_tables
         SET status = $2,
             current_course = $3,
             elapsed_mins = $4,
             assigned_party_id = $5,
             assigned_party_name = $6,
             assigned_party_size = $7,
             active_booking_id = $8,
             updated_at = NOW()
         WHERE id = $1`,
        [
          t.id,
          t.status,
          t.currentCourse,
          t.elapsedMins,
          t.assignedPartyId,
          t.assignedPartyName,
          t.assignedPartySize,
          t.activeBookingId ?? null,
        ],
      );

      if (
        (t.status === 'Free' || t.status === 'Dirty') &&
        prevBookingId &&
        prevBookingId !== 'WALKIN'
      ) {
        await client.query(
          `UPDATE reservations
           SET status = 'COMPLETED'
           WHERE booking_id = $1 AND status = 'SEATED'`,
          [prevBookingId],
        );
      }
    }

    for (const p of params.queue) {
      await client.query(
        `UPDATE waiting_queue SET wait_mins = $2, status = $3 WHERE id = $1`,
        [p.id, p.waitMins, p.status],
      );
    }

    for (const w of params.waiters) {
      await client.query(
        `UPDATE waiter_agents
         SET current_action = $2,
             target_table_id = $3,
             energy_pct = $4,
             utility_score = $5,
             utility_breakdown = $6::jsonb,
             tasks_completed = $7
         WHERE id = $1`,
        [
          w.id,
          w.currentAction,
          w.targetTableId,
          w.energyPct,
          w.utilityScore,
          JSON.stringify(w.utilityBreakdown),
          w.tasksCompleted,
        ],
      );
    }

    await client.query(
      `UPDATE kitchen_orders
       SET status = CASE
         WHEN status = 'Order Received' THEN 'Preparing'
         WHEN status = 'Preparing' THEN 'Waiter En Route'
         WHEN status = 'Waiter En Route' THEN 'Served'
         ELSE status
       END`,
    );

    for (const e of params.newEvents) {
      await client.query(
        `INSERT INTO agent_events (
          id, tick, timestamp, agent_id, agent_name, agent_type,
          utility_score, target_table_id, message
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO NOTHING`,
        [
          e.id,
          e.tick,
          e.timestamp,
          e.agentId,
          e.agentName,
          e.agentType,
          e.utilityScore,
          e.targetTableId,
          e.message,
        ],
      );
    }
  });
}

export async function cancelReservationInDb(
  bookingId: string,
): Promise<{ ok: boolean; reservation?: ReservationRecord }> {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE reservations
       SET status = 'CANCELLED'
       WHERE booking_id = $1 AND status <> 'CANCELLED'
       RETURNING *`,
      [bookingId],
    );
    if (rows.length === 0) {
      return { ok: false };
    }
    await client.query(
      `DELETE FROM waiting_queue WHERE booking_id = $1 AND status = 'WAITING'`,
      [bookingId],
    );
    await client.query(
      `UPDATE restaurant_tables
       SET status = 'Free',
           current_course = 'None',
           elapsed_mins = 0,
           assigned_party_id = NULL,
           assigned_party_name = NULL,
           assigned_party_size = NULL,
           active_booking_id = NULL,
           updated_at = NOW()
       WHERE active_booking_id = $1`,
      [bookingId],
    );
    return { ok: true, reservation: mapReservationRow(rows[0]) };
  });
}

export async function resetNeonFloorToSeed(): Promise<NeonFloorSnapshot | null> {
  const ready = await ensureSchemaAndSeed();
  if (!ready) return null;

  await withTransaction(async (client) => {
    await client.query('DELETE FROM kitchen_orders');
    await client.query('DELETE FROM xai_audit_logs');
    await client.query('DELETE FROM agent_events');
    await client.query('DELETE FROM reservations');
    await client.query('DELETE FROM waiting_queue');
    await client.query('DELETE FROM waiter_agents');
    await client.query('DELETE FROM ingredients');
    await client.query('DELETE FROM menu_dishes');
    await client.query('DELETE FROM restaurant_tables');
    await seedInitialData(client);
  });

  return fetchFullFloorSnapshot();
}
