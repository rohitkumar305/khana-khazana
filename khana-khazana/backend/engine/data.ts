import type {
  RestaurantTable,
  WaitingParty,
  WaiterAgent,
  AgentEvent,
  PolicyChunk,
  XaiAuditLog,
  IngredientItem,
  MenuDish,
  ReservationRecord,
  KitchenOrder,
} from './types';

export interface AiPillar {
  id: string;
  unitLabel: string;
  title: string;
  subtitle: string;
  formula: string;
  metricLabel: string;
  metricValue: string;
  targetRoute:
    | '/book'
    | '/table/T3/menu'
    | '/concierge'
    | '/admin/dashboard'
    | '/admin/algorithms'
    | '/admin/agents'
    | '/admin/assistant';
  description: string;
}

export const AI_PILLARS: AiPillar[] = [
  {
    id: 'pillar-search',
    unitLabel: 'UNIT I · STATE-SPACE SEARCH',
    title: 'A* Optimal Table Search',
    subtitle: 'Heuristic f(n) = g(n) + h(n) minimizes wasted seats and wait delay.',
    formula: 'f(n) = w₂·Wait(n) + w₁·Waste(n)',
    metricLabel: 'Search Strategy',
    metricValue: 'f(n) Optimal',
    targetRoute: '/admin/algorithms',
    description:
      'Outperforms blind BFS, DFS, and greedy Hill Climbing by pruning suboptimal floor configurations and merging adjacent tables only when party size demands it.',
  },
  {
    id: 'pillar-bayes',
    unitLabel: 'UNIT II · PROBABILISTIC INFERENCE',
    title: 'Bayesian Turnover Engine',
    subtitle: 'Computes live turnover likelihood P(Free₁₀ | Course) from dining cadence.',
    formula: 'P(Free₁₀ | E) = P(E | Free₁₀)·P(Free₁₀) / P(E)',
    metricLabel: 'Pre-Alloc Threshold',
    metricValue: '≥ 75%',
    targetRoute: '/admin/dashboard',
    description:
      'Continuously updates table release confidence across Appetizer, Mains, Dessert, and Billing states to pre-allocate clearing tables ahead of guest arrival.',
  },
  {
    id: 'pillar-rules',
    unitLabel: 'UNIT II · PRODUCTION RULES',
    title: 'Forward-Chaining Rules R1–R3',
    subtitle: 'Deterministic hospitality constraints enforced during reservation validation.',
    formula: 'IF Wheelchair → Filter(isAccessible) ∧ Suggest +30m Alt',
    metricLabel: 'Accessibility',
    metricValue: '100% Enforced',
    targetRoute: '/book',
    description:
      'Guarantees step-free table matching (R1), auto-combining pairs T3+T4, T5+T6 & T8+T9 for large groups (R2), and instant QR confirmation or empathetic alternative slots.',
  },
  {
    id: 'pillar-agents',
    unitLabel: 'UNIT III · MULTI-AGENT & INVENTORY',
    title: 'Utility Agents & Atomic Stock',
    subtitle: 'Host-01 & Waiters W1–W3 coordinate service & recipe inventory checks.',
    formula: 'U(a) = Urgency + VIP − Distance − Load',
    metricLabel: 'Stock Deduction',
    metricValue: 'SQL Transactional',
    targetRoute: '/admin/agents',
    description:
      'Validates QR table orders atomically against NeonDB ingredient quantities before deducting stock and dispatching kitchen prep tasks to utility-based floor waiters.',
  },
  {
    id: 'pillar-ml',
    unitLabel: 'UNIT IV · ML REGRESSION',
    title: 'Gradient-Boosted Turnover ML',
    subtitle: 'Learns party duration from weekend rush, peak cadence, and drink orders.',
    formula: 'MAE: 3.8 min (vs. 9.4 min Symbolic)',
    metricLabel: 'Model Calibration',
    metricValue: 'Multi-Feature',
    targetRoute: '/admin/algorithms',
    description:
      'Replaces rigid D = 45 + 5×Size heuristics with multi-feature dining duration predictions calibrated to real dining room telemetry.',
  },
  {
    id: 'pillar-rag',
    unitLabel: 'UNIT V & VI · RAG + FAIRNESS AUDIT',
    title: 'Grounded Maître D’ & XAI Ethics',
    subtitle: 'Zero-hallucination Groq gpt-oss-120b + live VIP/Regular queue parity monitor.',
    formula: '| avg(W_VIP) − avg(W_Reg) | ≤ 8.0 min',
    metricLabel: 'Fairness Parity',
    metricValue: 'Verified',
    targetRoute: '/admin/assistant',
    description:
      'Every answer cites live floor snapshots, kitchen inventory, or restaurant_policies.md and strictly refuses unverifiable claims.',
  },
];

export const INITIAL_TABLES: RestaurantTable[] = [
  {
    id: 'T1',
    label: 'T1 · Golden Bay Window',
    capacity: 2,
    zone: 'Window',
    isAccessible: false,
    isVipBooth: false,
    combinableWith: null,
    status: 'Free',
    currentCourse: 'None',
    elapsedMins: 0,
    assignedPartyId: null,
    assignedPartyName: null,
    assignedPartySize: null,
    activeBookingId: null,
    gridCol: 0,
    gridRow: 0,
  },
  {
    id: 'T2',
    label: 'T2 · Brass Hearth Two-Top',
    capacity: 2,
    zone: 'Main Hall',
    isAccessible: true,
    isVipBooth: false,
    combinableWith: null,
    status: 'Free',
    currentCourse: 'None',
    elapsedMins: 0,
    assignedPartyId: null,
    assignedPartyName: null,
    assignedPartySize: null,
    activeBookingId: null,
    gridCol: 1,
    gridRow: 0,
  },
  {
    id: 'T3',
    label: 'T3 · Lotus West',
    capacity: 4,
    zone: 'Main Hall',
    isAccessible: true,
    isVipBooth: false,
    combinableWith: 'T4',
    status: 'Free',
    currentCourse: 'None',
    elapsedMins: 0,
    assignedPartyId: null,
    assignedPartyName: null,
    assignedPartySize: null,
    activeBookingId: null,
    gridCol: 2,
    gridRow: 0,
  },
  {
    id: 'T4',
    label: 'T4 · Lotus East',
    capacity: 4,
    zone: 'Main Hall',
    isAccessible: true,
    isVipBooth: false,
    combinableWith: 'T3',
    status: 'Free',
    currentCourse: 'None',
    elapsedMins: 0,
    assignedPartyId: null,
    assignedPartyName: null,
    assignedPartySize: null,
    activeBookingId: null,
    gridCol: 3,
    gridRow: 0,
  },
  {
    id: 'T5',
    label: 'T5 · Skyline Window North',
    capacity: 4,
    zone: 'Window',
    isAccessible: false,
    isVipBooth: false,
    combinableWith: 'T6',
    status: 'Free',
    currentCourse: 'None',
    elapsedMins: 0,
    assignedPartyId: null,
    assignedPartyName: null,
    assignedPartySize: null,
    activeBookingId: null,
    gridCol: 0,
    gridRow: 1,
  },
  {
    id: 'T6',
    label: 'T6 · Skyline Window South',
    capacity: 4,
    zone: 'Window',
    isAccessible: false,
    isVipBooth: false,
    combinableWith: 'T5',
    status: 'Free',
    currentCourse: 'None',
    elapsedMins: 0,
    assignedPartyId: null,
    assignedPartyName: null,
    assignedPartySize: null,
    activeBookingId: null,
    gridCol: 1,
    gridRow: 1,
  },
  {
    id: 'T7',
    label: 'T7 · Saffron Corner',
    capacity: 2,
    zone: 'Window',
    isAccessible: true,
    isVipBooth: false,
    combinableWith: null,
    status: 'Free',
    currentCourse: 'None',
    elapsedMins: 0,
    assignedPartyId: null,
    assignedPartyName: null,
    assignedPartySize: null,
    activeBookingId: null,
    gridCol: 2,
    gridRow: 1,
  },
  {
    id: 'T8',
    label: 'T8 · Imperial Velvet Salon',
    capacity: 6,
    zone: 'VIP Lounge',
    isAccessible: false,
    isVipBooth: true,
    combinableWith: 'T9',
    status: 'Free',
    currentCourse: 'None',
    elapsedMins: 0,
    assignedPartyId: null,
    assignedPartyName: null,
    assignedPartySize: null,
    activeBookingId: null,
    gridCol: 3,
    gridRow: 1,
  },
  {
    id: 'T9',
    label: 'T9 · Sovereign Suite',
    capacity: 4,
    zone: 'VIP Lounge',
    isAccessible: true,
    isVipBooth: true,
    combinableWith: 'T8',
    status: 'Free',
    currentCourse: 'None',
    elapsedMins: 0,
    assignedPartyId: null,
    assignedPartyName: null,
    assignedPartySize: null,
    activeBookingId: null,
    gridCol: 0,
    gridRow: 2,
  },
  {
    id: 'T10',
    label: 'T10 · Heritage Chef Table',
    capacity: 6,
    zone: 'Main Hall',
    isAccessible: true,
    isVipBooth: true,
    combinableWith: null,
    status: 'Free',
    currentCourse: 'None',
    elapsedMins: 0,
    assignedPartyId: null,
    assignedPartyName: null,
    assignedPartySize: null,
    activeBookingId: null,
    gridCol: 1,
    gridRow: 2,
  },
];

export const INITIAL_QUEUE: WaitingParty[] = [];

export const INITIAL_RESERVATIONS: ReservationRecord[] = [];

export const INITIAL_INGREDIENTS: IngredientItem[] = [
  {
    id: 'ing-truffle',
    name: 'Black Truffle Shavings',
    unit: 'g',
    stock: 90,
    parLevel: 120,
    perOrderHighlight: '15g per Truffle Paneer Tikka',
  },
  {
    id: 'ing-paneer',
    name: 'Fresh Malai Paneer',
    unit: 'g',
    stock: 2400,
    parLevel: 3000,
    perOrderHighlight: '220g per Paneer dish',
  },
  {
    id: 'ing-cashew',
    name: 'Roasted Malabar Cashews',
    unit: 'g',
    stock: 650,
    parLevel: 800,
    perOrderHighlight: '45g per Paneer Butter Masala',
  },
  {
    id: 'ing-saffron',
    name: 'Kashmiri Saffron Strands',
    unit: 'mg',
    stock: 800,
    parLevel: 1000,
    perOrderHighlight: '80mg per Biryani / Dessert',
  },
  {
    id: 'ing-lentils',
    name: '24-Hour Simmered Black Lentils',
    unit: 'g',
    stock: 3200,
    parLevel: 4000,
    perOrderHighlight: '260g per Dal Makhani',
  },
  {
    id: 'ing-gf-penne',
    name: 'Artisan Gluten-Free Rice Penne',
    unit: 'g',
    stock: 1100,
    parLevel: 1500,
    perOrderHighlight: '180g per Penne dish',
  },
  {
    id: 'ing-basmati',
    name: 'Aged Royal Basmati Rice',
    unit: 'g',
    stock: 4000,
    parLevel: 5000,
    perOrderHighlight: '280g per Zafrani Dum Biryani',
  },
  {
    id: 'ing-mozzarella',
    name: 'Buffalo Mozzarella & San Marzano',
    unit: 'g',
    stock: 1800,
    parLevel: 2400,
    perOrderHighlight: '200g per Stone Pizza',
  },
  {
    id: 'ing-khoya',
    name: 'Cardamom Khoya Dumplings',
    unit: 'pcs',
    stock: 48,
    parLevel: 60,
    perOrderHighlight: '4 pcs per Gulab Jamun',
  },
  {
    id: 'ing-pistachio',
    name: 'Iranian Green Pistachios',
    unit: 'g',
    stock: 420,
    parLevel: 500,
    perOrderHighlight: '15g per Saffron Gulab Jamun',
  },
];

export const MENU_DISHES: MenuDish[] = [
  {
    id: 'dish-paneer-butter-masala',
    name: 'Paneer Butter Masala with Butter Naan',
    category: 'Royal Mains',
    description:
      'Velvety heirloom tomato & cashew makhani gravy with artisan malai paneer, paired with blistered butter naan.',
    price: 420,
    prepMins: 14,
    dietaryTags: ['Veg', 'Dairy', 'Gluten', 'Contains Cashews'],
    isVeg: true,
    image: '/images/food_paneer_naan_1794676918929.jpg',
    recipe: [
      { ingredientId: 'ing-paneer', amount: 220 },
      { ingredientId: 'ing-cashew', amount: 45 },
    ],
    substituteDishIds: ['dish-truffle-paneer', 'dish-dal-makhani'],
  },
  {
    id: 'dish-truffle-paneer',
    name: 'Truffle Paneer Tikka',
    category: 'Signature Starters',
    description:
      'Char-grilled artisanal cottage cheese marinated in smoked yogurt, Kashmiri chili, and fresh black truffle shavings.',
    price: 540,
    prepMins: 14,
    dietaryTags: ['Veg', 'Nut-Free', 'Gluten-Free', 'Dairy'],
    isVeg: true,
    image: '/images/culinary_heritage_plating_1794675538229.jpg',
    recipe: [
      { ingredientId: 'ing-truffle', amount: 15 },
      { ingredientId: 'ing-paneer', amount: 220 },
    ],
    substituteDishIds: ['dish-dal-makhani', 'dish-margherita'],
  },
  {
    id: 'dish-dal-makhani',
    name: '24-Hour Smoked Dal Makhani',
    category: 'Royal Mains',
    description:
      'Slow-simmered black urad lentils finished with churned white butter, heirloom tomato puree, and organic cream.',
    price: 420,
    prepMins: 12,
    dietaryTags: ['Veg', 'Nut-Free', 'Gluten-Free', 'Dairy'],
    isVeg: true,
    image: '/images/culinary_heritage_plating_1794675538229.jpg',
    recipe: [{ ingredientId: 'ing-lentils', amount: 260 }],
    substituteDishIds: ['dish-truffle-paneer', 'dish-saffron-biryani'],
  },
  {
    id: 'dish-saffron-biryani',
    name: 'Royal Zafrani Dum Biryani',
    category: 'Royal Mains',
    description:
      'Sealed brass-handi aged basmati rice layered with aromatic spices, caramelized shallots, and Kashmiri saffron.',
    price: 510,
    prepMins: 18,
    dietaryTags: ['Non-Veg', 'Nut-Free', 'Gluten-Free', 'Dairy'],
    isVeg: false,
    image: '/images/food_dum_biryani_1794676920335.jpg',
    recipe: [
      { ingredientId: 'ing-basmati', amount: 280 },
      { ingredientId: 'ing-saffron', amount: 80 },
    ],
    substituteDishIds: ['dish-chicken-paratha', 'dish-dal-makhani'],
  },
  {
    id: 'dish-chicken-paratha',
    name: 'Spiced Chicken with Flaky Malabar Paratha',
    category: 'Royal Mains',
    description:
      'Slow-braised spiced chicken masala paired with hand-layered golden butter parathas straight from the tawa.',
    price: 480,
    prepMins: 16,
    dietaryTags: ['Non-Veg', 'Nut-Free', 'Gluten', 'Dairy'],
    isVeg: false,
    image: '/images/food_chicken_paratha_1794676918657.jpg',
    recipe: [{ ingredientId: 'ing-basmati', amount: 120 }],
    substituteDishIds: ['dish-saffron-biryani', 'dish-dal-makhani'],
  },
  {
    id: 'dish-margherita',
    name: 'Wood-Fired Truffle & Burrata Pizza',
    category: 'Artisan & Global',
    description:
      'Stone-baked sourdough crust topped with San Marzano tomatoes, creamy burrata, buffalo mozzarella, and black truffle.',
    price: 590,
    prepMins: 15,
    dietaryTags: ['Veg', 'Nut-Free', 'Gluten', 'Dairy'],
    isVeg: true,
    image: '/images/food_artisan_pizza_1794676918698.jpg',
    recipe: [
      { ingredientId: 'ing-mozzarella', amount: 200 },
      { ingredientId: 'ing-truffle', amount: 10 },
    ],
    substituteDishIds: ['dish-gf-penne', 'dish-truffle-paneer'],
  },
  {
    id: 'dish-gf-penne',
    name: 'Gluten-Free Masala Penne',
    category: 'Artisan & Global',
    description:
      'Al dente rice-quinoa penne tossed in velvety roasted tomato-makhani emulsion, basil, and aged parmesan.',
    price: 450,
    prepMins: 14,
    dietaryTags: ['Veg', 'Nut-Free', 'Gluten-Free', 'Dairy'],
    isVeg: true,
    image: '/images/food_artisan_pizza_1794676918698.jpg',
    recipe: [
      { ingredientId: 'ing-gf-penne', amount: 180 },
      { ingredientId: 'ing-mozzarella', amount: 120 },
    ],
    substituteDishIds: ['dish-margherita', 'dish-dal-makhani'],
  },
  {
    id: 'dish-gulab-jamun',
    name: 'Warm Saffron & Pistachio Gulab Jamun',
    category: 'Desserts',
    description:
      'Melt-in-the-mouth golden khoya dumplings steeped in warm cardamom-saffron syrup and crushed pistachios.',
    price: 240,
    prepMins: 8,
    dietaryTags: ['Veg', 'Dairy', 'Contains Pistachio', 'Gluten'],
    isVeg: true,
    image: '/images/food_gulab_jamun_1794676919306.jpg',
    recipe: [
      { ingredientId: 'ing-khoya', amount: 4 },
      { ingredientId: 'ing-saffron', amount: 40 },
      { ingredientId: 'ing-pistachio', amount: 15 },
    ],
    substituteDishIds: ['dish-dal-makhani', 'dish-margherita'],
  },
];

export const INITIAL_ORDERS: KitchenOrder[] = [];

export const INITIAL_WAITERS: WaiterAgent[] = [
  {
    id: 'W1',
    name: 'W1 · Arjun',
    role: 'Waiter (Utility-Based)',
    zone: 'Main Hall',
    currentAction: 'Standby',
    targetTableId: null,
    energyPct: 100,
    utilityScore: 0,
    utilityBreakdown: {
      urgency: 0,
      vipBonus: 0,
      distancePenalty: 0,
      loadPenalty: 0,
      totalUtility: 0,
    },
    tasksCompleted: 0,
  },
  {
    id: 'W2',
    name: 'W2 · Kavya',
    role: 'Waiter (Utility-Based)',
    zone: 'Window',
    currentAction: 'Standby',
    targetTableId: null,
    energyPct: 100,
    utilityScore: 0,
    utilityBreakdown: {
      urgency: 0,
      vipBonus: 0,
      distancePenalty: 0,
      loadPenalty: 0,
      totalUtility: 0,
    },
    tasksCompleted: 0,
  },
  {
    id: 'W3',
    name: 'W3 · Rohan',
    role: 'Waiter (Utility-Based)',
    zone: 'VIP Lounge',
    currentAction: 'Standby',
    targetTableId: null,
    energyPct: 100,
    utilityScore: 0,
    utilityBreakdown: {
      urgency: 0,
      vipBonus: 0,
      distancePenalty: 0,
      loadPenalty: 0,
      totalUtility: 0,
    },
    tasksCompleted: 0,
  },
  {
    id: 'Host-01',
    name: 'Host-01 · Concierge',
    role: 'Host (Goal-Based)',
    zone: 'Main Hall',
    currentAction: 'Standby',
    targetTableId: null,
    energyPct: 100,
    utilityScore: 0,
    utilityBreakdown: {
      urgency: 0,
      vipBonus: 0,
      distancePenalty: 0,
      loadPenalty: 0,
      totalUtility: 0,
    },
    tasksCompleted: 0,
  },
];

export const INITIAL_AGENT_EVENTS: AgentEvent[] = [];

export const INITIAL_XAI_LOGS: XaiAuditLog[] = [];

export interface SignatureKbDish {
  name: string;
  price: number;
  allergens: string[];
  nutFree: boolean;
  glutenFree: boolean;
}

export const SIGNATURE_MENU_KNOWLEDGE_BASE: SignatureKbDish[] = [
  {
    name: 'Paneer Butter Masala with Butter Naan',
    price: 420,
    allergens: ['Dairy', 'Gluten', 'Cashews'],
    nutFree: false,
    glutenFree: false,
  },
  {
    name: 'Spiced Chicken with Flaky Malabar Paratha',
    price: 480,
    allergens: ['Gluten', 'Dairy'],
    nutFree: true,
    glutenFree: false,
  },
  {
    name: 'Wood-Fired Truffle & Burrata Pizza',
    price: 590,
    allergens: ['Gluten', 'Dairy'],
    nutFree: true,
    glutenFree: false,
  },
  {
    name: 'Warm Saffron & Pistachio Gulab Jamun',
    price: 240,
    allergens: ['Dairy', 'Pistachio', 'Gluten'],
    nutFree: false,
    glutenFree: false,
  },
  {
    name: 'Royal Zafrani Dum Biryani',
    price: 510,
    allergens: ['Dairy'],
    nutFree: true,
    glutenFree: true,
  },
  {
    name: 'Truffle Paneer Tikka',
    price: 540,
    allergens: ['Dairy'],
    nutFree: true,
    glutenFree: true,
  },
  {
    name: '24-Hour Smoked Dal Makhani',
    price: 420,
    allergens: ['Dairy'],
    nutFree: true,
    glutenFree: true,
  },
  {
    name: 'Gluten-Free Masala Penne',
    price: 450,
    allergens: ['Dairy'],
    nutFree: true,
    glutenFree: true,
  },
];

export const RESTAURANT_POLICIES_CHUNKS: PolicyChunk[] = [
  {
    id: 'POL-01',
    section: 'Operating Hours, Zones & Wheelchair Accessibility (Rule R1)',
    sourceFile: 'restaurant_policies.md',
    content:
      'Open daily 11:30 AM – 11:30 PM (kitchen closes 11:00 PM) across Main Hall, Window View, and VIP Lounge. Tables T2 (Main Hall, 2 seats), T3 & T4 (Main Hall, 4 seats each), T7 (Window, 2 seats), T9 (VIP Lounge, 4 seats), and T10 (Main Hall, 6 seats) provide step-free wheelchair access.',
    keywords: ['wheelchair', 'accessible', 'step-free', 'r1', 'hours', 'open', 'zones'],
  },
  {
    id: 'POL-02',
    section: 'VIP & Fairness Policy (Rule R3 / R4)',
    sourceFile: 'restaurant_policies.md',
    content:
      'VIP guests waiting >= 10 minutes receive complimentary Saffron Masala Papad & Welcome Drink (Saffron Amuse-Bouche). Fairness Guardrail: VIP reservations never bump wheelchair bookings or regular guests waiting > 20 minutes.',
    keywords: ['vip', 'wait', 'complimentary', 'papad', 'fairness', 'r3', 'r4', '10 minutes'],
  },
  {
    id: 'POL-03',
    section: 'Combinable Table Architecture (Rule R2 / R3 Merge)',
    sourceFile: 'restaurant_policies.md',
    content:
      'Adjacent wheelchair-accessible tables T3 and T4 in the Main Hall combine dynamically (up to 8 seats; ideal for wheelchair parties of 5–8 if 6-top T10 is occupied). Pairs T5 + T6 (Window, 8 seats) and T8 + T9 (VIP Lounge, 10 seats) also merge for larger groups.',
    keywords: ['combine', 'merge', 'large', 'group', 'party', 't3', 't4', '5', '6', '7', '8', '9', '10'],
  },
  {
    id: 'POL-04',
    section: 'Signature Menu & Verified Allergens',
    sourceFile: 'restaurant_policies.md',
    content:
      'Signature dishes & allergens: Paneer Butter Masala with Butter Naan (₹420 — Dairy, Gluten, Cashews), Spiced Chicken with Flaky Malabar Paratha (₹480 — Gluten, Dairy · Nut-Free), Wood-Fired Truffle & Burrata Pizza (₹590 — Gluten, Dairy · Nut-Free), Warm Saffron & Pistachio Gulab Jamun (₹240 — Dairy, Pistachio, Gluten), Royal Zafrani Dum Biryani (₹510 — Dairy · Nut-Free, GF), Truffle Paneer Tikka (₹540 — Dairy · Nut-Free, GF), 24-Hour Smoked Dal Makhani (₹420 — Dairy · Nut-Free, GF), Gluten-Free Masala Penne (₹450 — Dairy · Nut-Free, GF).',
    keywords: ['menu', 'food', 'dish', 'nut-free', 'nut', 'cashew', 'pistachio', 'gluten', 'allergen', 'biryani', 'paneer', 'pizza', 'dal'],
  },
  {
    id: 'POL-05',
    section: 'Facility Grounding & Hallucination Boundaries',
    sourceFile: 'restaurant_policies.md',
    content:
      'Khana-Khazana operates strictly as an indoor fine-dining restaurant with Main Hall, Window View, and VIP Lounge seating. We do NOT have a rooftop pool, swimming pool, spa, hotel rooms, helipad, or casino.',
    keywords: ['policy', 'facility', 'zone', 'hall', 'lounge', 'window', 'pool'],
  },
];

export const RESTAURANT_POLICIES = {
  brandName: 'Khana-Khazana',
  tagline: 'Where Culinary Heritage Meets Autonomous Intelligence.',
  hours: 'Open Daily, 11:30 AM – 11:30 PM (Kitchen closes at 11:00 PM)',
  zones: ['Main Hall', 'Window View', 'VIP Lounge'],
  wheelchairPolicy: RESTAURANT_POLICIES_CHUNKS[0].content,
  vipPolicy: RESTAURANT_POLICIES_CHUNKS[1].content,
  combinableTables: RESTAURANT_POLICIES_CHUNKS[2].content,
  culinaryMenu: RESTAURANT_POLICIES_CHUNKS[3].content,
  boundaries: RESTAURANT_POLICIES_CHUNKS[4].content,
};
