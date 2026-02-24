import { useState, useMemo } from 'react';
import {
  MessageCircle,
  FileCheck,
  BookOpen,
  Users,
  UsersRound,
  NotebookPen,
  Zap,
  Video,
  RotateCcw,
  CalendarCheck,
  Coffee,
  Plus,
  X,
  GripVertical,
  Clock,
  Timer,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Trash2,
  FileText,
  Link,
  StickyNote,
  HelpCircle,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import type { BlockType, AgendaBlock, Recommendation, QuestionConfig } from '../../model/types';
import { BLOCK_TYPE_META } from '../../model/types';
import { getRecommendations } from '../../engine/fitEngine';
import { formatMinutesToTime, getSuggestedQuestionCount, estimateBlockTime } from '../../engine/timeEngine';
import { getExerciseById } from '../../library/exercises';

// ── Icon Map ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  MessageCircle,
  FileCheck,
  BookOpen,
  Users,
  UsersRound,
  NotebookPen,
  Zap,
  Video,
  RotateCcw,
  CalendarCheck,
  Coffee,
};

function BlockIcon({ type, size = 16, className = '' }: { type: BlockType; size?: number; className?: string }) {
  const meta = BLOCK_TYPE_META[type];
  const Icon = ICON_MAP[meta.icon];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}

// ── Energy helpers ──────────────────────────────────────────────────────────

function getEnergyLevel(type: BlockType): 'high' | 'medium' | 'low' {
  switch (type) {
    case 'energizer':
    case 'groups':
      return 'high';
    case 'pairs':
    case 'video_debrief':
    case 'opening_questions':
    case 'recap_module':
      return 'medium';
    case 'lecture':
    case 'workbook':
    case 'contract':
    case 'recap_day':
    case 'break':
    default:
      return 'low';
  }
}

function getEnergyColor(level: 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'high':
      return 'bg-green-400';
    case 'medium':
      return 'bg-yellow-400';
    case 'low':
      return 'bg-red-400';
  }
}

// ── Default question config ────────────────────────────────────────────────

function defaultQuestionConfig(): QuestionConfig {
  return {
    questions: [],
    persons_per_question: 5,
    questions_per_group: 2,
    seconds_per_question_prompt: 15,
    seconds_per_answer: 30,
    expected_answers_per_question: 3,
  };
}

// ── Block types array (for palette) ────────────────────────────────────────

const ALL_BLOCK_TYPES = Object.keys(BLOCK_TYPE_META) as BlockType[];

// ════════════════════════════════════════════════════════════════════════════
// TIMELINE BUILDER
// ════════════════════════════════════════════════════════════════════════════

export default function TimelineBuilder() {
  const project = useProjectStore((s) => s.project);
  const addBlock = useProjectStore((s) => s.addBlock);
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const removeBlock = useProjectStore((s) => s.removeBlock);
  const reorderBlocks = useProjectStore((s) => s.reorderBlocks);
  const selectBlock = useProjectStore((s) => s.selectBlock);
  const selectedBlockId = useProjectStore((s) => s.selectedBlockId);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        No project loaded. Create or load a project first.
      </div>
    );
  }

  const blocks = [...project.blocks].sort((a, b) => a.order - b.order);

  // ── Cumulative time calculations ────────────────────────────────────────

  const cumulativeTimes = useMemo(() => {
    let cumulative = 0;
    return blocks.map((block) => {
      const startMinutes = cumulative;
      cumulative += block.window_minutes;
      return { startMinutes, endMinutes: cumulative };
    });
  }, [blocks]);

  const totalUsed = blocks.reduce((sum, b) => sum + b.window_minutes, 0);
  const totalEstimated = blocks.reduce((sum, b) => sum + (b.estimated_minutes ?? b.window_minutes), 0);
  const remaining = project.total_minutes - totalUsed;

  // ── Drag handlers ──────────────────────────────────────────────────────

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex) {
      reorderBlocks(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* ── Left Panel: Timeline ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Info Bar */}
        <InfoBar
          totalMinutes={project.total_minutes}
          usedMinutes={totalUsed}
          remaining={remaining}
          startTime={project.start_time}
          endTime={formatMinutesToTime(project.total_minutes, project.start_time)}
        />

        {/* Block Palette */}
        <BlockPalette onAddBlock={(type) => addBlock(type)} />

        {/* Block List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          {blocks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Plus size={32} className="mb-3 opacity-40" />
              <p className="text-sm">Add blocks from the palette above to build your training timeline.</p>
            </div>
          )}

          {blocks.map((block, index) => (
            <BlockCard
              key={block.id}
              block={block}
              index={index}
              isSelected={block.id === selectedBlockId}
              clockTime={formatMinutesToTime(cumulativeTimes[index].startMinutes, project.start_time)}
              isDragOver={dragOverIndex === index}
              isDragging={dragIndex === index}
              onSelect={() => selectBlock(block.id === selectedBlockId ? null : block.id)}
              onRemove={() => removeBlock(block.id)}
              onUpdateTitle={(title) => updateBlock(block.id, { title })}
              onUpdateWindow={(window_minutes) => updateBlock(block.id, { window_minutes })}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            />
          ))}

          {/* Summary */}
          {blocks.length > 0 && (
            <TimelineSummary
              totalScheduled={totalUsed}
              totalEstimated={totalEstimated}
              totalMinutes={project.total_minutes}
              endTime={formatMinutesToTime(totalUsed, project.start_time)}
            />
          )}
        </div>
      </div>

      {/* ── Right Panel: Block Detail ────────────────────────────────────── */}
      <div className="w-96 border-l border-slate-700/60 bg-slate-900/50 flex-shrink-0 overflow-y-auto">
        {selectedBlockId ? (
          <BlockDetailPanel
            blockId={selectedBlockId}
            project={project}
            onClose={() => selectBlock(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 px-6">
            <ChevronRight size={32} className="mb-3 opacity-40" />
            <p className="text-sm text-center">Select a block from the timeline to view and edit its details.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// INFO BAR
// ════════════════════════════════════════════════════════════════════════════

function InfoBar({
  totalMinutes,
  usedMinutes,
  remaining,
  startTime,
  endTime,
}: {
  totalMinutes: number;
  usedMinutes: number;
  remaining: number;
  startTime: string;
  endTime: string;
}) {
  const usedPercent = totalMinutes > 0 ? Math.min((usedMinutes / totalMinutes) * 100, 100) : 0;
  const isOver = remaining < 0;

  return (
    <div className="flex-shrink-0 px-4 py-3 bg-slate-800/60 border-b border-slate-700/50">
      <div className="flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Timer size={14} />
          <span>Total: <span className="text-slate-200 font-medium">{totalMinutes} min</span></span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Clock size={14} />
          <span>Used: <span className="text-slate-200 font-medium">{usedMinutes} min</span></span>
        </div>
        <div className={`flex items-center gap-1.5 ${isOver ? 'text-red-400' : 'text-slate-400'}`}>
          {isOver ? <AlertTriangle size={14} /> : <Clock size={14} />}
          <span>
            Remaining:{' '}
            <span className={`font-medium ${isOver ? 'text-red-300' : 'text-slate-200'}`}>
              {remaining} min
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <span>{startTime}</span>
          <ChevronRight size={12} />
          <span className="text-slate-200 font-medium">{endTime}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isOver ? 'bg-red-500' : usedPercent > 90 ? 'bg-amber-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(usedPercent, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// BLOCK PALETTE
// ════════════════════════════════════════════════════════════════════════════

function BlockPalette({ onAddBlock }: { onAddBlock: (type: BlockType) => void }) {
  return (
    <div className="flex-shrink-0 px-4 py-2.5 border-b border-slate-700/50 bg-slate-800/30">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1">Add:</span>
        {ALL_BLOCK_TYPES.map((type) => {
          const meta = BLOCK_TYPE_META[type];
          return (
            <button
              key={type}
              onClick={() => onAddBlock(type)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium
                         bg-slate-700/50 hover:bg-slate-600/60 text-slate-300 hover:text-white
                         transition-colors duration-100 cursor-pointer border border-transparent
                         hover:border-slate-500/40"
              title={`Add ${meta.label}`}
            >
              <BlockIcon type={type} size={12} />
              <span className="hidden xl:inline">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// BLOCK CARD
// ════════════════════════════════════════════════════════════════════════════

function BlockCard({
  block,
  index: _index,
  isSelected,
  clockTime,
  isDragOver,
  isDragging,
  onSelect,
  onRemove,
  onUpdateTitle,
  onUpdateWindow,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  block: AgendaBlock;
  index: number;
  isSelected: boolean;
  clockTime: string;
  isDragOver: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateWindow: (minutes: number) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const meta = BLOCK_TYPE_META[block.type];
  const fits = block.fits_in_window ?? true;
  const estimated = block.estimated_minutes ?? block.window_minutes;
  const energy = getEnergyLevel(block.type);
  const exercise = block.exercise_id ? getExerciseById(block.exercise_id) : undefined;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`
        group relative flex items-stretch rounded-lg cursor-pointer
        transition-all duration-150 border
        ${isDragOver ? 'border-t-2 border-t-blue-400 border-blue-400/30' : 'border-transparent'}
        ${isDragging ? 'opacity-40 scale-[0.98]' : 'opacity-100'}
        ${isSelected
          ? 'bg-slate-700/60 ring-1 ring-blue-500/50 border-blue-500/30'
          : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/30 hover:border-slate-600/50'
        }
      `}
    >
      {/* Color bar */}
      <div
        className="w-1.5 flex-shrink-0 rounded-l-lg"
        style={{ backgroundColor: meta.color }}
      />

      {/* Drag handle */}
      <div
        className="flex items-center px-1.5 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center gap-3 py-2.5 pr-2 min-w-0">
        {/* Icon + title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <BlockIcon type={block.type} size={14} className="flex-shrink-0 text-slate-400" />
            <input
              type="text"
              value={block.title}
              onChange={(e) => onUpdateTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent text-sm font-medium text-slate-200 w-full truncate
                         outline-none border-b border-transparent focus:border-slate-500
                         hover:border-slate-600/50 transition-colors"
            />
          </div>
          {exercise && (
            <div className="mt-0.5 text-[11px] text-slate-500 truncate pl-[22px]">
              {exercise.title}
            </div>
          )}
        </div>

        {/* Time window input */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <input
            type="number"
            min={1}
            max={480}
            value={block.window_minutes}
            onChange={(e) => onUpdateWindow(Math.max(1, parseInt(e.target.value) || 1))}
            onClick={(e) => e.stopPropagation()}
            className="w-12 bg-slate-700/50 border border-slate-600/50 rounded px-1.5 py-0.5
                       text-xs text-center text-slate-200 outline-none
                       focus:border-blue-500/50 transition-colors"
          />
          <span className="text-[10px] text-slate-500">min</span>
        </div>

        {/* Estimated badge */}
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium flex-shrink-0 ${
            fits
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
          title={`Estimated: ${estimated.toFixed(1)} min`}
        >
          {fits ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
          <span>{estimated.toFixed(0)}m</span>
        </div>

        {/* Clock time */}
        <div className="flex items-center gap-1 text-[11px] text-slate-500 flex-shrink-0 font-mono">
          <Clock size={10} />
          {clockTime}
        </div>

        {/* Energy dot */}
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${getEnergyColor(energy)}`}
          title={`Energy: ${energy}`}
        />

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10
                     opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          title="Remove block"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TIMELINE SUMMARY
// ════════════════════════════════════════════════════════════════════════════

function TimelineSummary({
  totalScheduled,
  totalEstimated,
  totalMinutes,
  endTime,
}: {
  totalScheduled: number;
  totalEstimated: number;
  totalMinutes: number;
  endTime: string;
}) {
  const overScheduled = totalScheduled > totalMinutes;
  const estimateWarning = totalEstimated > totalScheduled;

  return (
    <div className="mt-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">Scheduled</span>
        <span className={`font-medium ${overScheduled ? 'text-red-400' : 'text-slate-200'}`}>
          {totalScheduled} / {totalMinutes} min
        </span>
      </div>
      <div className="flex items-center justify-between text-xs mt-1">
        <span className="text-slate-400">Estimated total</span>
        <span className={`font-medium ${estimateWarning ? 'text-amber-400' : 'text-slate-200'}`}>
          {totalEstimated.toFixed(0)} min
        </span>
      </div>
      <div className="flex items-center justify-between text-xs mt-1">
        <span className="text-slate-400">Ends at</span>
        <span className="font-medium text-slate-200 font-mono">{endTime}</span>
      </div>

      {overScheduled && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1.5">
          <AlertTriangle size={12} />
          <span>Scheduled time exceeds total training time by {totalScheduled - totalMinutes} min.</span>
        </div>
      )}
      {estimateWarning && !overScheduled && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
          <AlertTriangle size={12} />
          <span>
            Estimated time ({totalEstimated.toFixed(0)} min) exceeds scheduled windows ({totalScheduled} min).
            Some blocks may run over.
          </span>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// BLOCK DETAIL PANEL
// ════════════════════════════════════════════════════════════════════════════

function BlockDetailPanel({
  blockId,
  project,
  onClose,
}: {
  blockId: string;
  project: NonNullable<ReturnType<typeof useProjectStore.getState>['project']>;
  onClose: () => void;
}) {
  const updateBlock = useProjectStore((s) => s.updateBlock);
  const assignExercise = useProjectStore((s) => s.assignExercise);

  const block = project.blocks.find((b) => b.id === blockId);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);

  if (!block) {
    return (
      <div className="p-4 text-slate-500 text-sm">Block not found.</div>
    );
  }

  const meta = BLOCK_TYPE_META[block.type];
  const exercise = block.exercise_id ? getExerciseById(block.exercise_id) : undefined;

  // Time estimate breakdown
  const estimate = block.type === 'break'
    ? {
        base_minutes: block.window_minutes,
        experience_modifier_minutes: 0,
        overhead_minutes: 0,
        interaction_minutes: 0,
        total_minutes: block.window_minutes,
      }
    : estimateBlockTime({
        base_minutes: block.window_minutes,
        experience_level: project.experience_level,
        participant_count: project.participant_count,
        method: block.type,
        room_template: project.room.template,
        question_config: block.question_config,
      });

  const fits = estimate.total_minutes <= block.window_minutes;

  const handleGetRecommendations = () => {
    const results = getRecommendations(
      block,
      project.room,
      project.participant_count,
      project.experience_level,
    );
    setRecommendations(results);
    setShowRecommendations(true);
  };

  const handleAssignExercise = (exerciseId: string) => {
    assignExercise(block.id, exerciseId);
    setShowRecommendations(false);
    setRecommendations([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: meta.color }} />
          <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
            Block Detail
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700/50
                     transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5">
          {/* ── Title ──────────────────────────────────────────────────── */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Title</label>
            <input
              type="text"
              value={block.title}
              onChange={(e) => updateBlock(block.id, { title: e.target.value })}
              className="w-full bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2
                         text-sm text-slate-200 outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          {/* ── Type (read-only) ───────────────────────────────────────── */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Type</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/30 rounded-lg border border-slate-700/30">
              <BlockIcon type={block.type} size={14} className="text-slate-400" />
              <span className="text-sm text-slate-300">{meta.label}</span>
            </div>
          </div>

          {/* ── Window minutes ─────────────────────────────────────────── */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">
              Time Window (minutes)
            </label>
            <input
              type="number"
              min={1}
              max={480}
              value={block.window_minutes}
              onChange={(e) =>
                updateBlock(block.id, { window_minutes: Math.max(1, parseInt(e.target.value) || 1) })
              }
              className="w-full bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2
                         text-sm text-slate-200 outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          {/* ── Estimated time breakdown ───────────────────────────────── */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-2">
              Time Estimate Breakdown
            </label>
            <div className="bg-slate-800/40 rounded-lg border border-slate-700/30 p-3 space-y-1.5 text-xs">
              <EstimateRow label="Base" value={estimate.base_minutes} />
              <EstimateRow label="Overhead" value={estimate.overhead_minutes} />
              <EstimateRow label="Experience modifier" value={estimate.experience_modifier_minutes} />
              <EstimateRow label="Interaction" value={estimate.interaction_minutes} />
              <div className="border-t border-slate-700/40 pt-1.5 mt-1.5">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-slate-300">Total estimated</span>
                  <span className={fits ? 'text-green-400' : 'text-red-400'}>
                    {estimate.total_minutes.toFixed(1)} min
                  </span>
                </div>
              </div>
            </div>

            {/* Fit status */}
            <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              fits
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {fits ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              <span>
                {fits
                  ? `Fits within ${block.window_minutes} min window (${(block.window_minutes - estimate.total_minutes).toFixed(1)} min buffer)`
                  : `Exceeds window by ${(estimate.total_minutes - block.window_minutes).toFixed(1)} min`
                }
              </span>
            </div>
          </div>

          {/* ── Question Config (opening_questions only) ───────────────── */}
          {block.type === 'opening_questions' && (
            <QuestionConfigEditor
              block={block}
              participantCount={project.participant_count}
              onUpdate={(data) => updateBlock(block.id, data)}
            />
          )}

          {/* ── Exercise Assignment ────────────────────────────────────── */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-2">
              Exercise Assignment
            </label>

            {exercise ? (
              <div className="bg-slate-800/40 rounded-lg border border-slate-700/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={14} className="text-blue-400" />
                  <span className="text-sm font-medium text-slate-200">{exercise.title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">{exercise.description}</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>{exercise.time_range_min}-{exercise.time_range_max} min</span>
                  <span>|</span>
                  <span>{exercise.participant_range_min}-{exercise.participant_range_max} participants</span>
                  <span>|</span>
                  <span className="capitalize">{exercise.dynamics} energy</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic mb-2">No exercise assigned.</div>
            )}

            <button
              onClick={handleGetRecommendations}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                         bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium
                         border border-blue-500/20 hover:border-blue-500/40 transition-colors cursor-pointer"
            >
              <Sparkles size={12} />
              Get Recommendations
            </button>

            {/* Recommendations list */}
            {showRecommendations && (
              <RecommendationsList
                recommendations={recommendations}
                onAssign={handleAssignExercise}
                onClose={() => setShowRecommendations(false)}
              />
            )}
          </div>

          {/* ── Facilitator Notes ──────────────────────────────────────── */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 mb-1">
              <StickyNote size={11} />
              Facilitator Notes
            </label>
            <textarea
              value={block.facilitator_notes}
              onChange={(e) => updateBlock(block.id, { facilitator_notes: e.target.value })}
              rows={4}
              placeholder="Notes for the facilitator..."
              className="w-full bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2
                         text-sm text-slate-200 outline-none focus:border-blue-500/50 transition-colors
                         resize-y min-h-[60px] placeholder:text-slate-600"
            />
          </div>

          {/* ── Materials ──────────────────────────────────────────────── */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 mb-1">
              <FileText size={11} />
              Materials
            </label>
            <textarea
              value={block.materials}
              onChange={(e) => updateBlock(block.id, { materials: e.target.value })}
              rows={2}
              placeholder="Required materials, handouts, props..."
              className="w-full bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2
                         text-sm text-slate-200 outline-none focus:border-blue-500/50 transition-colors
                         resize-y min-h-[40px] placeholder:text-slate-600"
            />
          </div>

          {/* ── Workbook Link ──────────────────────────────────────────── */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 mb-1">
              <Link size={11} />
              Workbook Link
            </label>
            <input
              type="text"
              value={block.workbook_link}
              onChange={(e) => updateBlock(block.id, { workbook_link: e.target.value })}
              placeholder="https://..."
              className="w-full bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2
                         text-sm text-slate-200 outline-none focus:border-blue-500/50 transition-colors
                         placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Estimate Row helper ────────────────────────────────────────────────────

function EstimateRow({ label, value }: { label: string; value: number }) {
  const sign = value >= 0 ? '+' : '';
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-300 font-mono">
        {sign}{value.toFixed(1)} min
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// QUESTION CONFIG EDITOR
// ════════════════════════════════════════════════════════════════════════════

function QuestionConfigEditor({
  block,
  participantCount,
  onUpdate,
}: {
  block: AgendaBlock;
  participantCount: number;
  onUpdate: (data: Partial<AgendaBlock>) => void;
}) {
  const config = block.question_config ?? defaultQuestionConfig();

  const updateConfig = (patch: Partial<QuestionConfig>) => {
    onUpdate({ question_config: { ...config, ...patch } });
  };

  const suggestedCount = getSuggestedQuestionCount(
    participantCount,
    config.persons_per_question,
    config.questions_per_group,
  );

  // Estimate interaction time for the question config
  const interactionSeconds =
    Math.max(suggestedCount, config.questions.length) *
    (config.seconds_per_question_prompt +
      config.expected_answers_per_question * config.seconds_per_answer);
  const interactionMinutes = interactionSeconds / 60;
  const exceedsWindow = interactionMinutes > block.window_minutes;

  const addQuestion = () => {
    updateConfig({ questions: [...config.questions, ''] });
  };

  const removeQuestion = (index: number) => {
    const updated = config.questions.filter((_, i) => i !== index);
    updateConfig({ questions: updated });
  };

  const updateQuestion = (index: number, value: string) => {
    const updated = config.questions.map((q, i) => (i === index ? value : q));
    updateConfig({ questions: updated });
  };

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 mb-2">
        <HelpCircle size={11} />
        Question Configuration
      </label>

      <div className="bg-slate-800/40 rounded-lg border border-slate-700/30 p-3 space-y-3">
        {/* Questions list */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">Questions</span>
            <button
              onClick={addQuestion}
              className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300
                         cursor-pointer transition-colors"
            >
              <Plus size={11} />
              Add
            </button>
          </div>

          {config.questions.length === 0 && (
            <p className="text-[11px] text-slate-600 italic">No questions added yet.</p>
          )}

          <div className="space-y-1.5">
            {config.questions.map((question, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-600 w-4 text-right flex-shrink-0">{i + 1}.</span>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => updateQuestion(i, e.target.value)}
                  placeholder={`Question ${i + 1}...`}
                  className="flex-1 bg-slate-700/50 border border-slate-600/40 rounded px-2 py-1
                             text-xs text-slate-200 outline-none focus:border-blue-500/50
                             placeholder:text-slate-600 transition-colors"
                />
                <button
                  onClick={() => removeQuestion(i)}
                  className="p-0.5 rounded text-slate-600 hover:text-red-400 cursor-pointer transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Config fields */}
        <div className="grid grid-cols-2 gap-2">
          <ConfigField
            label="Persons per question"
            value={config.persons_per_question}
            onChange={(v) => updateConfig({ persons_per_question: v })}
          />
          <ConfigField
            label="Questions per group"
            value={config.questions_per_group}
            onChange={(v) => updateConfig({ questions_per_group: v })}
          />
          <ConfigField
            label="Seconds per prompt"
            value={config.seconds_per_question_prompt}
            onChange={(v) => updateConfig({ seconds_per_question_prompt: v })}
          />
          <ConfigField
            label="Seconds per answer"
            value={config.seconds_per_answer}
            onChange={(v) => updateConfig({ seconds_per_answer: v })}
          />
          <ConfigField
            label="Expected answers/question"
            value={config.expected_answers_per_question}
            onChange={(v) => updateConfig({ expected_answers_per_question: v })}
          />
        </div>

        {/* Suggested count */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700/30">
          <span className="text-slate-400">Suggested question count</span>
          <span className="text-slate-200 font-medium">{suggestedCount}</span>
        </div>

        {/* Warning */}
        {exceedsWindow && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
            <AlertTriangle size={12} />
            <span>
              Estimated Q&A time ({interactionMinutes.toFixed(1)} min) exceeds the {block.window_minutes} min window.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Config field helper ────────────────────────────────────────────────────

function ConfigField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] text-slate-500 mb-0.5 truncate" title={label}>
        {label}
      </label>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value) || 1))}
        className="w-full bg-slate-700/50 border border-slate-600/40 rounded px-2 py-1
                   text-xs text-slate-200 outline-none focus:border-blue-500/50 transition-colors"
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS LIST
// ════════════════════════════════════════════════════════════════════════════

function RecommendationsList({
  recommendations,
  onAssign,
  onClose,
}: {
  recommendations: Recommendation[];
  onAssign: (exerciseId: string) => void;
  onClose: () => void;
}) {
  if (recommendations.length === 0) {
    return (
      <div className="mt-2 p-3 bg-slate-800/40 rounded-lg border border-slate-700/30">
        <p className="text-xs text-slate-500">
          No matching exercises found for this block type, participant count, and room setup.
        </p>
        <button
          onClick={onClose}
          className="mt-2 text-[11px] text-slate-400 hover:text-slate-300 cursor-pointer transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  const mainPicks = recommendations.slice(0, 3);
  const rescuePicks = recommendations.slice(3);

  return (
    <div className="mt-2 space-y-1.5">
      {/* Main recommendations */}
      {mainPicks.length > 0 && (
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Top picks</span>
          <div className="mt-1 space-y-1.5">
            {mainPicks.map((rec) => (
              <RecommendationCard key={rec.exercise.id} rec={rec} onAssign={onAssign} />
            ))}
          </div>
        </div>
      )}

      {/* Rescue alternatives */}
      {rescuePicks.length > 0 && (
        <div className="pt-1">
          <span className="text-[10px] uppercase tracking-wider text-amber-500">Rescue alternatives</span>
          <div className="mt-1 space-y-1.5">
            {rescuePicks.map((rec) => (
              <RecommendationCard key={rec.exercise.id} rec={rec} onAssign={onAssign} variant="rescue" />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full text-center text-[11px] text-slate-500 hover:text-slate-400
                   cursor-pointer transition-colors pt-1"
      >
        Close recommendations
      </button>
    </div>
  );
}

function RecommendationCard({
  rec,
  onAssign,
  variant = 'main',
}: {
  rec: Recommendation;
  onAssign: (exerciseId: string) => void;
  variant?: 'main' | 'rescue';
}) {
  const borderColor = variant === 'rescue' ? 'border-amber-500/20' : 'border-slate-700/30';

  return (
    <div className={`bg-slate-800/40 rounded-lg border ${borderColor} p-2.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-slate-200 truncate">{rec.exercise.title}</div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
            <span>{rec.estimated_minutes.toFixed(0)} min</span>
            <span>|</span>
            <span>Score: {(rec.fit_score * 100).toFixed(0)}%</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{rec.reason}</p>
        </div>
        <button
          onClick={() => onAssign(rec.exercise.id)}
          className="flex-shrink-0 px-2.5 py-1 rounded text-[11px] font-medium
                     bg-blue-600/20 hover:bg-blue-600/30 text-blue-400
                     border border-blue-500/20 hover:border-blue-500/40
                     transition-colors cursor-pointer"
        >
          Assign
        </button>
      </div>
    </div>
  );
}
