import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Clock,
  Minus,
  Plus,
  QrCode,
  RefreshCw,
  ShoppingBag,
  Utensils,
  X,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import type {
  CartOrderItem,
  KitchenOrder,
  MenuDish,
  OutOfStockConflict,
} from '../../../backend/engine/types';
import { LateralSlideCard, RaindropHeader } from '../components/MotionPrimitives';

interface TableMenuPageProps {
  tableId: string;
}

const CATEGORIES: Array<'All' | MenuDish['category']> = [
  'All',
  'Signature Starters',
  'Royal Mains',
  'Artisan & Global',
  'Desserts',
];

const ORDER_STAGES = [
  'Order Received',
  'Preparing',
  'Waiter En Route',
  'Served',
] as const;

export function TableMenuPage({ tableId }: TableMenuPageProps) {
  const {
    tables,
    ingredients,
    menuDishes,
    orders,
    placeTableOrder,
    advanceOrderStatus,
    navigate,
  } = useRestaurant();

  const normalizedTableId = tableId.toUpperCase();
  const tableInfo = tables.find((t) => t.id === normalizedTableId);

  const [activeCategory, setActiveCategory] = useState<'All' | MenuDish['category']>('All');
  const [cart, setCart] = useState<CartOrderItem[]>([]);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [isPlacing, setIsPlacing] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderLatencyMs, setOrderLatencyMs] = useState<number | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [stockConflicts, setStockConflicts] = useState<OutOfStockConflict[] | null>(
    null,
  );

  const ingredientMap = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  );

  const filteredDishes = useMemo(() => {
    if (activeCategory === 'All') return menuDishes;
    return menuDishes.filter((d) => d.category === activeCategory);
  }, [activeCategory, menuDishes]);

  const cartDetails = useMemo(() => {
    const dishMap = new Map(menuDishes.map((d) => [d.id, d]));
    return cart
      .map((item) => {
        const dish = dishMap.get(item.dishId);
        if (!dish || item.quantity <= 0) return null;
        return { dish, quantity: item.quantity };
      })
      .filter((x): x is { dish: MenuDish; quantity: number } => Boolean(x));
  }, [cart, menuDishes]);

  const cartTotal = useMemo(
    () =>
      cartDetails.reduce(
        (sum, entry) => sum + entry.dish.price * entry.quantity,
        0,
      ),
    [cartDetails],
  );

  const totalItemCount = useMemo(
    () => cartDetails.reduce((sum, entry) => sum + entry.quantity, 0),
    [cartDetails],
  );

  const activeTicket: KitchenOrder | undefined = useMemo(() => {
    if (confirmedOrderId) {
      const explicit = orders.find(
        (o) => o.orderId === confirmedOrderId && o.tableId === normalizedTableId,
      );
      if (explicit) return explicit;
    }
    return orders.find(
      (o) => o.tableId === normalizedTableId && o.status !== 'Served',
    );
  }, [orders, confirmedOrderId, normalizedTableId]);

  if (!tableInfo) {
    return (
      <div className="pt-32 pb-28 bg-[#F5EFE6] text-[#111827] min-h-[70vh]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
            Invalid Table QR Code
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold">
            Table {normalizedTableId} Does Not Exist
          </h1>
          <p className="text-sm text-neutral-600">
            Select a valid dining table (T1–T10) to open its live QR digital menu.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {tables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => navigate(`/table/${t.id}/menu`)}
                className="px-4 py-2 border border-[#DCD0BE] bg-[#FBF8F2] font-mono text-xs font-semibold hover:border-[#DC2626] hover:text-[#DC2626] transition-colors"
              >
                {t.id} · {t.zone}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const updateCartQuantity = (dishId: string, delta: number) => {
    setOrderError('');
    setCart((prev) => {
      const existing = prev.find((i) => i.dishId === dishId);
      if (!existing && delta > 0) {
        return [...prev, { dishId, quantity: delta }];
      }
      return prev
        .map((i) =>
          i.dishId === dishId ? { ...i, quantity: i.quantity + delta } : i,
        )
        .filter((i) => i.quantity > 0);
    });
  };

  const handlePlaceOrder = async (itemsToSubmit: CartOrderItem[] = cart) => {
    if (itemsToSubmit.length === 0 || isPlacing) return;
    setIsPlacing(true);
    setOrderError('');
    try {
      const resp = await placeTableOrder(normalizedTableId, itemsToSubmit);
      setOrderLatencyMs(resp.responseTimeMs);
      if (resp.ok && resp.order) {
        setConfirmedOrderId(resp.order.orderId);
        setStockConflicts(null);
        setCart([]);
      } else if (resp.conflicts && resp.conflicts.length > 0) {
        setStockConflicts(resp.conflicts);
      } else {
        setOrderError('Unable to validate and place order. Please review your tray.');
      }
    } catch (err) {
      setOrderError(
        err instanceof Error
          ? err.message
          : 'Failed to place order against NeonDB kitchen inventory.',
      );
    } finally {
      setIsPlacing(false);
    }
  };

  const handleSwapSubstitute = async (
    unavailableDishId: string,
    substituteDishId: string,
  ) => {
    const nextCart = cart
      .filter((i) => i.dishId !== unavailableDishId)
      .concat([{ dishId: substituteDishId, quantity: 1 }]);
    const mergedMap = new Map<string, number>();
    for (const item of nextCart) {
      mergedMap.set(item.dishId, (mergedMap.get(item.dishId) ?? 0) + item.quantity);
    }
    const mergedCart = Array.from(mergedMap.entries()).map(([dishId, quantity]) => ({
      dishId,
      quantity,
    }));
    setCart(mergedCart);
    setStockConflicts(null);
    await handlePlaceOrder(mergedCart);
  };

  const handleRemoveUnavailable = (unavailableDishId: string) => {
    setCart((prev) => prev.filter((i) => i.dishId !== unavailableDishId));
    setStockConflicts((prev) =>
      prev ? prev.filter((c) => c.dishId !== unavailableDishId) : null,
    );
  };

  return (
    <div className="pt-28 pb-28 bg-[#F5EFE6] text-[#111827] overflow-x-clip">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Table-Locked QR Menu Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-8 border-b border-[#DCD0BE]">
          <RaindropHeader
            asPageTitle
            kicker={`Table ${normalizedTableId} · ${tableInfo.zone} · QR Digital Menu`}
            title={`Welcome to ${tableInfo.label}`}
            subtitle="Browse chef-crafted dishes, inspect live kitchen ingredient freshness, and place your table order with sub-1.2s atomic stock validation."
          />

          <div className="flex flex-wrap border border-[#DCD0BE] divide-x divide-y sm:divide-y-0 divide-[#DCD0BE] shrink-0">
            {tables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setConfirmedOrderId(null);
                  setOrderError('');
                  navigate(`/table/${t.id}/menu`);
                }}
                className={`px-2.5 py-2 font-mono text-xs font-semibold transition-colors ${
                  normalizedTableId === t.id
                    ? 'bg-[#DC2626] text-white'
                    : 'bg-[#FBF8F2] text-neutral-700 hover:bg-[#ECE3D3]'
                }`}
              >
                {t.id}
              </button>
            ))}
          </div>
        </div>

        {/* Confirmed Order Ticket Banner */}
        {activeTicket && (
          <LateralSlideCard index={0}>
            <div
              role="status"
              aria-label="Order Confirmed Ticket"
              className="border-y border-[#059669] bg-[#ECFDF5]/60 p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 bg-[#059669] text-white flex items-center justify-center shrink-0">
                    <ChefHat className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#047857] font-semibold">
                      Order Confirmed Ticket · {activeTicket.orderId}
                    </p>
                    <h2 className="font-serif text-xl font-bold text-[#111827]">
                      Table {activeTicket.tableId} · ₹{activeTicket.totalAmount} · Est.{' '}
                      {activeTicket.prepTimeMins} mins
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {orderLatencyMs !== null && (
                    <span className="font-mono text-xs text-[#047857] font-semibold tabular-nums">
                      Response Time: {orderLatencyMs}ms
                    </span>
                  )}
                  {activeTicket.status !== 'Served' && (
                    <button
                      type="button"
                      onClick={() => {
                        void advanceOrderStatus(activeTicket.orderId).catch((err) =>
                          setOrderError(
                            err instanceof Error ? err.message : 'Unable to advance order status.',
                          ),
                        );
                      }}
                      className="px-4 py-2 rounded-full border border-[#059669] bg-[#FBF8F2] text-xs font-semibold text-[#047857] hover:bg-[#059669] hover:text-white transition-colors whitespace-nowrap"
                    >
                      Advance Stage
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#DCD0BE] divide-x divide-y sm:divide-y-0 divide-[#DCD0BE] bg-[#FBF8F2]">
                {ORDER_STAGES.map((stage, idx) => {
                  const stageIndex = ORDER_STAGES.indexOf(activeTicket.status);
                  const reached = idx <= stageIndex;
                  return (
                    <div
                      key={stage}
                      className={`px-3.5 py-2.5 font-mono text-xs flex items-center gap-2 ${
                        reached
                          ? 'bg-[#ECFDF5] text-[#047857] font-semibold'
                          : 'bg-[#FBF8F2] text-neutral-500'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          reached ? 'text-[#059669]' : 'text-neutral-300'
                        }`}
                      />
                      <span className="truncate">{stage}</span>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-neutral-700">
                Items:{' '}
                {activeTicket.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')} ·
                Assigned Waiter:{' '}
                <strong className="text-[#111827]">
                  {activeTicket.dispatchedAgentId}
                </strong>
              </p>
            </div>
          </LateralSlideCard>
        )}

        {/* Hairline Category Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DCD0BE] pb-1">
          <div className="flex flex-wrap items-center gap-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeCategory === cat
                    ? 'border-[#DC2626] text-[#DC2626]'
                    : 'border-transparent text-neutral-500 hover:text-[#111827]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <span className="font-mono text-xs text-[#047857] font-medium pb-2">
            {tableInfo.activeBookingId
              ? `Linked Pass: ${tableInfo.activeBookingId}`
              : 'Walk-In QR Session'}
          </span>
        </div>

        {/* Main Split: Editorial Menu Gallery + Sticky Order Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-[#DCD0BE] items-start">
          <div className="lg:col-span-8 lg:pr-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-10">
            {filteredDishes.map((dish, idx) => {
              const qtyInCart =
                cart.find((item) => item.dishId === dish.id)?.quantity ?? 0;
              const lowStockWarning = dish.recipe.some((req) => {
                const ing = ingredientMap.get(req.ingredientId);
                return !ing || ing.stock < req.amount;
              });

              return (
                <LateralSlideCard key={dish.id} index={idx}>
                  <article className="h-full flex flex-col justify-between border-b border-[#DCD0BE] pb-6">
                    <div>
                      <div className="relative h-48 w-full bg-[#ECE3D3] overflow-hidden">
                        {!failedImages[dish.id] ? (
                          <img
                            src={dish.image}
                            alt={dish.name}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedImages((prev) => ({
                                ...prev,
                                [dish.id]: true,
                              }))
                            }
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-[#DC2626] p-4 text-center">
                            <Utensils className="w-7 h-7 mb-2" />
                            <span className="font-serif text-sm font-semibold">
                              {dish.name}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 space-y-2">
                        <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                          <span
                            className={`inline-flex items-center gap-1.5 font-semibold ${
                              dish.isVeg ? 'text-[#047857]' : 'text-[#DC2626]'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`w-2 h-2 rounded-full inline-block ${
                                dish.isVeg ? 'bg-[#059669]' : 'bg-[#DC2626]'
                              }`}
                            />
                            {dish.isVeg ? 'Veg' : 'Non-Veg'} · {dish.prepMins} mins
                          </span>
                          <span className="text-neutral-500">
                            {dish.dietaryTags.join(' · ')}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="font-serif text-xl font-bold text-[#111827]">
                            {dish.name}
                          </h3>
                          <span className="font-serif text-xl font-bold text-[#111827] tabular-nums shrink-0">
                            ₹{dish.price}
                          </span>
                        </div>

                        <p className="text-xs text-neutral-600 leading-relaxed">
                          {dish.description}
                        </p>

                        {lowStockWarning && (
                          <p className="font-mono text-[11px] text-[#DC2626] font-medium pt-1">
                            Chef Note: Limited live pantry stock — validated on order
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-4">
                      {qtyInCart === 0 ? (
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(dish.id, 1)}
                          className="w-full py-2.5 px-4 rounded-full border border-[#C9BCAA] bg-[#FBF8F2] text-[#111827] font-semibold text-xs hover:border-[#DC2626] hover:text-[#DC2626] transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                        >
                          <Plus className="w-4 h-4" />
                          Add {dish.name}
                        </button>
                      ) : (
                        <div className="w-full flex items-center justify-between rounded-full bg-[#FEF2F2] border border-[#DC2626] px-3 py-1 min-h-[44px]">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(dish.id, -1)}
                            aria-label={`Remove one ${dish.name}`}
                            className="p-2 rounded-full text-[#DC2626] hover:bg-[#DC2626] hover:text-white transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-mono text-sm font-bold text-[#111827] tabular-nums">
                            {qtyInCart} in Cart
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(dish.id, 1)}
                            aria-label={`Add one more ${dish.name}`}
                            className="p-2 rounded-full text-[#DC2626] hover:bg-[#DC2626] hover:text-white transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                </LateralSlideCard>
              );
            })}
          </div>

          {/* Right: Table Tray Order Ledger */}
          <LateralSlideCard index={1} className="lg:col-span-4 lg:pl-8 lg:sticky lg:top-24 pt-10 lg:pt-0">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-[#DCD0BE] pb-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
                    Table {normalizedTableId} Tray
                  </p>
                  <h2 className="font-serif text-2xl font-bold text-[#111827]">
                    Your Order ({totalItemCount})
                  </h2>
                </div>
                <ShoppingBag className="w-5 h-5 text-[#DC2626]" />
              </div>

              {cartDetails.length === 0 ? (
                <div className="py-10 text-center space-y-2 border-b border-[#DCD0BE]">
                  <QrCode className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-sm text-neutral-600">
                    Your table tray is empty. Add dishes from the menu to place an order.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#DCD0BE] border-b border-[#DCD0BE]">
                  {cartDetails.map(({ dish, quantity }) => (
                    <div
                      key={dish.id}
                      className="py-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111827] truncate">
                          {dish.name}
                        </p>
                        <p className="font-mono text-xs text-neutral-500 tabular-nums">
                          ₹{dish.price} × {quantity} = ₹{dish.price * quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(dish.id, -1)}
                          aria-label={`Decrease ${dish.name}`}
                          className="w-8 h-8 border border-[#DCD0BE] bg-[#FBF8F2] flex items-center justify-center text-neutral-700 hover:border-[#DC2626]"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-xs w-5 text-center tabular-nums font-semibold">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(dish.id, 1)}
                          aria-label={`Increase ${dish.name}`}
                          className="w-8 h-8 border border-[#DCD0BE] bg-[#FBF8F2] flex items-center justify-center text-neutral-700 hover:border-[#DC2626]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {orderError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#DC2626]/40 px-3.5 py-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{orderError}</span>
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Subtotal</span>
                  <span className="font-serif text-2xl font-bold text-[#111827] tabular-nums">
                    ₹{cartTotal}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#047857]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Atomic pantry check before kitchen dispatch (&lt; 1.2s)</span>
                </div>
              </div>

              <button
                type="button"
                disabled={cartDetails.length === 0 || isPlacing}
                onClick={() => handlePlaceOrder(cart)}
                className="w-full py-3.5 px-5 rounded-full bg-[#DC2626] text-white font-semibold text-sm hover:bg-[#B91C1C] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[48px]"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isPlacing ? 'Validating Kitchen Ingredients...' : 'Place Order'}
              </button>
            </div>
          </LateralSlideCard>
        </div>
      </div>

      {/* Polite Non-Disruptive Out-of-Stock Popup Modal (Workflow B) */}
      {stockConflicts && stockConflicts.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="stockout-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg bg-[#F5EFE6] border border-[#DCD0BE] shadow-2xl overflow-hidden text-[#111827]">
            <div className="px-6 py-4 border-b border-[#DCD0BE] flex items-center justify-between bg-[#FEF2F2]">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
                    Kitchen Pantry Update · {orderLatencyMs ?? 320}ms
                  </p>
                  <h2
                    id="stockout-modal-title"
                    className="font-serif text-lg font-bold text-[#111827]"
                  >
                    Chef’s Ingredient Notice
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockConflicts(null)}
                aria-label="Close ingredient notice"
                className="p-1.5 text-neutral-500 hover:text-[#111827] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {stockConflicts.map((conflict) => (
                <div key={conflict.dishId} className="space-y-3">
                  <p className="text-sm text-neutral-700 leading-relaxed">
                    {conflict.politeMessage}{' '}
                    <span className="font-mono text-xs text-[#DC2626] font-semibold">
                      ({conflict.ingredientName}: {conflict.availableStock}
                      {conflict.unit} left vs. {conflict.requiredAmount}
                      {conflict.unit} needed)
                    </span>
                  </p>

                  <p className="font-mono text-[11px] uppercase tracking-wider text-[#047857] font-semibold">
                    Recommended In-Stock Alternatives (Tap to Swap & Order)
                  </p>

                  <div className="divide-y divide-[#DCD0BE] border-y border-[#DCD0BE]">
                    {conflict.suggestedSubstitutes.map((sub) => (
                      <button
                        key={sub.dishId}
                        type="button"
                        onClick={() =>
                          handleSwapSubstitute(conflict.dishId, sub.dishId)
                        }
                        className="w-full text-left py-3.5 hover:bg-[#ECE3D3] flex items-center justify-between gap-3 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#111827]">
                            Swap to {sub.name}
                          </p>
                          <p className="font-mono text-xs text-[#047857] mt-0.5 tabular-nums">
                            ₹{sub.price} · {sub.reason}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#DC2626] shrink-0">
                          <RefreshCw className="w-3.5 h-3.5" />
                          Swap
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveUnavailable(conflict.dishId)}
                    className="text-xs text-neutral-500 hover:text-[#DC2626] underline transition-colors"
                  >
                    Remove {conflict.dishName} from tray instead
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
