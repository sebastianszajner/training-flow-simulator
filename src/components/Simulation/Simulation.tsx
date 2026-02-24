import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Play,
  Pause,
  Eye,
  Pencil,
  FileText,
  Link,
  Target,
  BookOpen,
  ClipboardList,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { formatMinutesToTime } from '../../engine/timeEngine';
import type { AgendaBlock, BlockType, RoomObject } from '../../model/types';
import { BLOCK_TYPE_META } from '../../model/types';
import EnergyCurve from './EnergyCurve';

// ── Constants ────────────────────────────────────────────────────────────────

const PLAYBACK_INTERVAL_MS = 1000; // 1 second = 1 minute of training time
const IDLE_JITTER_INTERVAL_MS = 2000;
const IDLE_JITTER_PX = 2;
const TRANSITION_DURATION_MS = 1000; // 0.8-1.2s average

// ── Types ────────────────────────────────────────────────────────────────────

interface ParticipantPosition {
  x: number;
  y: number;
}

// ── Helpers: find current block from playback position ────────────────────────

function getCurrentBlockIndex(
  blocks: AgendaBlock[],
  positionMinutes: number,
): number {
  let accumulated = 0;
  for (let i = 0; i < blocks.length; i++) {
    accumulated += blocks[i].window_minutes;
    if (positionMinutes < accumulated) return i;
  }
  return blocks.length - 1;
}

function getBlockTimeRange(
  blocks: AgendaBlock[],
  index: number,
): { startMin: number; endMin: number } {
  let start = 0;
  for (let i = 0; i < index; i++) {
    start += blocks[i].window_minutes;
  }
  return { startMin: start, endMin: start + (blocks[index]?.window_minutes ?? 0) };
}

// ── Helpers: generate target positions based on block type ────────────────────

function generateParticipantTargets(
  blockType: BlockType,
  count: number,
  roomWidth: number,
  roomHeight: number,
  chairs: RoomObject[],
): ParticipantPosition[] {
  const positions: ParticipantPosition[] = [];
  const cx = roomWidth / 2;
  const cy = roomHeight / 2;

  switch (blockType) {
    case 'lecture':
    case 'video_debrief':
    case 'workbook':
    case 'contract':
    case 'recap_module':
    case 'recap_day':
    case 'opening_questions': {
      // Participants at their chairs
      for (let i = 0; i < count; i++) {
        if (i < chairs.length) {
          positions.push({
            x: chairs[i].x + chairs[i].width / 2,
            y: chairs[i].y + chairs[i].height / 2,
          });
        } else {
          // Overflow: seat near existing chairs area
          const angle = (i / count) * Math.PI * 2;
          const radius = Math.min(roomWidth, roomHeight) * 0.35;
          positions.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius * 0.6 + roomHeight * 0.1,
          });
        }
      }
      break;
    }

    case 'pairs': {
      // Grouped in 2s, near tables
      for (let i = 0; i < count; i++) {
        const pairIndex = Math.floor(i / 2);
        const side = i % 2;
        const baseAngle = (pairIndex / Math.ceil(count / 2)) * Math.PI * 1.6 - Math.PI * 0.3;
        const radius = Math.min(roomWidth, roomHeight) * 0.28;
        const bx = cx + Math.cos(baseAngle) * radius;
        const by = cy + Math.sin(baseAngle) * radius * 0.7 + roomHeight * 0.05;
        positions.push({
          x: bx + (side === 0 ? -12 : 12),
          y: by + (side === 0 ? -6 : 6),
        });
      }
      break;
    }

    case 'groups': {
      // Grouped in clusters of 4-5
      const groupSize = count <= 8 ? 4 : 5;
      const numGroups = Math.ceil(count / groupSize);
      for (let i = 0; i < count; i++) {
        const groupIdx = Math.floor(i / groupSize);
        const memberIdx = i % groupSize;
        const groupAngle = (groupIdx / numGroups) * Math.PI * 2 - Math.PI / 2;
        const groupRadius = Math.min(roomWidth, roomHeight) * 0.25;
        const gx = cx + Math.cos(groupAngle) * groupRadius;
        const gy = cy + Math.sin(groupAngle) * groupRadius * 0.65;
        const memberAngle = (memberIdx / groupSize) * Math.PI * 2;
        const memberRadius = 18;
        positions.push({
          x: gx + Math.cos(memberAngle) * memberRadius,
          y: gy + Math.sin(memberAngle) * memberRadius,
        });
      }
      break;
    }

    case 'energizer': {
      // Standing formation in center
      const rows = Math.ceil(Math.sqrt(count));
      const cols = Math.ceil(count / rows);
      const spacing = 22;
      const startX = cx - ((cols - 1) * spacing) / 2;
      const startY = cy - ((rows - 1) * spacing) / 2;
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        positions.push({
          x: startX + col * spacing,
          y: startY + row * spacing,
        });
      }
      break;
    }

    case 'break': {
      // Scattered randomly around edges
      const seed = 42;
      for (let i = 0; i < count; i++) {
        const pseudoRand = ((i * 7919 + seed) % 1000) / 1000;
        const edge = i % 4;
        let x: number, y: number;
        switch (edge) {
          case 0: // top
            x = roomWidth * 0.1 + pseudoRand * roomWidth * 0.8;
            y = roomHeight * 0.05 + pseudoRand * roomHeight * 0.15;
            break;
          case 1: // bottom
            x = roomWidth * 0.1 + pseudoRand * roomWidth * 0.8;
            y = roomHeight * 0.8 + pseudoRand * roomHeight * 0.15;
            break;
          case 2: // left
            x = roomWidth * 0.05 + pseudoRand * roomWidth * 0.15;
            y = roomHeight * 0.1 + pseudoRand * roomHeight * 0.8;
            break;
          default: // right
            x = roomWidth * 0.8 + pseudoRand * roomWidth * 0.15;
            y = roomHeight * 0.1 + pseudoRand * roomHeight * 0.8;
            break;
        }
        positions.push({ x, y });
      }
      break;
    }

    default: {
      // Fallback: circle
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const r = Math.min(roomWidth, roomHeight) * 0.3;
        positions.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r * 0.6,
        });
      }
    }
  }

  return positions;
}

// ── Lerp helper ──────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Simulation() {
  const {
    project,
    viewMode,
    setViewMode,
    isPlaying,
    playbackPosition,
    play,
    pause,
    setPlaybackPosition,
  } = useProjectStore();

  // ── Refs for animation ──────────────────────────────────────────────────
  const positionsRef = useRef<ParticipantPosition[]>([]);
  const targetPositionsRef = useRef<ParticipantPosition[]>([]);
  const transitionStartRef = useRef<number>(0);
  const prevBlockIndexRef = useRef<number>(-1);
  const animFrameRef = useRef<number>(0);
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jitterOffsetsRef = useRef<ParticipantPosition[]>([]);
  const [_renderTick, setRenderTick] = useState(0);

  const canvasWidth = 580;
  const canvasHeight = 420;

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        No project loaded.
      </div>
    );
  }

  const { blocks, room, participant_count, start_time, total_minutes } = project;
  const chairs = room.objects.filter((o) => o.type === 'chair');

  // Determine current block
  const currentBlockIndex = getCurrentBlockIndex(blocks, playbackPosition);
  const currentBlock = blocks[currentBlockIndex] ?? null;
  const { startMin, endMin } = currentBlock
    ? getBlockTimeRange(blocks, currentBlockIndex)
    : { startMin: 0, endMin: 0 };

  // ── Playback timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const store = useProjectStore.getState();
      const nextPos = store.playbackPosition + 1;
      if (nextPos >= total_minutes) {
        store.setPlaybackPosition(total_minutes);
        store.pause();
      } else {
        store.setPlaybackPosition(nextPos);
      }
    }, PLAYBACK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isPlaying, total_minutes]);

  // ── Transition animation on block change ────────────────────────────────
  useEffect(() => {
    if (currentBlockIndex === prevBlockIndexRef.current) return;
    prevBlockIndexRef.current = currentBlockIndex;

    if (!currentBlock) return;

    // Compute scale factors from room to canvas
    const scaleX = canvasWidth / room.width;
    const scaleY = canvasHeight / room.height;
    const scaledChairs = chairs.map((c) => ({
      ...c,
      x: c.x * scaleX,
      y: c.y * scaleY,
      width: c.width * scaleX,
      height: c.height * scaleY,
    }));

    const newTargets = generateParticipantTargets(
      currentBlock.type,
      participant_count,
      canvasWidth,
      canvasHeight,
      scaledChairs,
    );

    targetPositionsRef.current = newTargets;
    transitionStartRef.current = performance.now();

    // Initialize positions if empty
    if (positionsRef.current.length !== participant_count) {
      positionsRef.current = newTargets.map((p) => ({ ...p }));
      jitterOffsetsRef.current = newTargets.map(() => ({ x: 0, y: 0 }));
    }

    // Animate transition
    function animateTransition(now: number) {
      const elapsed = now - transitionStartRef.current;
      const t = Math.min(elapsed / TRANSITION_DURATION_MS, 1);
      const eased = t * (2 - t); // ease-out quadratic

      const current = positionsRef.current;
      const targets = targetPositionsRef.current;
      for (let i = 0; i < current.length && i < targets.length; i++) {
        current[i] = {
          x: lerp(current[i].x, targets[i].x, eased),
          y: lerp(current[i].y, targets[i].y, eased),
        };
      }

      setRenderTick((v) => v + 1);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animateTransition);
      }
    }

    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animateTransition);

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [currentBlockIndex, currentBlock, participant_count, room, chairs, canvasWidth, canvasHeight]);

  // ── Idle micro-movement (jitter) ────────────────────────────────────────
  useEffect(() => {
    idleTimerRef.current = setInterval(() => {
      const offsets = jitterOffsetsRef.current;
      for (let i = 0; i < offsets.length; i++) {
        offsets[i] = {
          x: (Math.random() - 0.5) * IDLE_JITTER_PX * 2,
          y: (Math.random() - 0.5) * IDLE_JITTER_PX * 2,
        };
      }
      setRenderTick((v) => v + 1);
    }, IDLE_JITTER_INTERVAL_MS);

    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, []);

  // ── Rendered participant positions with jitter ──────────────────────────
  const displayPositions: ParticipantPosition[] = positionsRef.current.map(
    (p, i) => ({
      x: p.x + (jitterOffsetsRef.current[i]?.x ?? 0),
      y: p.y + (jitterOffsetsRef.current[i]?.y ?? 0),
    }),
  );

  // ── Render helpers ─────────────────────────────────────────────────────

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPlaybackPosition(Number(e.target.value));
    },
    [setPlaybackPosition],
  );

  const blockMeta = currentBlock ? BLOCK_TYPE_META[currentBlock.type] : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Top bar: Playback controls ────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/50">
        {/* Play/Pause */}
        <button
          onClick={() => (isPlaying ? pause() : play())}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        {/* Time slider */}
        <input
          type="range"
          min={0}
          max={total_minutes}
          value={playbackPosition}
          onChange={handleSliderChange}
          className="flex-1 h-1.5 accent-blue-500 cursor-pointer"
        />

        {/* Current time */}
        <span className="text-xs font-mono text-slate-300 min-w-[48px] text-right">
          {formatMinutesToTime(playbackPosition, start_time)}
        </span>

        {/* Current block name */}
        {currentBlock && blockMeta && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{ backgroundColor: blockMeta.color + '25', color: blockMeta.color }}
          >
            {currentBlock.title}
          </span>
        )}

        {/* View mode toggle */}
        <div className="flex items-center bg-slate-900/60 rounded-lg p-0.5 border border-slate-700/50 ml-2">
          <button
            onClick={() => setViewMode('plan')}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              viewMode === 'plan'
                ? 'bg-slate-700 text-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Pencil className="w-3 h-3" />
            Plan
          </button>
          <button
            onClick={() => setViewMode('show')}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              viewMode === 'show'
                ? 'bg-slate-700 text-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Eye className="w-3 h-3" />
            Show
          </button>
        </div>
      </div>

      {/* ── Main area (split) ─────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Room Canvas (60%) */}
        <div className="w-[60%] p-4 flex items-center justify-center bg-slate-900/40">
          <div
            className="relative rounded-xl border border-slate-700/50 bg-slate-800/50 overflow-hidden"
            style={{ width: canvasWidth, height: canvasHeight }}
          >
            {/* Room objects (simplified rendering) */}
            {room.objects.map((obj) => {
              const scaleX = canvasWidth / room.width;
              const scaleY = canvasHeight / room.height;
              const x = obj.x * scaleX;
              const y = obj.y * scaleY;
              const w = obj.width * scaleX;
              const h = obj.height * scaleY;

              let bgColor = 'bg-slate-600/40';
              let borderColor = 'border-slate-600/60';
              if (obj.type === 'table') {
                bgColor = 'bg-amber-900/30';
                borderColor = 'border-amber-800/40';
              } else if (obj.type === 'screen') {
                bgColor = 'bg-blue-900/40';
                borderColor = 'border-blue-700/50';
              } else if (obj.type === 'flipchart') {
                bgColor = 'bg-green-900/30';
                borderColor = 'border-green-700/40';
              } else if (obj.type === 'facilitator_spot') {
                bgColor = 'bg-purple-900/30';
                borderColor = 'border-purple-700/40';
              } else if (obj.type === 'chair') {
                // Chairs rendered smaller, but we skip them for participant dots
                return null;
              }

              return (
                <div
                  key={obj.id}
                  className={`absolute rounded ${bgColor} border ${borderColor}`}
                  style={{
                    left: x,
                    top: y,
                    width: w,
                    height: h,
                    transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
                  }}
                >
                  {obj.label && (
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] text-slate-400 truncate px-0.5">
                      {obj.label}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Participant dots */}
            {displayPositions.map((pos, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-full bg-blue-400 border border-blue-300/60 shadow-sm shadow-blue-500/20"
                style={{
                  left: pos.x - 6,
                  top: pos.y - 6,
                  transition: 'left 0.15s linear, top 0.15s linear',
                }}
              />
            ))}

            {/* Block type badge overlay */}
            {currentBlock && blockMeta && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded bg-slate-900/80 text-[10px] text-slate-300">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: blockMeta.color }}
                />
                {blockMeta.label}
              </div>
            )}
          </div>
        </div>

        {/* Right: Info Panel (40%) */}
        <div className="w-[40%] border-l border-slate-700/50 overflow-y-auto p-4 space-y-4">
          {currentBlock ? (
            <>
              {/* Block title & type */}
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {currentBlock.title}
                </h2>
                {blockMeta && (
                  <span
                    className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: blockMeta.color + '20',
                      color: blockMeta.color,
                    }}
                  >
                    {blockMeta.label}
                  </span>
                )}
              </div>

              {/* Time window */}
              <div className="text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Window:</span>
                  <span className="font-mono text-slate-300">
                    {formatMinutesToTime(startMin, start_time)} -{' '}
                    {formatMinutesToTime(endMin, start_time)}
                  </span>
                  <span className="text-slate-500">
                    ({currentBlock.window_minutes} min)
                  </span>
                </div>
                {currentBlock.estimated_minutes != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Estimated:</span>
                    <span
                      className={`font-mono ${
                        currentBlock.fits_in_window
                          ? 'text-green-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {currentBlock.estimated_minutes} min
                    </span>
                  </div>
                )}
              </div>

              {/* Training goals */}
              {project.training_goals.length > 0 && (
                <InfoSection icon={<Target className="w-3.5 h-3.5" />} title="Training Goals">
                  <ul className="space-y-1">
                    {project.training_goals.map((g, i) => (
                      <li key={i} className="text-xs text-slate-300 flex gap-1.5">
                        <span className="text-blue-400 mt-0.5">-</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </InfoSection>
              )}

              {/* Method / form of work */}
              {currentBlock.method && (
                <InfoSection icon={<BookOpen className="w-3.5 h-3.5" />} title="Form of Work">
                  <p className="text-xs text-slate-300 whitespace-pre-line">
                    {currentBlock.method}
                  </p>
                </InfoSection>
              )}

              {/* Plan mode only fields */}
              {viewMode === 'plan' && (
                <>
                  {currentBlock.facilitator_notes && (
                    <InfoSection
                      icon={<ClipboardList className="w-3.5 h-3.5" />}
                      title="Facilitator Notes"
                    >
                      <p className="text-xs text-slate-300 whitespace-pre-line">
                        {currentBlock.facilitator_notes}
                      </p>
                    </InfoSection>
                  )}

                  {currentBlock.materials && (
                    <InfoSection
                      icon={<FileText className="w-3.5 h-3.5" />}
                      title="Materials"
                    >
                      <p className="text-xs text-slate-300">{currentBlock.materials}</p>
                    </InfoSection>
                  )}

                  {currentBlock.workbook_link && (
                    <InfoSection icon={<Link className="w-3.5 h-3.5" />} title="Workbook">
                      <a
                        href={currentBlock.workbook_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 underline break-all"
                      >
                        {currentBlock.workbook_link}
                      </a>
                    </InfoSection>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">
              No blocks in this project.
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: Energy curve ───────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 bg-slate-800/60 border-t border-slate-700/50">
        <EnergyCurve
          blocks={blocks}
          currentPosition={playbackPosition}
          totalMinutes={total_minutes}
        />
      </div>
    </div>
  );
}

// ── Info section sub-component ───────────────────────────────────────────────

function InfoSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}
