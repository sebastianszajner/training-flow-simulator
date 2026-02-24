import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AgendaBlock, BlockType } from '../../model/types';

// ── Props ────────────────────────────────────────────────────────────────────

interface EnergyCurveProps {
  blocks: AgendaBlock[];
  currentPosition: number; // minutes from start
  totalMinutes: number;
}

// ── Color map by block type ──────────────────────────────────────────────────

const BLOCK_COLORS: Record<BlockType, string> = {
  energizer: '#22c55e',
  groups: '#3b82f6',
  pairs: '#3b82f6',
  lecture: '#f59e0b',
  workbook: '#f59e0b',
  video_debrief: '#8b5cf6',
  break: '#64748b',
  opening_questions: '#06b6d4',
  contract: '#06b6d4',
  recap_module: '#a855f7',
  recap_day: '#a855f7',
};

// ── Energy level by block type (1=low, 2=medium, 3=high) ─────────────────────

const ENERGY_LEVELS: Record<BlockType, number> = {
  energizer: 3,
  groups: 2,
  pairs: 2,
  lecture: 1,
  workbook: 1,
  video_debrief: 2,
  break: 0, // neutral
  opening_questions: 2,
  contract: 2,
  recap_module: 1,
  recap_day: 1,
};

// ── Warning detection ────────────────────────────────────────────────────────

interface Warning {
  positionPercent: number;
  message: string;
}

function detectWarnings(blocks: AgendaBlock[], totalMinutes: number): Warning[] {
  const warnings: Warning[] = [];
  if (blocks.length === 0 || totalMinutes === 0) return warnings;

  // Track consecutive low-energy blocks
  let consecutiveLow = 0;
  let consecutiveLowStart = 0;
  let accumulatedMinutes = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const energy = ENERGY_LEVELS[block.type];

    if (energy === 1) {
      if (consecutiveLow === 0) {
        consecutiveLowStart = accumulatedMinutes;
      }
      consecutiveLow++;

      if (consecutiveLow >= 3) {
        const warningPos =
          ((consecutiveLowStart + accumulatedMinutes + block.window_minutes) / 2) /
          totalMinutes;
        warnings.push({
          positionPercent: Math.min(warningPos * 100, 100),
          message: `${consecutiveLow} low-energy blocks in a row`,
        });
      }
    } else {
      consecutiveLow = 0;
    }

    // Check for low energy right after lunch break
    if (
      i > 0 &&
      blocks[i - 1].type === 'break' &&
      blocks[i - 1].title.toLowerCase().includes('lunch') &&
      energy <= 1
    ) {
      const pos = (accumulatedMinutes / totalMinutes) * 100;
      warnings.push({
        positionPercent: Math.min(pos, 100),
        message: 'Low energy after lunch break',
      });
    }

    accumulatedMinutes += block.window_minutes;
  }

  return warnings;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EnergyCurve({
  blocks,
  currentPosition,
  totalMinutes,
}: EnergyCurveProps) {
  const warnings = useMemo(
    () => detectWarnings(blocks, totalMinutes),
    [blocks, totalMinutes],
  );

  const currentPercent =
    totalMinutes > 0 ? (currentPosition / totalMinutes) * 100 : 0;

  const svgHeight = 32;
  const warningRowHeight = warnings.length > 0 ? 28 : 0;

  return (
    <div className="w-full select-none">
      {/* SVG bar */}
      <svg
        width="100%"
        height={svgHeight}
        className="rounded-md overflow-hidden"
        preserveAspectRatio="none"
      >
        {/* Block segments */}
        {(() => {
          let offset = 0;
          return blocks.map((block) => {
            const widthPercent =
              totalMinutes > 0
                ? (block.window_minutes / totalMinutes) * 100
                : 0;
            const x = offset;
            offset += widthPercent;

            return (
              <g key={block.id}>
                <rect
                  x={`${x}%`}
                  y={0}
                  width={`${widthPercent}%`}
                  height={svgHeight}
                  fill={BLOCK_COLORS[block.type] ?? '#475569'}
                  opacity={0.85}
                />
                {/* Separator line */}
                {x > 0 && (
                  <line
                    x1={`${x}%`}
                    y1={0}
                    x2={`${x}%`}
                    y2={svgHeight}
                    stroke="#0f172a"
                    strokeWidth={1}
                  />
                )}
              </g>
            );
          });
        })()}

        {/* Current position indicator */}
        <line
          x1={`${currentPercent}%`}
          y1={0}
          x2={`${currentPercent}%`}
          y2={svgHeight}
          stroke="#ef4444"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle
          cx={`${currentPercent}%`}
          cy={3}
          r={3}
          fill="#ef4444"
        />
      </svg>

      {/* Warning badges below */}
      {warnings.length > 0 && (
        <div className="relative" style={{ height: warningRowHeight }}>
          {warnings.map((w, i) => (
            <div
              key={i}
              className="absolute top-1 flex items-center gap-1 px-1.5 py-0.5 bg-amber-900/60 border border-amber-700/50 rounded text-[10px] text-amber-300 whitespace-nowrap"
              style={{
                left: `${Math.min(w.positionPercent, 85)}%`,
                transform: 'translateX(-50%)',
              }}
              title={w.message}
            >
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
