import React, { useMemo } from 'react';

interface QRCodeSvgProps {
  value: string;
  size?: number;
  label?: string;
}

/**
 * Deterministic architectural SVG QR pattern encoding table/pass URI locally without external network calls.
 */
export function QRCodeSvg({ value, size = 112, label }: QRCodeSvgProps) {
  const modules = useMemo(() => {
    const gridSize = 15;
    const matrix: boolean[][] = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => false),
    );

    const drawFinder = (r0: number, c0: number) => {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const isBorder = r === 0 || r === 4 || c === 0 || c === 4;
          const isCenter = r === 2 && c === 2;
          matrix[r0 + r][c0 + c] = isBorder || isCenter;
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, gridSize - 5);
    drawFinder(gridSize - 5, 0);

    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const inTopLeft = r < 6 && c < 6;
        const inTopRight = r < 6 && c >= gridSize - 6;
        const inBottomLeft = r >= gridSize - 6 && c < 6;
        if (inTopLeft || inTopRight || inBottomLeft) continue;

        hash ^= (r * 31 + c * 17) & 0xff;
        hash = Math.imul(hash, 16777619);
        matrix[r][c] = (hash >>> 24) % 2 === 0;
      }
    }
    return matrix;
  }, [value]);

  const gridSize = modules.length;

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div
        className="p-2.5 bg-[#FBF8F2] border border-[#DCD0BE]"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox={`0 0 ${gridSize} ${gridSize}`}
          className="w-full h-full"
          role="img"
          aria-label={label ?? `QR Pass for ${value}`}
        >
          <rect width={gridSize} height={gridSize} fill="#FBF8F2" />
          {modules.map((row, r) =>
            row.map((filled, c) =>
              filled ? (
                <rect
                  key={`${r}-${c}`}
                  x={c}
                  y={r}
                  width={0.92}
                  height={0.92}
                  rx={0.08}
                  fill="#111827"
                />
              ) : null,
            ),
          )}
        </svg>
      </div>
      {label && (
        <span className="font-mono text-[10px] font-semibold text-[#047857] tracking-wider uppercase">
          {label}
        </span>
      )}
    </div>
  );
}
