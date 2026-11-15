import React, { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  Mail,
  QrCode,
  Sparkles,
  X,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import {
  computeBayesianTurnoverProb,
  runAStarAllocation,
} from '../../../backend/engine/aiEngine';
import {
  classifyTableForBooking,
  getReservedTableIdsForSlot,
} from '../engine/floorMapHelpers';
import type {
  AlternativeSlotSuggestion,
  BookingValidationResponse,
  WaitingParty,
  Zone,
  ZonePreference,
} from '../../../backend/engine/types';
import { LateralSlideCard, RaindropHeader } from '../components/MotionPrimitives';
import { QRCodeSvg } from '../components/QRCodeSvg';
import { FloorSeatMap } from '../components/FloorSeatMap';

const ZONE_OPTIONS: Array<{ label: string; value: ZonePreference }> = [
  { label: 'Main Hall', value: 'Main Hall' },
  { label: 'Window', value: 'Window' },
  { label: 'VIP Lounge', value: 'VIP Lounge' },
  { label: 'Any Optimal Zone', value: 'ANY' },
];

function toLocalDateTimeInput(date: Date): string {
  const yyyy = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd}T${hh}:${mm}`;
}

function getDefaultFutureSlotLocal(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  const mins = d.getMinutes();
  const rounded = mins <= 30 ? 30 : 60;
  d.setMinutes(rounded, 0, 0);
  return toLocalDateTimeInput(d);
}

export function BookPage() {
  const {
    tables,
    queue,
    reservations,
    weights,
    isAutoPlaying,
    setIsAutoPlaying,
    tickCount,
    stepSimulationTick,
    validateAndSubmitBooking,
    simulateGuestArrival,
    navigate,
  } = useRestaurant();

  const [guestName, setGuestName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateTime, setDateTime] = useState(getDefaultFutureSlotLocal);
  const [partySize, setPartySize] = useState(4);
  const [preferredZone, setPreferredZone] = useState<ZonePreference>('Main Hall');
  const [needsWheelchair, setNeedsWheelchair] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');
  const [pinnedTableIds, setPinnedTableIds] = useState<string[]>([]);

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [bookingResult, setBookingResult] =
    useState<BookingValidationResponse | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Pick up Quick Booking Bar prefill from HomePage if present
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem('kk_quick_booking_prefill');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          partySize?: number;
          preferredZone?: ZonePreference;
          needsWheelchair?: boolean;
        };
        if (typeof parsed.partySize === 'number') setPartySize(parsed.partySize);
        if (parsed.preferredZone) setPreferredZone(parsed.preferredZone);
        if (typeof parsed.needsWheelchair === 'boolean') {
          setNeedsWheelchair(parsed.needsWheelchair);
        }
      } catch {
        // Ignore malformed prefill
      } finally {
        window.sessionStorage.removeItem('kk_quick_booking_prefill');
      }
    }
  }, []);

  // Automatically drop pinned tables if constraints or live floor state invalidate them
  useEffect(() => {
    if (pinnedTableIds.length === 0) return;
    const reservedIds = getReservedTableIdsForSlot(reservations, dateTime);
    const pinnedTables = pinnedTableIds
      .map((id) => tables.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));

    const valid =
      pinnedTables.length === pinnedTableIds.length &&
      pinnedTables.reduce((s, t) => s + t.capacity, 0) >= partySize &&
      pinnedTables.every((t) => {
        if (reservedIds.has(t.id)) return false;
        if (needsWheelchair && !t.isAccessible) return false;
        if (preferredZone !== 'ANY' && t.zone !== preferredZone) return false;
        const cls = classifyTableForBooking(t, tables, reservations, {
          partySize,
          needsWheelchair,
          dateTime,
          pinnedTableIds: [],
          aiRecommendedTableIds: [],
        });
        return cls.selectable;
      });

    if (!valid) {
      setPinnedTableIds([]);
    }
  }, [
    pinnedTableIds,
    tables,
    reservations,
    dateTime,
    partySize,
    needsWheelchair,
    preferredZone,
  ]);

  const livePreview = useMemo(() => {
    const slotReservedIds = getReservedTableIdsForSlot(reservations, dateTime);
    const slotAwareTables = tables.map((t) =>
      slotReservedIds.has(t.id) ? { ...t, status: 'Occupied' as const } : t,
    );

    const previewParty: WaitingParty = {
      id: 'PREVIEW',
      name: guestName.trim() || 'Guest Party',
      size: partySize,
      isVip,
      needsWheelchair,
      preferredZone,
      dietaryNotes: specialRequests,
      waitMins: isVip ? 11 : 2,
      status: 'WAITING',
    };
    const waitingCount = queue.filter((p) => p.status === 'WAITING').length;
    return runAStarAllocation(slotAwareTables, previewParty, waitingCount, weights);
  }, [
    guestName,
    partySize,
    isVip,
    needsWheelchair,
    preferredZone,
    specialRequests,
    tables,
    reservations,
    dateTime,
    queue,
    weights,
  ]);

  const pinnedSummary = useMemo(() => {
    if (pinnedTableIds.length === 0) return null;
    const pinnedTables = pinnedTableIds
      .map((id) => tables.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
    if (pinnedTables.length === 0) return null;
    const totalCapacity = pinnedTables.reduce((s, t) => s + t.capacity, 0);
    const wastedSeats = Math.max(0, totalCapacity - partySize);
    const bayesianProb = Math.min(
      ...pinnedTables.map((t) =>
        computeBayesianTurnoverProb(t.status, t.currentCourse, t.elapsedMins),
      ),
    );
    return {
      assignedTableIds: pinnedTableIds,
      totalCapacity,
      wastedSeats,
      bayesianProb,
      fScore: Number(
        (wastedSeats + (pinnedTables.length > 1 ? 0.5 : 0)).toFixed(1),
      ),
      explanation: `Guest pinned ${pinnedTableIds.join(' + ')} (${totalCapacity} seats · ${
        pinnedTables[0].zone
      }) directly on the live floor map.`,
    };
  }, [pinnedTableIds, tables, partySize]);

  const submitWithValues = async (
    overrides?: Partial<{
      dateTime: string;
      preferredZone: ZonePreference;
    }>,
  ) => {
    const trimmedName = guestName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const targetSlot = overrides?.dateTime ?? dateTime;

    if (!trimmedName) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Please enter a valid email address for your QR check-in pass.');
      return;
    }
    if (trimmedPhone.length < 7) {
      setFormError('Please enter a contact phone number.');
      return;
    }
    const parsedSlot = Date.parse(targetSlot);
    if (!targetSlot || Number.isNaN(parsedSlot)) {
      setFormError('Please choose a valid date and time slot.');
      return;
    }
    if (parsedSlot < Date.now() - 15 * 60_000) {
      setFormError('Cannot book a time slot in the past. Please choose an upcoming date & time.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);
    try {
      const resp = await validateAndSubmitBooking({
        guestName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        dateTime: targetSlot,
        partySize,
        preferredZone: overrides?.preferredZone ?? preferredZone,
        needsWheelchair,
        isVip,
        specialRequests,
        preferredTableIds:
          !overrides && pinnedTableIds.length > 0 ? pinnedTableIds : undefined,
      });
      setBookingResult(resp);
      if (resp.fulfillable) {
        setPinnedTableIds([]);
        setShowEmailModal(true);
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Unable to persist booking in NeonDB. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitWithValues();
  };

  const handleApplyAlternative = async (alt: AlternativeSlotSuggestion) => {
    setDateTime(alt.dateTime);
    setPreferredZone(alt.zone);
    await submitWithValues({
      dateTime: alt.dateTime,
      preferredZone: alt.zone,
    });
  };

  const handleCheckInAndOpenMenu = async () => {
    if (!bookingResult?.reservation) return;
    setIsCheckingIn(true);
    setFormError('');
    try {
      const res = await simulateGuestArrival(bookingResult.reservation.bookingId);
      const assignedTable =
        res?.allocation.assignedTableIds[0] ??
        bookingResult.reservation.assignedTableIds[0] ??
        'T3';
      setShowEmailModal(false);
      navigate(`/table/${assignedTable}/menu`);
    } catch (err) {
      setShowEmailModal(false);
      setFormError(
        err instanceof Error ? err.message : 'Unable to check in guest right now.',
      );
    } finally {
      setIsCheckingIn(false);
    }
  };

  const minSlotLocal = toLocalDateTimeInput(new Date());

  return (
    <div className="pt-28 pb-24 bg-[#F5EFE6] text-[#111827] overflow-x-clip">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 border-b border-[#DCD0BE] flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <RaindropHeader
          asPageTitle
          kicker="Customer Portal · Smart Reservation & Email Pass"
          title="Book Your Table with Live AI Verification"
          subtitle="Instant NeonDB slot validation, deterministic accessibility & table-merge checks, and automated QR Check-In pass delivery."
        />
      </div>

      {/* Real-Time BookMyShow-Style Floor & Seat Map */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FloorSeatMap
          tables={tables}
          reservations={reservations}
          dateTime={dateTime}
          partySize={partySize}
          needsWheelchair={needsWheelchair}
          pinnedTableIds={pinnedTableIds}
          aiRecommendedTableIds={livePreview.assignedTableIds}
          isAutoPlaying={isAutoPlaying}
          tickCount={tickCount}
          onToggleAutoPlay={() => setIsAutoPlaying((v) => !v)}
          onStepTick={stepSimulationTick}
          onSelectTables={(tableIds, resolvedZone: Zone | null) => {
            setPinnedTableIds(tableIds);
            if (resolvedZone) {
              setPreferredZone(resolvedZone);
            }
          }}
          onClearPinned={() => setPinnedTableIds([])}
        />

        {/* Hairline-Divided 2-Column Editorial Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-[#DCD0BE] border-b border-[#DCD0BE]">
          {/* Left: Reservation Form */}
          <LateralSlideCard index={0} className="lg:col-span-7 py-10 lg:pr-10">
            <form onSubmit={handleFormSubmit} className="space-y-8">
              <div className="border-b border-[#DCD0BE] pb-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
                  01 — Guest Reservation Details
                </p>
                <p className="text-xs text-neutral-600 mt-1">
                  Validates floor availability in under 1.5s and syncs with Admin Floor Command.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="book-name"
                    className="block font-mono text-[11px] uppercase tracking-wider text-neutral-600 mb-1.5"
                  >
                    Full Name
                  </label>
                  <input
                    id="book-name"
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g., Ananya Kapoor"
                    className="w-full border-b border-neutral-300 bg-transparent px-1 py-2.5 text-sm text-[#111827] placeholder:text-neutral-400 focus:outline-none focus:border-[#DC2626]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="book-email"
                    className="block font-mono text-[11px] uppercase tracking-wider text-neutral-600 mb-1.5"
                  >
                    Email (For QR Pass)
                  </label>
                  <input
                    id="book-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className="w-full border-b border-neutral-300 bg-transparent px-1 py-2.5 text-sm text-[#111827] placeholder:text-neutral-400 focus:outline-none focus:border-[#DC2626]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="book-phone"
                    className="block font-mono text-[11px] uppercase tracking-wider text-neutral-600 mb-1.5"
                  >
                    Phone Number
                  </label>
                  <input
                    id="book-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98204 55110"
                    className="w-full border-b border-neutral-300 bg-transparent px-1 py-2.5 text-sm text-[#111827] placeholder:text-neutral-400 focus:outline-none focus:border-[#DC2626]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="book-datetime"
                    className="block font-mono text-[11px] uppercase tracking-wider text-neutral-600 mb-1.5"
                  >
                    Date & Time Slot
                  </label>
                  <input
                    id="book-datetime"
                    type="datetime-local"
                    min={minSlotLocal}
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    className="w-full border-b border-neutral-300 bg-transparent px-1 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#DC2626] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <span className="block font-mono text-[11px] uppercase tracking-wider text-neutral-600 mb-3">
                  Party Size (1–10 Guests · Auto-Merges Adjacent Tables for 5+)
                </span>
                <div className="grid grid-cols-5 sm:grid-cols-10 border border-[#DCD0BE] divide-x divide-y sm:divide-y-0 divide-[#DCD0BE]">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                    const selected = partySize === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPartySize(num)}
                        className={`py-2.5 font-mono text-sm font-semibold transition-colors tabular-nums ${
                          selected
                            ? 'bg-[#DC2626] text-white'
                            : 'bg-[#FBF8F2] text-neutral-700 hover:bg-[#ECE3D3]'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="block font-mono text-[11px] uppercase tracking-wider text-neutral-600 mb-3">
                  Preferred Dining Zone
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#DCD0BE] divide-x divide-y sm:divide-y-0 divide-[#DCD0BE]">
                  {ZONE_OPTIONS.map((opt) => {
                    const selected = preferredZone === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPreferredZone(opt.value)}
                        className={`px-3 py-2.5 text-xs font-semibold transition-colors ${
                          selected
                            ? 'bg-[#111827] text-white'
                            : 'bg-[#FBF8F2] text-neutral-700 hover:bg-[#ECE3D3]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#DCD0BE] border border-[#DCD0BE]">
                <button
                  type="button"
                  onClick={() => setNeedsWheelchair((v) => !v)}
                  aria-pressed={needsWheelchair}
                  className={`p-4 text-left transition-colors ${
                    needsWheelchair ? 'bg-[#ECFDF5]' : 'bg-[#FBF8F2] hover:bg-[#ECE3D3]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]">
                      <Accessibility className="w-4 h-4 text-[#059669]" />
                      Wheelchair Accessible
                    </span>
                    <span
                      className={`font-mono text-[11px] font-semibold uppercase ${
                        needsWheelchair ? 'text-[#047857]' : 'text-neutral-500'
                      }`}
                    >
                      {needsWheelchair ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 mt-1.5">
                    Rule R1: Restricts matching exclusively to step-free floor seating.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsVip((v) => !v)}
                  aria-pressed={isVip}
                  className={`p-4 text-left transition-colors ${
                    isVip ? 'bg-[#FEF2F2]' : 'bg-[#FBF8F2] hover:bg-[#ECE3D3]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]">
                      <Crown className="w-4 h-4 text-[#DC2626]" />
                      VIP / Celebration Tier
                    </span>
                    <span
                      className={`font-mono text-[11px] font-semibold uppercase ${
                        isVip ? 'text-[#DC2626]' : 'text-neutral-500'
                      }`}
                    >
                      {isVip ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 mt-1.5">
                    Rule R3: Priority booth affinity & Saffron starter if wait exceeds 10m.
                  </p>
                </button>
              </div>

              <div>
                <label
                  htmlFor="book-requests"
                  className="block font-mono text-[11px] uppercase tracking-wider text-neutral-600 mb-1.5"
                >
                  Special Requests / Dietary Notes
                </label>
                <input
                  id="book-requests"
                  type="text"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="e.g., Jain options, nut allergy, anniversary dessert"
                  className="w-full border-b border-neutral-300 bg-transparent px-1 py-2.5 text-sm text-[#111827] placeholder:text-neutral-400 focus:outline-none focus:border-[#DC2626]"
                />
              </div>

              {formError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#DC2626]/40 px-4 py-3"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold text-sm disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shadow-[0_10px_28px_rgba(220,38,38,0.25)]"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSubmitting
                  ? 'Checking Live Floor & Bayesian Availability...'
                  : 'Confirm & Verify Availability'}
              </button>
            </form>
          </LateralSlideCard>

          {/* Right: Live AI Pre-Check & Booking Response */}
          <LateralSlideCard index={1} className="lg:col-span-5 py-10 lg:pl-10 space-y-8">
            {bookingResult && !bookingResult.fulfillable && (
              <div
                role="region"
                aria-label="Alternative Slots Available"
                className="border-y border-[#DC2626] bg-[#FEF2F2]/60 py-6 px-5 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#DC2626] font-semibold">
                    Concierge Availability Notice
                  </span>
                  <span className="font-mono text-[11px] text-[#047857] tabular-nums font-semibold">
                    Response Time: {bookingResult.responseTimeMs}ms
                  </span>
                </div>

                <h3 className="font-serif text-xl font-bold text-[#111827]">
                  {bookingResult.apologyTitle}
                </h3>
                <p className="text-sm text-neutral-700 leading-relaxed">
                  {bookingResult.apologyMessage}
                </p>

                <div className="divide-y divide-[#DCD0BE] border-t border-[#DCD0BE]">
                  {bookingResult.alternatives?.map((alt) => (
                    <button
                      key={alt.id}
                      type="button"
                      onClick={() => handleApplyAlternative(alt)}
                      className="w-full text-left py-3.5 hover:bg-[#FBF8F2] transition-colors space-y-1 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#DC2626] group-hover:text-[#B91C1C]">
                          {alt.label}
                        </span>
                        <ArrowRight className="w-4 h-4 text-[#DC2626] shrink-0" />
                      </div>
                      <p className="text-xs text-neutral-600">{alt.reason}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {bookingResult?.fulfillable && bookingResult.reservation && (
              <div className="border-y border-[#059669] bg-[#ECFDF5]/60 py-6 px-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#047857] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmed · {bookingResult.reservation.bookingId}
                  </span>
                  <span className="font-mono text-[11px] text-neutral-700 tabular-nums">
                    Response Time: {bookingResult.responseTimeMs}ms
                  </span>
                </div>
                <p className="text-sm text-[#111827]">
                  Table{' '}
                  <strong className="text-[#047857]">
                    {bookingResult.reservation.assignedTableIds.join(' + ')}
                  </strong>{' '}
                  is locked in NeonDB and your QR pass has been prepared for{' '}
                  <span className="font-mono text-xs text-neutral-700">
                    {bookingResult.reservation.email}
                  </span>
                  .
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(true)}
                    className="px-4 py-2 rounded-full border border-[#059669] bg-[#FBF8F2] text-xs font-semibold text-[#047857] hover:bg-[#059669] hover:text-white transition-colors"
                  >
                    Open Email & QR Pass
                  </button>
                  <button
                    type="button"
                    onClick={handleCheckInAndOpenMenu}
                    disabled={isCheckingIn}
                    className="px-5 py-2 rounded-full bg-[#DC2626] text-xs font-semibold text-white hover:bg-[#B91C1C] transition-colors"
                  >
                    {isCheckingIn ? 'Assigning Table...' : 'Check In Now & Open Menu'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="border-b border-[#DCD0BE] pb-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
                  02 — Live Pre-Check Engine
                </p>
                <h2 className="font-serif text-2xl font-bold text-[#111827] mt-1">
                  Projected Seating Match
                </h2>
              </div>

              <div className="bg-[#ECE3D3] border-y border-[#DCD0BE] py-5 px-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-neutral-600 uppercase">
                    Target Assignment
                  </span>
                  <span
                    className={`font-mono text-xs font-semibold ${
                      pinnedSummary
                        ? 'text-[#DC2626]'
                        : livePreview.success
                        ? 'text-[#047857]'
                        : 'text-[#DC2626]'
                    }`}
                  >
                    {pinnedSummary
                      ? 'Guest Floor Selection'
                      : livePreview.success
                      ? livePreview.isBayesianPreAllocation
                        ? 'Bayesian Pre-Alloc'
                        : 'Immediate Match'
                      : 'Alternative Required'}
                  </span>
                </div>

                <p className="font-serif text-4xl font-bold text-[#111827] tabular-nums">
                  {pinnedSummary
                    ? pinnedSummary.assignedTableIds.join(' + ')
                    : livePreview.assignedTableIds.length > 0
                    ? livePreview.assignedTableIds.join(' + ')
                    : 'Slot Check'}
                </p>

                <p className="text-xs text-neutral-700 leading-relaxed pt-1">
                  {pinnedSummary ? pinnedSummary.explanation : livePreview.explanation}
                </p>
              </div>

              <div className="grid grid-cols-3 divide-x divide-[#DCD0BE] border-y border-[#DCD0BE] font-mono">
                <div className="py-4 pr-3">
                  <span className="text-[10px] uppercase text-neutral-500 block">
                    f(n) Score
                  </span>
                  <span className="text-2xl font-serif font-bold text-[#111827] tabular-nums">
                    {pinnedSummary ? pinnedSummary.fScore : livePreview.fScore}
                  </span>
                </div>
                <div className="py-4 px-3">
                  <span className="text-[10px] uppercase text-neutral-500 block">
                    Wasted Seats
                  </span>
                  <span className="text-2xl font-serif font-bold text-[#047857] tabular-nums">
                    {pinnedSummary
                      ? pinnedSummary.wastedSeats
                      : livePreview.wastedSeats}
                  </span>
                </div>
                <div className="py-4 pl-3">
                  <span className="text-[10px] uppercase text-neutral-500 block">
                    Bayes P(Free₁₀)
                  </span>
                  <span className="text-2xl font-serif font-bold text-[#DC2626] tabular-nums">
                    {Math.round(
                      (pinnedSummary
                        ? pinnedSummary.bayesianProb
                        : livePreview.bayesianProb) * 100,
                    )}
                    %
                  </span>
                </div>
              </div>

              {livePreview.complimentaryStarterTriggered && (
                <div className="border-y border-[#059669]/40 bg-[#ECFDF5] py-3.5 px-4 flex items-start gap-2.5 text-xs text-[#047857]">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Rule R3 Active: VIP party receives a complimentary warm Saffron
                    Amuse-Bouche if lounge wait exceeds 10 minutes.
                  </span>
                </div>
              )}
            </div>
          </LateralSlideCard>
        </div>
      </div>

      {/* Email Sent Preview Modal (Workflow A Confirmation + QR Check-In Pass) */}
      {showEmailModal &&
        bookingResult?.fulfillable &&
        bookingResult.reservation &&
        bookingResult.emailPreview && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-confirmation-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="w-full max-w-xl bg-[#F5EFE6] border border-[#DCD0BE] shadow-2xl overflow-hidden text-[#111827]">
              <div className="px-6 py-4 border-b border-[#DCD0BE] flex items-center justify-between bg-[#ECE3D3]">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-5 h-5 text-[#059669]" />
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#047857] font-semibold">
                      Confirmation Email Dispatched · {bookingResult.responseTimeMs}ms
                    </p>
                    <h2
                      id="email-confirmation-title"
                      className="font-serif text-lg font-bold text-[#111827]"
                    >
                      Booking Confirmed — {bookingResult.reservation.bookingId}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  aria-label="Close confirmation modal"
                  className="p-1.5 text-neutral-600 hover:text-[#111827] hover:bg-[#DCD0BE]/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="border-y border-[#DCD0BE] py-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-neutral-600 font-mono">
                    <span>To: {bookingResult.emailPreview.to}</span>
                    <span className="text-[#047857] font-semibold">Delivered</span>
                  </div>
                  <p className="font-semibold text-[#111827]">
                    Subject: {bookingResult.emailPreview.subject}
                  </p>
                  <p className="text-neutral-700 leading-relaxed">
                    {bookingResult.emailPreview.bodySummary}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-5 bg-[#ECE3D3] border border-[#DCD0BE] p-4">
                  <QRCodeSvg
                    value={`https://khana-khazana.app/table/${bookingResult.reservation.assignedTableIds[0]}/menu?booking=${bookingResult.reservation.bookingId}`}
                    size={112}
                    label={bookingResult.reservation.qrPassCode}
                  />
                  <div className="space-y-2 text-xs flex-1">
                    <p className="font-mono uppercase tracking-wider text-[#DC2626] font-semibold">
                      Smart QR Check-In Pass
                    </p>
                    <p className="text-neutral-700 leading-relaxed">
                      Locked Table(s):{' '}
                      <strong className="text-[#111827]">
                        {bookingResult.reservation.assignedTableIds.join(' + ')}
                      </strong>{' '}
                      · {bookingResult.reservation.partySize} Guests ·{' '}
                      {bookingResult.reservation.bayesianConfidencePct}% Confidence
                    </p>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-[#047857]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Committed to NeonDB & synced live to Admin Floor</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleCheckInAndOpenMenu}
                    disabled={isCheckingIn}
                    className="flex-1 py-3 px-4 rounded-full bg-[#DC2626] text-white font-semibold text-sm hover:bg-[#B91C1C] transition-colors flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    {isCheckingIn
                      ? 'Checking In via A*...'
                      : 'Check-In & Open Table QR Menu'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailModal(false);
                      navigate('/admin/dashboard');
                    }}
                    className="py-3 px-4 rounded-full border border-[#C9BCAA] bg-[#FBF8F2] text-[#111827] font-semibold text-sm hover:border-[#111827] transition-colors"
                  >
                    View on Admin Floor
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
