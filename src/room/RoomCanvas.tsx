import { useEffect, useRef, useCallback } from 'react';
import type { RoomLayout, RoomObject, RoomObjectType } from '../model/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface ParticipantPosition {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

interface RoomCanvasProps {
  room: RoomLayout;
  participantCount: number;
  selectedObjectId?: string | null;
  onSelectObject?: (id: string | null) => void;
  onMoveObject?: (id: string, x: number, y: number) => void;
  interactive?: boolean;
  showParticipants?: boolean;
  participantPositions?: ParticipantPosition[];
  width?: number;
  height?: number;
}

// ── Color palette ────────────────────────────────────────────────────────────

const COLORS: Record<RoomObjectType, { fill: string; stroke: string }> = {
  table:            { fill: '#8B7355', stroke: '#6B5840' },
  chair:            { fill: '#555555', stroke: '#3a3a3a' },
  flipchart:        { fill: '#666666', stroke: '#4a4a4a' },
  screen:           { fill: '#333333', stroke: '#1a1a1a' },
  projector:        { fill: '#444444', stroke: '#2a2a2a' },
  facilitator_spot: { fill: '#3b82f6', stroke: '#2563eb' },
  zone:             { fill: 'rgba(100, 160, 255, 0.08)', stroke: 'rgba(100, 160, 255, 0.4)' },
};

const FLOOR_COLOR = '#f0f0f0';
const FLOOR_BORDER = '#c8c8c8';
const GRID_COLOR = '#e2e2e2';
const SELECTION_COLOR = '#3b82f6';
const PARTICIPANT_COLOR = '#f59e0b';
const PARTICIPANT_STROKE = '#d97706';
const LABEL_FONT = '10px Inter, system-ui, sans-serif';
const PARTICIPANT_FONT = 'bold 9px Inter, system-ui, sans-serif';

// ── Drag state (kept outside React state to avoid re-renders) ────────────────

interface DragState {
  active: boolean;
  objectId: string | null;
  startMouseX: number;
  startMouseY: number;
  startObjX: number;
  startObjY: number;
}

// ── Drawing helpers ──────────────────────────────────────────────────────────

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawTable(ctx: CanvasRenderingContext2D, obj: RoomObject) {
  const { x, y, width, height, label } = obj;
  const c = COLORS.table;

  // Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  roundedRect(ctx, x, y, width, height, 4);
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.restore();

  // Border
  roundedRect(ctx, x, y, width, height, 4);
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Wood grain effect (subtle lines)
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 4; i++) {
    const ly = y + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x + 3, ly);
    ctx.lineTo(x + width - 3, ly);
    ctx.stroke();
  }
  ctx.restore();

  // Label
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + height / 2, width - 6);
  }
}

function drawChair(ctx: CanvasRenderingContext2D, obj: RoomObject) {
  const { x, y, width, height } = obj;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const r = Math.min(width, height) / 2;
  const c = COLORS.chair;

  // Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  // Outer circle (seat)
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  // 3D highlight (top-left crescent)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx - r * 0.15, cy - r * 0.15, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  ctx.restore();
}

function drawFlipchart(ctx: CanvasRenderingContext2D, obj: RoomObject) {
  const { x, y, width, height, label } = obj;
  const c = COLORS.flipchart;

  // Stand (legs)
  ctx.save();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.3, y + height);
  ctx.lineTo(x + width * 0.15, y + height + 8);
  ctx.moveTo(x + width * 0.7, y + height);
  ctx.lineTo(x + width * 0.85, y + height + 8);
  ctx.stroke();
  ctx.restore();

  // Frame
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;
  roundedRect(ctx, x, y, width, height, 2);
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.restore();

  roundedRect(ctx, x, y, width, height, 2);
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // White paper area
  const paperMargin = 3;
  roundedRect(
    ctx,
    x + paperMargin,
    y + paperMargin,
    width - paperMargin * 2,
    height * 0.7,
    1,
  );
  ctx.fillStyle = '#f8f8f0';
  ctx.fill();
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Faint "lines" on paper
  ctx.save();
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 0.3;
  for (let i = 1; i <= 3; i++) {
    const ly = y + paperMargin + (height * 0.7 / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x + paperMargin + 2, ly);
    ctx.lineTo(x + width - paperMargin - 2, ly);
    ctx.stroke();
  }
  ctx.restore();

  // Label below
  if (label) {
    ctx.fillStyle = '#888';
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + width / 2, y + height + 10, width + 10);
  }
}

function drawScreen(ctx: CanvasRenderingContext2D, obj: RoomObject) {
  const { x, y, width, height, label } = obj;

  // Glow effect
  ctx.save();
  ctx.shadowColor = 'rgba(100, 180, 255, 0.25)';
  ctx.shadowBlur = 10;

  roundedRect(ctx, x, y, width, height, 2);
  ctx.fillStyle = COLORS.screen.fill;
  ctx.fill();
  ctx.restore();

  roundedRect(ctx, x, y, width, height, 2);
  ctx.strokeStyle = COLORS.screen.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Screen shine (gradient)
  const grad = ctx.createLinearGradient(x, y, x, y + height);
  grad.addColorStop(0, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  roundedRect(ctx, x + 1, y + 1, width - 2, height - 2, 1);
  ctx.fillStyle = grad;
  ctx.fill();

  if (label) {
    ctx.fillStyle = '#aaa';
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + width / 2, y + height + 4, width);
  }
}

function drawProjector(ctx: CanvasRenderingContext2D, obj: RoomObject) {
  const { x, y, width, height } = obj;
  const c = COLORS.projector;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 4;
  roundedRect(ctx, x, y, width, height, 3);
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.restore();

  roundedRect(ctx, x, y, width, height, 3);
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Lens dot
  ctx.beginPath();
  ctx.arc(x + width / 2, y + height / 2, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#aaa';
  ctx.fill();
}

function drawFacilitatorSpot(ctx: CanvasRenderingContext2D, obj: RoomObject) {
  const { x, y, width, height, label } = obj;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const r = Math.min(width, height) / 2;
  const c = COLORS.facilitator_spot;

  // Outer glow
  ctx.save();
  ctx.shadowColor = 'rgba(59, 130, 246, 0.35)';
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner highlight
  ctx.beginPath();
  ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();

  // "F" letter
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', cx, cy);

  if (label) {
    ctx.fillStyle = '#3b82f6';
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, cx, y + height + 4, width + 20);
  }
}

function drawZone(ctx: CanvasRenderingContext2D, obj: RoomObject) {
  const { x, y, width, height, label } = obj;
  const c = COLORS.zone;

  // Fill
  roundedRect(ctx, x, y, width, height, 6);
  ctx.fillStyle = c.fill;
  ctx.fill();

  // Dashed border
  ctx.save();
  ctx.setLineDash([6, 4]);
  roundedRect(ctx, x, y, width, height, 6);
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  if (label) {
    ctx.fillStyle = 'rgba(100, 160, 255, 0.6)';
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + width / 2, y + 4, width - 8);
  }
}

const DRAW_MAP: Record<RoomObjectType, (ctx: CanvasRenderingContext2D, obj: RoomObject) => void> = {
  table: drawTable,
  chair: drawChair,
  flipchart: drawFlipchart,
  screen: drawScreen,
  projector: drawProjector,
  facilitator_spot: drawFacilitatorSpot,
  zone: drawZone,
};

// ── Selection highlight ──────────────────────────────────────────────────────

function drawSelectionHighlight(ctx: CanvasRenderingContext2D, obj: RoomObject) {
  const pad = 4;
  const { x, y, width, height, type } = obj;

  ctx.save();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
  ctx.shadowBlur = 8;

  if (type === 'chair' || type === 'facilitator_spot') {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = Math.min(width, height) / 2 + pad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    roundedRect(ctx, x - pad, y - pad, width + pad * 2, height + pad * 2, 4);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Participant tokens ───────────────────────────────────────────────────────

function drawParticipantToken(
  ctx: CanvasRenderingContext2D,
  num: number,
  px: number,
  py: number,
) {
  const r = 8;

  ctx.save();
  ctx.shadowColor = 'rgba(245, 158, 11, 0.35)';
  ctx.shadowBlur = 5;

  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = PARTICIPANT_COLOR;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.strokeStyle = PARTICIPANT_STROKE;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Number
  ctx.fillStyle = '#fff';
  ctx.font = PARTICIPANT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), px, py + 0.5);
}

// ── Hit test ─────────────────────────────────────────────────────────────────

function hitTest(
  obj: RoomObject,
  mx: number,
  my: number,
): boolean {
  const { x, y, width, height, type } = obj;

  if (type === 'chair' || type === 'facilitator_spot') {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = Math.min(width, height) / 2 + 4;
    const dx = mx - cx;
    const dy = my - cy;
    return dx * dx + dy * dy <= r * r;
  }

  return mx >= x - 2 && mx <= x + width + 2 && my >= y - 2 && my <= y + height + 2;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RoomCanvas({
  room,
  participantCount,
  selectedObjectId = null,
  onSelectObject,
  onMoveObject,
  interactive = false,
  showParticipants = false,
  participantPositions,
  width: containerWidth,
  height: containerHeight,
}: RoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({
    active: false,
    objectId: null,
    startMouseX: 0,
    startMouseY: 0,
    startObjX: 0,
    startObjY: 0,
  });
  const animFrameRef = useRef<number>(0);

  // ── Coordinate conversion ──────────────────────────────────────────────

  const getScale = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };

    const cw = canvas.width / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);
    const rw = room.width;
    const rh = room.height;

    const scale = Math.min(cw / rw, ch / rh);
    const offsetX = (cw - rw * scale) / 2;
    const offsetY = (ch - rh * scale) / 2;

    return { scaleX: scale, scaleY: scale, offsetX, offsetY };
  }, [room.width, room.height]);

  const canvasToRoom = useCallback(
    (canvasX: number, canvasY: number) => {
      const { scaleX, scaleY, offsetX, offsetY } = getScale();
      return {
        x: (canvasX - offsetX) / scaleX,
        y: (canvasY - offsetY) / scaleY,
      };
    },
    [getScale],
  );

  // ── Draw ───────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    // Fill entire canvas bg (dark to match dark theme wrapper)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, cw, ch);

    const { scaleX, offsetX, offsetY } = getScale();

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scaleX, scaleX);

    // Room floor
    roundedRect(ctx, 0, 0, room.width, room.height, 8);
    ctx.fillStyle = FLOOR_COLOR;
    ctx.fill();
    ctx.strokeStyle = FLOOR_BORDER;
    ctx.lineWidth = 2 / scaleX;
    ctx.stroke();

    // Grid (subtle)
    ctx.save();
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5 / scaleX;
    const gridStep = 50;
    for (let gx = gridStep; gx < room.width; gx += gridStep) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, room.height);
      ctx.stroke();
    }
    for (let gy = gridStep; gy < room.height; gy += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(room.width, gy);
      ctx.stroke();
    }
    ctx.restore();

    // Draw objects — zones first (background), then rest
    const zones = room.objects.filter((o) => o.type === 'zone');
    const nonZones = room.objects.filter((o) => o.type !== 'zone');

    for (const obj of zones) {
      ctx.save();
      if (obj.rotation) {
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((obj.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }
      DRAW_MAP[obj.type](ctx, obj);
      if (selectedObjectId === obj.id) drawSelectionHighlight(ctx, obj);
      ctx.restore();
    }

    for (const obj of nonZones) {
      ctx.save();
      if (obj.rotation) {
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((obj.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }
      DRAW_MAP[obj.type](ctx, obj);
      if (selectedObjectId === obj.id) drawSelectionHighlight(ctx, obj);
      ctx.restore();
    }

    // Participants
    if (showParticipants && participantCount > 0) {
      if (participantPositions && participantPositions.length > 0) {
        // Use provided positions
        for (const pp of participantPositions) {
          drawParticipantToken(ctx, pp.id, pp.x, pp.y);
        }
      } else {
        // Auto-position near chairs
        const chairs = room.objects.filter((o) => o.type === 'chair');
        const count = Math.min(participantCount, chairs.length);
        for (let i = 0; i < count; i++) {
          const chair = chairs[i];
          const px = chair.x + chair.width / 2;
          const py = chair.y + chair.height / 2;
          drawParticipantToken(ctx, i + 1, px, py);
        }
        // Extra participants without chairs — stack near bottom-center
        for (let i = count; i < participantCount; i++) {
          const col = i - count;
          const px = room.width / 2 - 40 + (col % 6) * 22;
          const py = room.height - 30 - Math.floor(col / 6) * 22;
          drawParticipantToken(ctx, i + 1, px, py);
        }
      }
    }

    ctx.restore();
  }, [room, selectedObjectId, showParticipants, participantCount, participantPositions, getScale]);

  // ── Canvas sizing ──────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = containerWidth ?? container.clientWidth;
      const h = containerHeight ?? container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    return () => ro.disconnect();
  }, [containerWidth, containerHeight]);

  // ── Render loop ────────────────────────────────────────────────────────

  useEffect(() => {
    const frame = () => {
      draw();
      animFrameRef.current = requestAnimationFrame(frame);
    };
    animFrameRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  // ── Mouse interactions ─────────────────────────────────────────────────

  const getMousePos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      return canvasToRoom(canvasX, canvasY);
    },
    [canvasToRoom],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!interactive) return;

      const pos = getMousePos(e);

      // Hit test objects in reverse order (topmost first)
      const reversed = [...room.objects].reverse();
      for (const obj of reversed) {
        if (hitTest(obj, pos.x, pos.y)) {
          onSelectObject?.(obj.id);
          dragRef.current = {
            active: true,
            objectId: obj.id,
            startMouseX: pos.x,
            startMouseY: pos.y,
            startObjX: obj.x,
            startObjY: obj.y,
          };
          return;
        }
      }

      // Clicked empty space
      onSelectObject?.(null);
    },
    [interactive, room.objects, getMousePos, onSelectObject],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!interactive) return;
      const drag = dragRef.current;
      if (!drag.active || !drag.objectId) return;

      const pos = getMousePos(e);
      const dx = pos.x - drag.startMouseX;
      const dy = pos.y - drag.startMouseY;

      const newX = Math.max(0, Math.min(room.width, drag.startObjX + dx));
      const newY = Math.max(0, Math.min(room.height, drag.startObjY + dy));

      // Update object position directly for visual feedback
      // (final commit happens on mouseup)
      const obj = room.objects.find((o) => o.id === drag.objectId);
      if (obj) {
        obj.x = newX;
        obj.y = newY;
      }
    },
    [interactive, room.objects, room.width, room.height, getMousePos],
  );

  const handleMouseUp = useCallback(() => {
    if (!interactive) return;
    const drag = dragRef.current;
    if (!drag.active || !drag.objectId) return;

    const obj = room.objects.find((o) => o.id === drag.objectId);
    if (obj) {
      onMoveObject?.(drag.objectId, obj.x, obj.y);
    }

    dragRef.current = {
      active: false,
      objectId: null,
      startMouseX: 0,
      startMouseY: 0,
      startObjX: 0,
      startObjY: 0,
    };
  }, [interactive, room.objects, onMoveObject]);

  // ── Cursor ─────────────────────────────────────────────────────────────

  const getCursor = () => {
    if (!interactive) return 'default';
    if (dragRef.current.active) return 'grabbing';
    return 'default';
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{ minHeight: 300 }}
    >
      <canvas
        ref={canvasRef}
        style={{ cursor: getCursor() }}
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}
