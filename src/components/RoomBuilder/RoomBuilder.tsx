import { useState, useCallback } from 'react';
import {
  LayoutGrid,
  Monitor,
  Square,
  Circle,
  Presentation,
  Crosshair,
  BoxSelect,
  Trash2,
  RotateCw,
  Plus,
  Armchair,
  Users,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import RoomCanvas from '../../room/RoomCanvas';
import type { RoomTemplate, RoomObjectType } from '../../model/types';
import Button from '../shared/Button';

// ── Template config ──────────────────────────────────────────────────────────

interface TemplateOption {
  value: RoomTemplate;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TEMPLATES: TemplateOption[] = [
  {
    value: 'horseshoe_tables',
    label: 'Horseshoe + Tables',
    description: 'U-shape with tables',
    icon: <LayoutGrid size={20} />,
  },
  {
    value: 'horseshoe_no_tables',
    label: 'Horseshoe (no tables)',
    description: 'U-shape, chairs only',
    icon: <Armchair size={20} />,
  },
  {
    value: 'lecture_20plus',
    label: 'Lecture Hall 20+',
    description: 'Rows facing screen',
    icon: <Users size={20} />,
  },
];

// ── Object add palette ───────────────────────────────────────────────────────

interface AddObjectOption {
  type: RoomObjectType;
  label: string;
  icon: React.ReactNode;
  defaultWidth: number;
  defaultHeight: number;
}

const ADD_OBJECTS: AddObjectOption[] = [
  { type: 'table',            label: 'Table',      icon: <Square size={14} />,        defaultWidth: 80, defaultHeight: 40 },
  { type: 'chair',            label: 'Chair',      icon: <Circle size={14} />,        defaultWidth: 20, defaultHeight: 20 },
  { type: 'flipchart',        label: 'Flipchart',  icon: <Presentation size={14} />,  defaultWidth: 30, defaultHeight: 50 },
  { type: 'screen',           label: 'Screen',     icon: <Monitor size={14} />,       defaultWidth: 120, defaultHeight: 10 },
  { type: 'zone',             label: 'Zone',       icon: <BoxSelect size={14} />,     defaultWidth: 150, defaultHeight: 100 },
  { type: 'facilitator_spot', label: 'Facilitator', icon: <Crosshair size={14} />,    defaultWidth: 30, defaultHeight: 30 },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function RoomBuilder() {
  const project = useProjectStore((s) => s.project);
  const applyRoomTemplate = useProjectStore((s) => s.applyRoomTemplate);
  const updateRoom = useProjectStore((s) => s.updateRoom);
  const addRoomObject = useProjectStore((s) => s.addRoomObject);
  const updateRoomObject = useProjectStore((s) => s.updateRoomObject);
  const removeRoomObject = useProjectStore((s) => s.removeRoomObject);

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const room = project?.room;
  const participantCount = project?.participant_count ?? 12;

  // Selected object data
  const selectedObject = room?.objects.find((o) => o.id === selectedObjectId) ?? null;

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleTemplateChange = useCallback(
    (template: RoomTemplate) => {
      applyRoomTemplate(template, participantCount);
      setSelectedObjectId(null);
    },
    [applyRoomTemplate, participantCount],
  );

  const handleDimensionChange = useCallback(
    (key: 'width' | 'height', value: number) => {
      if (value < 200 || value > 2000) return;
      updateRoom({ [key]: value });
    },
    [updateRoom],
  );

  const handleFlipchartCountChange = useCallback(
    (value: number) => {
      if (value < 0 || value > 10) return;
      updateRoom({ flipchart_count: value });
    },
    [updateRoom],
  );

  const handleHasScreenChange = useCallback(
    (checked: boolean) => {
      updateRoom({ has_screen: checked });
    },
    [updateRoom],
  );

  const handleAddObject = useCallback(
    (opt: AddObjectOption) => {
      if (!room) return;
      addRoomObject({
        type: opt.type,
        x: room.width / 2 - opt.defaultWidth / 2,
        y: room.height / 2 - opt.defaultHeight / 2,
        width: opt.defaultWidth,
        height: opt.defaultHeight,
        rotation: 0,
        label: opt.type === 'zone' ? 'Zone' : undefined,
      });
    },
    [room, addRoomObject],
  );

  const handleMoveObject = useCallback(
    (id: string, x: number, y: number) => {
      updateRoomObject(id, { x: Math.round(x), y: Math.round(y) });
    },
    [updateRoomObject],
  );

  const handleObjectFieldChange = useCallback(
    (field: string, value: number | string) => {
      if (!selectedObjectId) return;
      updateRoomObject(selectedObjectId, { [field]: value });
    },
    [selectedObjectId, updateRoomObject],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedObjectId) return;
    removeRoomObject(selectedObjectId);
    setSelectedObjectId(null);
  }, [selectedObjectId, removeRoomObject]);

  // ── Guard ──────────────────────────────────────────────────────────────

  if (!project || !room) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        No project loaded. Create or open a project first.
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-slate-900 text-slate-100">
      {/* ── Left Sidebar ──────────────────────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 border-r border-slate-700 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Template Selector */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Room Template
            </h3>
            <div className="space-y-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleTemplateChange(t.value)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
                    ${
                      room.template === t.value
                        ? 'bg-blue-600/20 border border-blue-500/40 text-blue-300'
                        : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-750'
                    }
                  `}
                >
                  <span className="text-slate-400">{t.icon}</span>
                  <div>
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-slate-500">{t.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Dimensions */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Room Dimensions
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Width</span>
                <input
                  type="number"
                  value={room.width}
                  onChange={(e) => handleDimensionChange('width', Number(e.target.value))}
                  min={200}
                  max={2000}
                  step={50}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-800 border border-slate-700
                    text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500
                    focus:border-blue-500"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Height</span>
                <input
                  type="number"
                  value={room.height}
                  onChange={(e) => handleDimensionChange('height', Number(e.target.value))}
                  min={200}
                  max={2000}
                  step={50}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-800 border border-slate-700
                    text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500
                    focus:border-blue-500"
                />
              </label>
            </div>
          </section>

          {/* Flipchart & Screen */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Equipment
            </h3>
            <label className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-300">Flipcharts</span>
              <input
                type="number"
                value={room.flipchart_count}
                onChange={(e) => handleFlipchartCountChange(Number(e.target.value))}
                min={0}
                max={10}
                className="w-16 px-2 py-1 rounded-md bg-slate-800 border border-slate-700
                  text-sm text-slate-200 text-center focus:outline-none focus:ring-1
                  focus:ring-blue-500 focus:border-blue-500"
              />
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={room.has_screen}
                onChange={(e) => handleHasScreenChange(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-blue-500
                  focus:ring-blue-500 focus:ring-offset-0 cursor-pointer accent-blue-500"
              />
              <span className="text-sm text-slate-300">Has screen / projector</span>
            </label>
          </section>

          {/* Add Objects */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Add Object
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {ADD_OBJECTS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => handleAddObject(opt)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border
                    border-slate-700 text-sm text-slate-300 hover:bg-slate-750
                    hover:border-slate-600 transition-all"
                >
                  <Plus size={10} className="text-slate-500" />
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Selected Object Properties */}
          {selectedObject && (
            <section className="border-t border-slate-700 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Object Properties
              </h3>
              <div className="space-y-3">
                {/* Type badge */}
                <div className="text-xs text-slate-500">
                  Type:{' '}
                  <span className="text-slate-300 font-medium">
                    {selectedObject.type.replace('_', ' ')}
                  </span>
                </div>

                {/* Position */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-xs text-slate-500">X</span>
                    <input
                      type="number"
                      value={Math.round(selectedObject.x)}
                      onChange={(e) =>
                        handleObjectFieldChange('x', Number(e.target.value))
                      }
                      className="w-full px-2 py-1 rounded-md bg-slate-800 border border-slate-700
                        text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-slate-500">Y</span>
                    <input
                      type="number"
                      value={Math.round(selectedObject.y)}
                      onChange={(e) =>
                        handleObjectFieldChange('y', Number(e.target.value))
                      }
                      className="w-full px-2 py-1 rounded-md bg-slate-800 border border-slate-700
                        text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>

                {/* Size */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-xs text-slate-500">Width</span>
                    <input
                      type="number"
                      value={selectedObject.width}
                      onChange={(e) =>
                        handleObjectFieldChange('width', Number(e.target.value))
                      }
                      min={5}
                      className="w-full px-2 py-1 rounded-md bg-slate-800 border border-slate-700
                        text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-slate-500">Height</span>
                    <input
                      type="number"
                      value={selectedObject.height}
                      onChange={(e) =>
                        handleObjectFieldChange('height', Number(e.target.value))
                      }
                      min={5}
                      className="w-full px-2 py-1 rounded-md bg-slate-800 border border-slate-700
                        text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>

                {/* Rotation */}
                <label className="space-y-1 block">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Rotation</span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {selectedObject.rotation}°
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RotateCw size={12} className="text-slate-500 flex-shrink-0" />
                    <input
                      type="range"
                      value={selectedObject.rotation}
                      onChange={(e) =>
                        handleObjectFieldChange('rotation', Number(e.target.value))
                      }
                      min={0}
                      max={360}
                      step={5}
                      className="w-full h-1.5 rounded-full bg-slate-700 appearance-none cursor-pointer
                        accent-blue-500"
                    />
                  </div>
                </label>

                {/* Label */}
                <label className="space-y-1 block">
                  <span className="text-xs text-slate-500">Label</span>
                  <input
                    type="text"
                    value={selectedObject.label ?? ''}
                    onChange={(e) =>
                      handleObjectFieldChange('label', e.target.value)
                    }
                    placeholder="Optional label"
                    className="w-full px-2 py-1 rounded-md bg-slate-800 border border-slate-700
                      text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none
                      focus:ring-1 focus:ring-blue-500"
                  />
                </label>

                {/* Delete */}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeleteSelected}
                  className="w-full mt-2"
                >
                  <Trash2 size={14} />
                  Delete Object
                </Button>
              </div>
            </section>
          )}
        </div>
      </aside>

      {/* ── Main Canvas Area ──────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar with info */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-slate-200">Room Layout</h2>
            <span className="text-xs text-slate-500">
              {room.width} x {room.height} &middot; {room.objects.length} objects &middot;{' '}
              {participantCount} participants
            </span>
          </div>
          <div className="text-xs text-slate-600">
            Click to select &middot; Drag to move
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 min-h-0">
          <RoomCanvas
            room={room}
            participantCount={participantCount}
            selectedObjectId={selectedObjectId}
            onSelectObject={setSelectedObjectId}
            onMoveObject={handleMoveObject}
            interactive
            showParticipants
          />
        </div>
      </main>
    </div>
  );
}
