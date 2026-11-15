import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  INITIAL_AGENT_EVENTS,
  INITIAL_INGREDIENTS,
  INITIAL_ORDERS,
  INITIAL_QUEUE,
  INITIAL_RESERVATIONS,
  INITIAL_TABLES,
  INITIAL_WAITERS,
  INITIAL_XAI_LOGS,
  MENU_DISHES,
} from '../../../backend/engine/data';
import {
  compareTurnoverModels,
  computeFairnessAudit,
  computeFloorEfficiency,
  runSearchBenchmarks,
} from '../../../backend/engine/aiEngine';
import {
  advanceOrderStatusApi,
  cancelReservationApi,
  checkInGuestViaApi,
  fetchFloorStateFromApi,
  resetFloorApi,
  stepSimulationTickApi,
  updateIngredientStockApi,
  updateTableStateApi,
  validateAndCreateBooking,
  validateOrderIngredients,
  type HydratedFloorPayload,
} from '../api/backendService';
import type {
  AgentEvent,
  AlgorithmBenchmark,
  AllocationResult,
  AStarWeights,
  BookingValidationRequest,
  BookingValidationResponse,
  CartOrderItem,
  CourseStage,
  FairnessAudit,
  IngredientItem,
  KitchenOrder,
  MenuDish,
  OrderIngredientValidationResponse,
  OrderStatus,
  PortalMode,
  ReservationRecord,
  RestaurantTable,
  TableStatus,
  TurnoverPrediction,
  WaiterAgent,
  WaitingParty,
  XaiAuditLog,
} from '../../../backend/engine/types';

export type AppPath = string;

function normalizePath(pathname: string): string {
  const cleaned = pathname.replace(/\/+$/, '') || '/';
  // Map legacy aliases cleanly
  if (cleaned === '/reserve') return '/book';
  if (cleaned === '/dashboard') return '/admin/dashboard';
  if (cleaned === '/algorithms') return '/admin/algorithms';
  if (cleaned === '/agents') return '/admin/agents';
  if (cleaned === '/assistant') return '/admin/assistant';
  if (cleaned === '/scenarios') return '/admin/scenarios';
  return cleaned;
}

export function extractTableIdFromPath(path: string): string | null {
  const match = /^\/table\/([^/]+)\/menu$/i.exec(path);
  return match ? match[1].toUpperCase() : null;
}

interface RestaurantContextValue {
  currentPath: string;
  portalMode: PortalMode;
  setPortalMode: (mode: PortalMode) => void;
  navigate: (path: string) => void;
  tables: RestaurantTable[];
  queue: WaitingParty[];
  reservations: ReservationRecord[];
  ingredients: IngredientItem[];
  menuDishes: MenuDish[];
  orders: KitchenOrder[];
  waiters: WaiterAgent[];
  events: AgentEvent[];
  xaiLogs: XaiAuditLog[];
  weights: AStarWeights;
  setWeights: React.Dispatch<React.SetStateAction<AStarWeights>>;
  benchmarks: AlgorithmBenchmark[];
  runBenchmarksNow: () => AlgorithmBenchmark[];
  turnoverComparison: {
    predictions: TurnoverPrediction[];
    symbolicMae: number;
    mlMae: number;
  };
  fairnessAudit: FairnessAudit;
  floorEfficiency: ReturnType<typeof computeFloorEfficiency>;
  tickCount: number;
  isAutoPlaying: boolean;
  setIsAutoPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  dbConnected: boolean;
  isDbLoading: boolean;
  dbError: string | null;
  lastLatencyMs: number | null;
  refreshFloor: () => Promise<void>;
  stepSimulationTick: () => Promise<void>;
  validateAndSubmitBooking: (
    req: BookingValidationRequest,
  ) => Promise<BookingValidationResponse>;
  cancelReservation: (bookingId: string) => Promise<void>;
  simulateGuestArrival: (
    bookingIdOrPartyId: string,
  ) => Promise<{ allocation: AllocationResult; responseTimeMs: number } | null>;
  placeTableOrder: (
    tableId: string,
    items: CartOrderItem[],
  ) => Promise<OrderIngredientValidationResponse>;
  advanceOrderStatus: (orderId: string) => Promise<void>;
  setIngredientStock: (ingredientId: string, stock: number) => Promise<void>;
  updateTableState: (
    tableId: string,
    nextStatus: TableStatus,
    nextCourse?: CourseStage,
  ) => Promise<void>;
  selectedTableId: string | null;
  setSelectedTableId: React.Dispatch<React.SetStateAction<string | null>>;
  resetFloor: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== 'undefined' ? normalizePath(window.location.pathname) : '/',
  );

  const portalMode: PortalMode = currentPath.startsWith('/admin')
    ? 'admin'
    : 'customer';

  const [tables, setTables] = useState<RestaurantTable[]>(INITIAL_TABLES);
  const [queue, setQueue] = useState<WaitingParty[]>(INITIAL_QUEUE);
  const [reservations, setReservations] =
    useState<ReservationRecord[]>(INITIAL_RESERVATIONS);
  const [ingredients, setIngredients] =
    useState<IngredientItem[]>(INITIAL_INGREDIENTS);
  const [menuDishes, setMenuDishes] = useState<MenuDish[]>(MENU_DISHES);
  const [orders, setOrders] = useState<KitchenOrder[]>(INITIAL_ORDERS);
  const [waiters, setWaiters] = useState<WaiterAgent[]>(INITIAL_WAITERS);
  const [events, setEvents] = useState<AgentEvent[]>(INITIAL_AGENT_EVENTS);
  const [xaiLogs, setXaiLogs] = useState<XaiAuditLog[]>(INITIAL_XAI_LOGS);
  const [weights, setWeights] = useState<AStarWeights>({
    w1Waste: 1.0,
    w2Wait: 1.0,
  });
  const [benchmarks, setBenchmarks] = useState<AlgorithmBenchmark[]>(() =>
    runSearchBenchmarks(INITIAL_TABLES, INITIAL_QUEUE, {
      w1Waste: 1.0,
      w2Wait: 1.0,
    }),
  );
  const [tickCount, setTickCount] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>('T3');

  const simRef = useRef({ tables, queue, waiters, tickCount });
  simRef.current = { tables, queue, waiters, tickCount };

  const applySnapshot = useCallback((snap: HydratedFloorPayload) => {
    setTables(snap.tables);
    setQueue(snap.queue);
    setReservations(snap.reservations);
    setIngredients(snap.ingredients);
    if (Array.isArray(snap.menuDishes) && snap.menuDishes.length > 0) {
      setMenuDishes(snap.menuDishes);
    }
    setOrders(snap.orders);
    setWaiters(snap.waiters);
    setEvents(snap.events);
    setXaiLogs(snap.xaiLogs);
    setDbConnected(snap.dbConnected);
    setLastLatencyMs(snap.dbLatencyMs);
    setDbError(null);
  }, []);

  const refreshFloor = useCallback(async () => {
    try {
      const snap = await fetchFloorStateFromApi();
      applySnapshot(snap);
    } catch (err) {
      setDbConnected(false);
      setDbError(
        err instanceof Error ? err.message : 'NeonDB connection unavailable.',
      );
    } finally {
      setIsDbLoading(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    void refreshFloor();
  }, [refreshFloor]);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(normalizePath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((rawPath: string) => {
    const target = normalizePath(rawPath);
    setCurrentPath(target);
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== target) {
        window.history.pushState({}, '', target);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const setPortalMode = useCallback(
    (mode: PortalMode) => {
      if (mode === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/');
      }
    },
    [navigate],
  );

  const stepSimulationTick = useCallback(async () => {
    const curTick = simRef.current.tickCount;
    try {
      const result = await stepSimulationTickApi(curTick);
      setTables(result.tables);
      setQueue(result.queue);
      setWaiters(result.waiters);
      setTickCount(curTick + 1);
      setDbConnected(true);
      setDbError(null);
      setOrders((prev) =>
        prev.map((o) =>
          o.status === 'Order Received'
            ? { ...o, status: 'Preparing' }
            : o.status === 'Preparing'
            ? { ...o, status: 'Waiter En Route' }
            : o.status === 'Waiter En Route'
            ? { ...o, status: 'Served' }
            : o,
        ),
      );
      if (result.newEvents.length > 0) {
        setEvents((prev) => [...result.newEvents, ...prev].slice(0, 32));
      }
    } catch (err) {
      setIsAutoPlaying(false);
      setDbError(
        err instanceof Error ? err.message : 'Failed to advance simulation tick.',
      );
    }
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const id = window.setInterval(() => {
      void stepSimulationTick();
    }, 1800);
    return () => window.clearInterval(id);
  }, [isAutoPlaying, stepSimulationTick]);

  const runBenchmarksNow = useCallback(() => {
    const fresh = runSearchBenchmarks(tables, queue, weights);
    setBenchmarks(fresh);
    return fresh;
  }, [tables, queue, weights]);

  // Workflow A: Smart Booking Validation + Pass Persistence in NeonDB
  const validateAndSubmitBooking = useCallback(
    async (
      req: BookingValidationRequest,
    ): Promise<BookingValidationResponse> => {
      const resp = await validateAndCreateBooking(req, tables, reservations);
      setLastLatencyMs(resp.responseTimeMs);
      setDbConnected(true);
      setDbError(null);

      if (resp.fulfillable && resp.reservation) {
        await refreshFloor();
      }

      return resp;
    },
    [tables, reservations, refreshFloor],
  );

  const cancelReservation = useCallback(
    async (bookingId: string) => {
      const t0 = performance.now();
      await cancelReservationApi(bookingId);
      setLastLatencyMs(Math.max(1, Math.round(performance.now() - t0)));
      await refreshFloor();
    },
    [refreshFloor],
  );

  // Workflow B: Guest Arrival Check-In + A* Search Assignment + QR Activation
  const simulateGuestArrival = useCallback(
    async (
      bookingIdOrPartyId: string,
    ): Promise<{ allocation: AllocationResult; responseTimeMs: number } | null> => {
      const apiCheckIn = await checkInGuestViaApi(bookingIdOrPartyId, weights);
      setDbConnected(Boolean(apiCheckIn.persistedToDb));
      setLastLatencyMs(apiCheckIn.responseTimeMs);
      setDbError(null);

      if (apiCheckIn.allocation.success) {
        setSelectedTableId(apiCheckIn.allocation.assignedTableIds[0] ?? null);
      }

      await refreshFloor();

      return {
        allocation: apiCheckIn.allocation,
        responseTimeMs: apiCheckIn.responseTimeMs,
      };
    },
    [weights, refreshFloor],
  );

  // Workflow B: Atomic Recipe-to-Ingredient Check + Kitchen Order Dispatch
  const placeTableOrder = useCallback(
    async (
      tableId: string,
      items: CartOrderItem[],
    ): Promise<OrderIngredientValidationResponse> => {
      const tbl = tables.find((t) => t.id === tableId);
      const resp = await validateOrderIngredients(
        {
          tableId,
          bookingId: tbl?.activeBookingId ?? null,
          items,
        },
        menuDishes,
        ingredients,
      );
      setLastLatencyMs(resp.responseTimeMs);
      setDbConnected(true);
      setDbError(null);

      if (resp.ok && resp.order && resp.updatedIngredients) {
        await refreshFloor();
      } else if (resp.updatedIngredients) {
        setIngredients(resp.updatedIngredients);
      }

      return resp;
    },
    [tables, menuDishes, ingredients, refreshFloor],
  );

  const advanceOrderStatus = useCallback(async (orderId: string) => {
    const updated = await advanceOrderStatusApi(orderId);
    setOrders((prev) =>
      prev.map((o) => (o.orderId === orderId ? updated : o)),
    );
  }, []);

  const setIngredientStock = useCallback(
    async (ingredientId: string, stock: number) => {
      const clamped = Math.max(0, stock);
      const updated = await updateIngredientStockApi(ingredientId, clamped);
      setIngredients((prev) =>
        prev.map((ing) => (ing.id === ingredientId ? updated : ing)),
      );
    },
    [],
  );

  const updateTableState = useCallback(
    async (
      tableId: string,
      nextStatus: TableStatus,
      nextCourse?: CourseStage,
    ) => {
      const clearParty = nextStatus === 'Free' || nextStatus === 'Dirty';
      const updated = await updateTableStateApi(tableId, nextStatus, nextCourse);
      setTables((prev) => prev.map((t) => (t.id === tableId ? updated : t)));
      if (clearParty) {
        await refreshFloor();
      }
    },
    [refreshFloor],
  );

  const resetFloor = useCallback(async () => {
    setIsAutoPlaying(false);
    const snap = await resetFloorApi();
    applySnapshot(snap);
    setTickCount(0);
    setBenchmarks(runSearchBenchmarks(snap.tables, snap.queue, weights));
  }, [applySnapshot, weights]);

  const turnoverComparison = useMemo(
    () => compareTurnoverModels(tables),
    [tables],
  );
  const fairnessAudit = useMemo(() => computeFairnessAudit(queue), [queue]);
  const floorEfficiency = useMemo(
    () => computeFloorEfficiency(tables),
    [tables],
  );

  const value: RestaurantContextValue = {
    currentPath,
    portalMode,
    setPortalMode,
    navigate,
    tables,
    queue,
    reservations,
    ingredients,
    menuDishes,
    orders,
    waiters,
    events,
    xaiLogs,
    weights,
    setWeights,
    benchmarks,
    runBenchmarksNow,
    turnoverComparison,
    fairnessAudit,
    floorEfficiency,
    tickCount,
    isAutoPlaying,
    setIsAutoPlaying,
    dbConnected,
    isDbLoading,
    dbError,
    lastLatencyMs,
    refreshFloor,
    stepSimulationTick,
    validateAndSubmitBooking,
    cancelReservation,
    simulateGuestArrival,
    placeTableOrder,
    advanceOrderStatus,
    setIngredientStock,
    updateTableState,
    selectedTableId,
    setSelectedTableId,
    resetFloor,
  };

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) {
    throw new Error('useRestaurant must be used inside RestaurantProvider');
  }
  return ctx;
}
