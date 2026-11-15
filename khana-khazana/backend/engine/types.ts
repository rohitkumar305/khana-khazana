export type TableStatus = 'Free' | 'Occupied' | 'Paying' | 'Dirty';

export type CourseStage = 'None' | 'Appetizer' | 'Mains' | 'Dessert' | 'Billing';

export type Zone = 'Window' | 'Main Hall' | 'VIP Lounge';

export type ZonePreference = Zone | 'ANY';

export type PortalMode = 'customer' | 'admin';

export interface RestaurantTable {
  id: string;
  label: string;
  capacity: number;
  zone: Zone;
  isAccessible: boolean;
  isVipBooth: boolean;
  combinableWith: string | null;
  status: TableStatus;
  currentCourse: CourseStage;
  elapsedMins: number;
  assignedPartyId: string | null;
  assignedPartyName: string | null;
  assignedPartySize: number | null;
  activeBookingId?: string | null;
  gridCol: number;
  gridRow: number;
}

export interface WaitingParty {
  id: string;
  name: string;
  size: number;
  isVip: boolean;
  needsWheelchair: boolean;
  preferredZone: ZonePreference;
  dietaryNotes?: string;
  waitMins: number;
  status: 'WAITING' | 'SEATED';
  bookingId?: string;
}

export interface AStarWeights {
  w1Waste: number;
  w2Wait: number;
}

export interface AllocationResult {
  success: boolean;
  party: WaitingParty;
  assignedTableIds: string[];
  isMerged: boolean;
  isBayesianPreAllocation: boolean;
  totalCapacity: number;
  wastedSeats: number;
  gScore: number;
  hScore: number;
  fScore: number;
  bayesianProb: number;
  triggeredRules: string[];
  explanation: string;
  complimentaryStarterTriggered: boolean;
}

export type SearchAlgorithmName = 'BFS' | 'DFS' | 'Hill Climbing' | 'A* Search';

export interface AlgorithmBenchmark {
  algorithm: SearchAlgorithmName;
  nodesExpanded: number;
  executionTimeMs: number;
  seatUtilizationPct: number;
  wastedSeats: number;
  optimalWaitMins: number;
  summary: string;
  isOptimal: boolean;
}

export type AgentActionType =
  | 'Greet'
  | 'ServeOrder'
  | 'DeliverBill'
  | 'ClearTable'
  | 'DispatchAStar'
  | 'DispatchKitchen'
  | 'Standby';

export interface UtilityBreakdown {
  urgency: number;
  vipBonus: number;
  distancePenalty: number;
  loadPenalty: number;
  totalUtility: number;
}

export interface WaiterAgent {
  id: string;
  name: string;
  role: 'Waiter (Utility-Based)' | 'Host (Goal-Based)';
  zone: Zone;
  currentAction: AgentActionType;
  targetTableId: string | null;
  energyPct: number;
  utilityScore: number;
  utilityBreakdown: UtilityBreakdown;
  tasksCompleted: number;
}

export interface AgentEvent {
  id: string;
  tick: number;
  timestamp: string;
  agentId: string;
  agentName: string;
  agentType: 'Host (Goal-Based)' | 'Waiter (Utility-Based)';
  utilityScore: number | null;
  targetTableId: string | null;
  message: string;
}

export interface XaiAuditLog {
  id: string;
  timestamp: string;
  partyName: string;
  partySize: number;
  assignedTables: string[];
  algorithm: string;
  fScore: number;
  bayesianProb: number;
  rulesApplied: string[];
  justification: string;
}

export interface TurnoverPrediction {
  tableId: string;
  partySize: number;
  zone: Zone;
  course: CourseStage;
  elapsedMins: number;
  symbolicEstimateMins: number;
  mlEstimateMins: number;
  bayesianFreeIn10Prob: number;
}

export interface CustomDurationInput {
  size: number;
  isWeekend: boolean;
  isPeakHour: boolean;
  orderedDrinks: boolean;
}

export interface CustomDurationPrediction {
  symbolicTotalMins: number;
  mlTotalMins: number;
  deltaMins: number;
  symbolicFormula: string;
  featureContributions: Array<{ feature: string; deltaMins: number }>;
}

export interface FairnessAudit {
  avgVipWaitMins: number;
  avgRegularWaitMins: number;
  deltaFairnessMins: number;
  thresholdMins: number;
  fairnessScorePct: number;
  isFair: boolean;
  statusLabel: string;
}

export interface PolicyChunk {
  id: string;
  section: string;
  sourceFile: string;
  content: string;
  keywords: string[];
}

export interface MaitreDMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: string[];
  refusalTriggered?: boolean;
  latencyMs?: number;
  model?: string;
  provider?: 'groq';
  isError?: boolean;
  timestamp: string;
}

// --- Workflow A: Smart Booking & Email Confirmation ---

export interface BookingValidationRequest {
  guestName: string;
  email: string;
  phone: string;
  dateTime: string;
  partySize: number;
  preferredZone: ZonePreference;
  needsWheelchair: boolean;
  isVip?: boolean;
  specialRequests: string;
  preferredTableIds?: string[];
}

export interface AlternativeSlotSuggestion {
  id: string;
  label: string;
  dateTime: string;
  zone: ZonePreference;
  bayesianConfidencePct: number;
  reason: string;
}

export interface ReservationRecord {
  bookingId: string;
  guestName: string;
  email: string;
  phone: string;
  dateTime: string;
  partySize: number;
  preferredZone: ZonePreference;
  needsWheelchair: boolean;
  isVip: boolean;
  specialRequests: string;
  status: 'CONFIRMED' | 'CHECKED_IN' | 'SEATED' | 'COMPLETED' | 'CANCELLED';
  assignedTableIds: string[];
  qrPassCode: string;
  triggeredRules: string[];
  bayesianConfidencePct: number;
  fScore: number;
  createdAt: string;
}

export interface BookingValidationResponse {
  fulfillable: boolean;
  responseTimeMs: number;
  persistedToDb?: boolean;
  reservation?: ReservationRecord;
  emailPreview?: {
    to: string;
    subject: string;
    bookingId: string;
    qrPassCode: string;
    bodySummary: string;
  };
  apologyTitle?: string;
  apologyMessage?: string;
  alternatives?: AlternativeSlotSuggestion[];
}

// --- Workflow B: Recipe-to-Ingredient Inventory & QR Table Orders ---

export interface IngredientItem {
  id: string;
  name: string;
  unit: 'g' | 'mg' | 'ml' | 'pcs';
  stock: number;
  parLevel: number;
  perOrderHighlight: string;
}

export interface DishRecipeRequirement {
  ingredientId: string;
  amount: number;
}

export interface MenuDish {
  id: string;
  name: string;
  category: 'Signature Starters' | 'Royal Mains' | 'Artisan & Global' | 'Desserts';
  description: string;
  price: number;
  prepMins: number;
  dietaryTags: string[];
  isVeg: boolean;
  image: string;
  recipe: DishRecipeRequirement[];
  substituteDishIds: string[];
}

export interface CartOrderItem {
  dishId: string;
  quantity: number;
}

export type OrderStatus =
  | 'Order Received'
  | 'Preparing'
  | 'Waiter En Route'
  | 'Served';

export interface KitchenOrder {
  orderId: string;
  tableId: string;
  bookingId: string | null;
  items: Array<{ dishId: string; name: string; quantity: number; price: number }>;
  totalAmount: number;
  prepTimeMins: number;
  status: OrderStatus;
  dispatchedAgentId: string;
  createdAt: string;
}

export interface OrderIngredientValidationRequest {
  tableId: string;
  bookingId: string | null;
  items: CartOrderItem[];
}

export interface OutOfStockConflict {
  dishId: string;
  dishName: string;
  ingredientId: string;
  ingredientName: string;
  requiredAmount: number;
  availableStock: number;
  unit: string;
  politeMessage: string;
  suggestedSubstitutes: Array<{
    dishId: string;
    name: string;
    price: number;
    reason: string;
  }>;
}

export interface OrderIngredientValidationResponse {
  ok: boolean;
  responseTimeMs: number;
  persistedToDb?: boolean;
  order?: KitchenOrder;
  updatedIngredients?: IngredientItem[];
  conflicts?: OutOfStockConflict[];
}

export interface ConfirmedBookingReceipt {
  bookingId: string;
  partyName: string;
  partySize: number;
  preferredZone: ZonePreference;
  isVip: boolean;
  needsWheelchair: boolean;
  dietaryNotes: string;
  allocation: AllocationResult;
  estimatedWaitMins: number;
  timestamp: string;
}
