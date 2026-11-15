import type { TableStatus } from '../../../backend/engine/types';

export interface SvgTableNodeBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SvgTableColorTheme {
  fill: string;
  stroke: string;
  chairFill: string;
  chairStroke: string;
  titleColor: string;
  subColor: string;
  badgeFill: string;
  badgeText: string;
  pulseStroke: string;
}

export const SVG_FLOOR_VIEWBOX = {
  width: 760,
  height: 476,
};

export const SVG_TABLE_BOXES: Record<string, SvgTableNodeBox> = {
  // Window Bay (x: 18..248)
  T1: { id: 'T1', x: 28, y: 88, width: 96, height: 86 },
  T7: { id: 'T7', x: 142, y: 88, width: 96, height: 86 },
  T5: { id: 'T5', x: 28, y: 268, width: 96, height: 92 },
  T6: { id: 'T6', x: 142, y: 268, width: 96, height: 92 },

  // Main Dining Hall (x: 262..546)
  T2: { id: 'T2', x: 274, y: 88, width: 104, height: 86 },
  T10: { id: 'T10', x: 392, y: 88, width: 142, height: 86 },
  T3: { id: 'T3', x: 274, y: 268, width: 122, height: 92 },
  T4: { id: 'T4', x: 412, y: 268, width: 122, height: 92 },

  // VIP Velvet Lounge (x: 560..742)
  T8: { id: 'T8', x: 574, y: 88, width: 154, height: 92 },
  T9: { id: 'T9', x: 574, y: 268, width: 154, height: 92 },
};

export const SVG_STATUS_COLORS: Record<TableStatus, SvgTableColorTheme> = {
  Free: {
    fill: '#ECFDF5',
    stroke: '#059669',
    chairFill: '#A7F3D0',
    chairStroke: '#059669',
    titleColor: '#065F46',
    subColor: '#047857',
    badgeFill: '#059669',
    badgeText: '#FFFFFF',
    pulseStroke: '#059669',
  },
  Occupied: {
    fill: '#FEF2F2',
    stroke: '#DC2626',
    chairFill: '#DC2626',
    chairStroke: '#991B1B',
    titleColor: '#991B1B',
    subColor: '#B91C1C',
    badgeFill: '#DC2626',
    badgeText: '#FFFFFF',
    pulseStroke: '#DC2626',
  },
  Paying: {
    fill: '#FEF3C7',
    stroke: '#B45309',
    chairFill: '#FDE68A',
    chairStroke: '#B45309',
    titleColor: '#78350F',
    subColor: '#92400E',
    badgeFill: '#B45309',
    badgeText: '#FFFFFF',
    pulseStroke: '#B45309',
  },
  Dirty: {
    fill: '#ECE3D3',
    stroke: '#78716C',
    chairFill: '#D6D3D1',
    chairStroke: '#78716C',
    titleColor: '#44403C',
    subColor: '#57534E',
    badgeFill: '#57534E',
    badgeText: '#FFFFFF',
    pulseStroke: '#78716C',
  },
};

export function getChairRectanglesForNode(
  box: SvgTableNodeBox,
  capacity: number,
): Array<{ x: number; y: number; width: number; height: number; side: 'top' | 'bottom' }> {
  const topCount = Math.ceil(capacity / 2);
  const bottomCount = Math.floor(capacity / 2);
  const chairW = 20;
  const chairH = 8;
  const chairs: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    side: 'top' | 'bottom';
  }> = [];

  const placeRow = (count: number, side: 'top' | 'bottom') => {
    if (count <= 0) return;
    const gap = Math.min(12, Math.max(6, (box.width - count * chairW) / (count + 1)));
    const rowWidth = count * chairW + (count - 1) * gap;
    const startX = box.x + (box.width - rowWidth) / 2;
    const y = side === 'top' ? box.y - chairH - 3 : box.y + box.height + 3;

    for (let i = 0; i < count; i += 1) {
      chairs.push({
        x: Math.round(startX + i * (chairW + gap)),
        y,
        width: chairW,
        height: chairH,
        side,
      });
    }
  };

  placeRow(topCount, 'top');
  placeRow(bottomCount, 'bottom');
  return chairs;
}
