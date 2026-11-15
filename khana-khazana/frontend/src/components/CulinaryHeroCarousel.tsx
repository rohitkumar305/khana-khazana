import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  CalendarCheck,
  QrCode,
  Shield,
  Utensils,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { RaindropHeader } from './MotionPrimitives';

export interface HeroDishSlide {
  id: string;
  title: string;
  shortLabel: string;
  subtitle: string;
  prepMins: number;
  price: number;
  image: string;
}

export const HERO_DISH_SLIDES: HeroDishSlide[] = [
  {
    id: 'slide-paneer',
    title: 'Paneer Butter Masala with Butter Naan',
    shortLabel: 'Paneer & Naan',
    subtitle:
      'Velvety tomato-cashew makhani gravy paired with charred garlic butter naan',
    prepMins: 14,
    price: 420,
    image: '/images/food_paneer_naan_1794676918929.jpg',
  },
  {
    id: 'slide-chicken-paratha',
    title: 'Spiced Chicken with Flaky Malabar Paratha',
    shortLabel: 'Chicken & Paratha',
    subtitle:
      'Slow-roasted pepper chicken curry served with crisp layered paratha',
    prepMins: 16,
    price: 480,
    image: '/images/food_chicken_paratha_1794676918657.jpg',
  },
  {
    id: 'slide-pizza',
    title: 'Wood-Fired Truffle & Burrata Pizza',
    shortLabel: 'Burrata Pizza',
    subtitle:
      'Blistered sourdough crust, melted mozzarella, wild mushrooms & basil',
    prepMins: 15,
    price: 590,
    image: '/images/food_artisan_pizza_1794676918698.jpg',
  },
  {
    id: 'slide-gulab-jamun',
    title: 'Warm Saffron & Pistachio Gulab Jamun',
    shortLabel: 'Gulab Jamun',
    subtitle:
      'Khoya dumplings soaked in cardamom-rose syrup, topped with silver varq & pistachio',
    prepMins: 8,
    price: 240,
    image: '/images/food_gulab_jamun_1794676919306.jpg',
  },
  {
    id: 'slide-biryani',
    title: 'Royal Zafrani Dum Biryani',
    shortLabel: 'Zafrani Biryani',
    subtitle:
      'Long-grain aged basmati layered with caramelized onions, saffron & aromatic spices',
    prepMins: 18,
    price: 510,
    image: '/images/food_dum_biryani_1794676920335.jpg',
  },
];

const SLIDE_INTERVAL_MS = 2800;

export function CulinaryHeroCarousel() {
  const { navigate, setPortalMode, floorEfficiency, tables } = useRestaurant();

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [failedSlides, setFailedSlides] = useState<Record<string, boolean>>({});

  // Preload all 5 high-resolution culinary images on mount for zero-flash crossfades
  useEffect(() => {
    HERO_DISH_SLIDES.forEach((slide) => {
      const img = new Image();
      img.src = slide.image;
    });
  }, []);

  // Fast 2.8s auto-advance interval with pause-on-hover
  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % HERO_DISH_SLIDES.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPaused]);

  const activeSlide = HERO_DISH_SLIDES[activeIndex];

  return (
    <section
      aria-label="Signature Culinary Hero Carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative min-h-[780px] lg:h-[92vh] lg:max-h-[900px] w-full overflow-hidden flex items-center bg-[#0B0F0D]"
    >
      {/* Full-Bleed Ken Burns Crossfade Background Carousel */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence mode="sync">
          <motion.div
            key={activeSlide.id}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1.0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {!failedSlides[activeSlide.id] ? (
              <img
                src={activeSlide.image}
                alt={activeSlide.title}
                referrerPolicy="no-referrer"
                onError={() =>
                  setFailedSlides((prev) => ({
                    ...prev,
                    [activeSlide.id]: true,
                  }))
                }
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full bg-[#0B0F0D] flex items-center justify-end pr-24">
                <Utensils className="w-24 h-24 text-white/20" />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Rich Dark-Vignette Scrim (#0B0F0D) for Crisp White & Crimson/Emerald Contrast */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0B0F0D]/92 via-[#0B0F0D]/55 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0F0D]/80 via-transparent to-[#0B0F0D]/45"
        />
      </div>

      {/* Architectural Corner HUD Crosshairs */}
      <div
        aria-hidden="true"
        className="pointer-events-none hidden lg:block absolute inset-x-8 top-24 bottom-16 z-10"
      >
        <div className="absolute top-0 left-0 w-5 h-5 border-t border-l border-white/30" />
        <div className="absolute top-0 right-0 flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.22em] text-white/90 uppercase bg-[#0B0F0D]/60 px-2.5 py-1 border border-white/20 tabular-nums">
            {String(activeIndex + 1).padStart(2, '0')} / 05 — {activeSlide.shortLabel}
          </span>
          <div className="w-5 h-5 border-t border-r border-white/30" />
        </div>
        <div className="absolute bottom-0 left-0 flex items-center gap-3">
          <div className="w-5 h-5 border-b border-l border-white/30" />
          <span className="font-mono text-[10px] tracking-[0.22em] text-emerald-300 uppercase">
            A* Table Engine Active · Freshness Verified
          </span>
        </div>
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-white/30" />
      </div>

      {/* Foreground Editorial Typography & Crimson/White/Emerald CTAs */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-28 pb-24 lg:pt-24 lg:pb-24">
        <div className="max-w-2xl space-y-6">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-emerald-300">
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full bg-[#059669] inline-block"
              />
              <span className="tabular-nums font-semibold">
                {floorEfficiency.freeCount}/{tables.length} Tables Ready ·{' '}
                {floorEfficiency.occupiedCount > 0
                  ? `${floorEfficiency.seatEfficiencyPct}% Efficiency Live`
                  : 'Open for Seating'}
              </span>
            </span>
            <span aria-hidden="true" className="text-white/35">
              ·
            </span>
            <span className="text-white/85">
              Serving: {activeSlide.title} ({activeSlide.prepMins}m)
            </span>
          </div>

          <RaindropHeader
            asHero
            onDark
            title="Khana-Khazana"
            subtitle="Where Culinary Heritage Meets Autonomous Intelligence. Reserve tables with instant email & QR check-in passes, order directly at your table with live stock checks, or orchestrate operations via Admin Command."
          />

          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            <button
              type="button"
              onClick={() => navigate('/book')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#DC2626] text-white font-semibold text-sm hover:bg-[#B91C1C] transition-colors shadow-[0_12px_30px_rgba(220,38,38,0.35)] whitespace-nowrap"
            >
              <CalendarCheck className="w-4 h-4" />
              Book a Smart Table
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/table/T3/menu')}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full bg-[#F5EFE6] text-[#111827] font-semibold text-sm hover:bg-[#ECE3D3] transition-colors whitespace-nowrap"
            >
              <QrCode className="w-4 h-4 text-[#059669]" />
              Order at Table T3 (QR Menu)
            </button>

            <button
              type="button"
              onClick={() => setPortalMode('admin')}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full border border-white/35 bg-black/35 text-white font-medium text-sm hover:border-white hover:bg-black/55 transition-colors whitespace-nowrap"
            >
              <Shield className="w-4 h-4 text-emerald-400" />
              Admin Floor Command
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
