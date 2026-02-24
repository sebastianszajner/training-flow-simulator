import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  TrainingProject,
  AgendaBlock,
  BlockType,
  RoomLayout,
  RoomTemplate,
  RoomObject,
  RequiredAssets,
} from '../model/types';
import { BLOCK_TYPE_META, SCHEMA_VERSION } from '../model/types';
import { LocalStorageAdapter } from '../storage/StorageAdapter';
import { estimateBlockTime } from '../engine/timeEngine';
import { getExerciseById } from '../library/exercises';

// ── Storage instance ─────────────────────────────────────────────────────────

const storage = new LocalStorageAdapter();

// ── Store interface ──────────────────────────────────────────────────────────

interface ProjectStore {
  // Current project
  project: TrainingProject | null;

  // UI state
  currentScreen: 'setup' | 'timeline' | 'room' | 'simulation';
  viewMode: 'plan' | 'show';
  selectedBlockId: string | null;
  isPlaying: boolean;
  playbackPosition: number;

  // Project list
  savedProjects: { id: string; title: string; updated_at: string }[];

  // Actions - Project
  createProject: (data: Partial<TrainingProject>) => void;
  updateProject: (data: Partial<TrainingProject>) => void;
  loadProject: (id: string) => Promise<void>;
  saveProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  loadProjectList: () => Promise<void>;
  importProject: (json: string) => void;
  exportProject: () => string;

  // Actions - Navigation
  setScreen: (screen: ProjectStore['currentScreen']) => void;
  setViewMode: (mode: 'plan' | 'show') => void;

  // Actions - Blocks
  addBlock: (type: BlockType, insertAt?: number) => void;
  updateBlock: (id: string, data: Partial<AgendaBlock>) => void;
  removeBlock: (id: string) => void;
  reorderBlocks: (fromIndex: number, toIndex: number) => void;
  selectBlock: (id: string | null) => void;
  assignExercise: (blockId: string, exerciseId: string) => void;

  // Actions - Room
  updateRoom: (data: Partial<RoomLayout>) => void;
  applyRoomTemplate: (template: RoomTemplate, participantCount: number) => void;
  addRoomObject: (obj: Omit<RoomObject, 'id'>) => void;
  updateRoomObject: (id: string, data: Partial<RoomObject>) => void;
  removeRoomObject: (id: string) => void;

  // Actions - Playback
  play: () => void;
  pause: () => void;
  setPlaybackPosition: (minutes: number) => void;

  // Actions - Recompute
  recomputeAllBlocks: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function defaultRequiredAssets(): RequiredAssets {
  return { tables: false, flipchart_count: 0, screen: false };
}

function defaultRoom(): RoomLayout {
  return {
    template: 'horseshoe_tables',
    width: 800,
    height: 600,
    objects: [],
    flipchart_count: 1,
    has_screen: true,
    has_tables: true,
  };
}

function now(): string {
  return new Date().toISOString();
}

// ── Room template generators ─────────────────────────────────────────────────

function generateHorseshoeWithTables(
  participantCount: number,
  roomWidth: number,
  roomHeight: number,
): RoomObject[] {
  const objects: RoomObject[] = [];
  const seats = Math.max(participantCount, 6);

  // Screen at the front (top center)
  objects.push({
    id: uuidv4(),
    type: 'screen',
    x: (roomWidth - 120) / 2,
    y: 20,
    width: 120,
    height: 10,
    rotation: 0,
    label: 'Screen',
  });

  // Facilitator spot in front of screen
  objects.push({
    id: uuidv4(),
    type: 'facilitator_spot',
    x: (roomWidth - 30) / 2,
    y: 50,
    width: 30,
    height: 30,
    rotation: 0,
    label: 'Facilitator',
  });

  // U-shape layout: left arm, bottom, right arm
  // Calculate how many seats per arm
  const leftArmSeats = Math.ceil(seats / 3);
  const bottomSeats = Math.ceil(seats / 3);
  const rightArmSeats = seats - leftArmSeats - bottomSeats;

  const uLeft = 100;
  const uRight = roomWidth - 100;
  const uTop = 120;
  const uBottom = roomHeight - 80;

  // Left arm tables + chairs (vertical, going down)
  for (let i = 0; i < leftArmSeats; i++) {
    const y = uTop + i * 60;
    if (y > uBottom) break;
    // Table on the inside of the U
    objects.push({
      id: uuidv4(),
      type: 'table',
      x: uLeft,
      y,
      width: 80,
      height: 40,
      rotation: 0,
      label: `Table L${i + 1}`,
    });
    // Chair on the outside (left of table)
    objects.push({
      id: uuidv4(),
      type: 'chair',
      x: uLeft - 25,
      y: y + 10,
      width: 20,
      height: 20,
      rotation: 0,
    });
  }

  // Right arm tables + chairs (vertical, going down)
  for (let i = 0; i < rightArmSeats; i++) {
    const y = uTop + i * 60;
    if (y > uBottom) break;
    objects.push({
      id: uuidv4(),
      type: 'table',
      x: uRight - 80,
      y,
      width: 80,
      height: 40,
      rotation: 0,
      label: `Table R${i + 1}`,
    });
    // Chair on the outside (right of table)
    objects.push({
      id: uuidv4(),
      type: 'chair',
      x: uRight + 5,
      y: y + 10,
      width: 20,
      height: 20,
      rotation: 0,
    });
  }

  // Bottom arm tables + chairs (horizontal, going right)
  const bottomStartX = uLeft + 100;
  const bottomAvailableWidth = uRight - 80 - bottomStartX;
  const bottomSpacing = bottomSeats > 1 ? bottomAvailableWidth / (bottomSeats - 1) : 0;

  for (let i = 0; i < bottomSeats; i++) {
    const x = bottomSeats > 1 ? bottomStartX + i * bottomSpacing : (roomWidth - 80) / 2;
    objects.push({
      id: uuidv4(),
      type: 'table',
      x,
      y: uBottom - 20,
      width: 80,
      height: 40,
      rotation: 0,
      label: `Table B${i + 1}`,
    });
    // Chair below table
    objects.push({
      id: uuidv4(),
      type: 'chair',
      x: x + 30,
      y: uBottom + 25,
      width: 20,
      height: 20,
      rotation: 0,
    });
  }

  // Flipcharts in corners
  objects.push({
    id: uuidv4(),
    type: 'flipchart',
    x: 20,
    y: 20,
    width: 30,
    height: 50,
    rotation: 0,
    label: 'Flipchart 1',
  });

  objects.push({
    id: uuidv4(),
    type: 'flipchart',
    x: roomWidth - 50,
    y: 20,
    width: 30,
    height: 50,
    rotation: 0,
    label: 'Flipchart 2',
  });

  return objects;
}

function generateHorseshoeNoTables(
  participantCount: number,
  roomWidth: number,
  roomHeight: number,
): RoomObject[] {
  const objects: RoomObject[] = [];
  const seats = Math.max(participantCount, 6);

  // Screen at the front
  objects.push({
    id: uuidv4(),
    type: 'screen',
    x: (roomWidth - 120) / 2,
    y: 20,
    width: 120,
    height: 10,
    rotation: 0,
    label: 'Screen',
  });

  // Facilitator spot
  objects.push({
    id: uuidv4(),
    type: 'facilitator_spot',
    x: (roomWidth - 30) / 2,
    y: 50,
    width: 30,
    height: 30,
    rotation: 0,
    label: 'Facilitator',
  });

  // U-shape chairs only (no tables) - tighter spacing
  const leftArmSeats = Math.ceil(seats / 3);
  const bottomSeats = Math.ceil(seats / 3);
  const rightArmSeats = seats - leftArmSeats - bottomSeats;

  const uLeft = 140;
  const uRight = roomWidth - 140;
  const uTop = 120;
  const uBottom = roomHeight - 80;

  // Left arm chairs
  for (let i = 0; i < leftArmSeats; i++) {
    const y = uTop + i * 35;
    if (y > uBottom) break;
    objects.push({
      id: uuidv4(),
      type: 'chair',
      x: uLeft,
      y,
      width: 20,
      height: 20,
      rotation: 0,
    });
  }

  // Right arm chairs
  for (let i = 0; i < rightArmSeats; i++) {
    const y = uTop + i * 35;
    if (y > uBottom) break;
    objects.push({
      id: uuidv4(),
      type: 'chair',
      x: uRight,
      y,
      width: 20,
      height: 20,
      rotation: 0,
    });
  }

  // Bottom arm chairs
  const bottomStartX = uLeft + 40;
  const bottomAvailableWidth = uRight - bottomStartX - 20;
  const bottomSpacing = bottomSeats > 1 ? bottomAvailableWidth / (bottomSeats - 1) : 0;

  for (let i = 0; i < bottomSeats; i++) {
    const x = bottomSeats > 1 ? bottomStartX + i * bottomSpacing : (roomWidth - 20) / 2;
    objects.push({
      id: uuidv4(),
      type: 'chair',
      x,
      y: uBottom,
      width: 20,
      height: 20,
      rotation: 0,
    });
  }

  // Flipcharts
  objects.push({
    id: uuidv4(),
    type: 'flipchart',
    x: 20,
    y: 20,
    width: 30,
    height: 50,
    rotation: 0,
    label: 'Flipchart 1',
  });

  objects.push({
    id: uuidv4(),
    type: 'flipchart',
    x: roomWidth - 50,
    y: 20,
    width: 30,
    height: 50,
    rotation: 0,
    label: 'Flipchart 2',
  });

  return objects;
}

function generateLecture20Plus(
  participantCount: number,
  roomWidth: number,
  roomHeight: number,
): RoomObject[] {
  const objects: RoomObject[] = [];
  const seats = Math.max(participantCount, 20);

  // Screen at the front (top center, wider for lecture)
  objects.push({
    id: uuidv4(),
    type: 'screen',
    x: (roomWidth - 160) / 2,
    y: 15,
    width: 160,
    height: 10,
    rotation: 0,
    label: 'Screen',
  });

  // Facilitator spot
  objects.push({
    id: uuidv4(),
    type: 'facilitator_spot',
    x: (roomWidth - 30) / 2,
    y: 45,
    width: 30,
    height: 30,
    rotation: 0,
    label: 'Facilitator',
  });

  // Rows of chairs with center aisle
  const chairsPerRow = Math.min(Math.ceil(seats / 4), 10);
  const halfRow = Math.ceil(chairsPerRow / 2);
  const rows = Math.ceil(seats / chairsPerRow);

  const aisleWidth = 40;
  const chairSpacing = 28;
  const rowSpacing = 40;
  const firstRowY = 110;

  const leftBlockStartX = (roomWidth / 2) - aisleWidth / 2 - halfRow * chairSpacing;
  const rightBlockStartX = (roomWidth / 2) + aisleWidth / 2;

  let placed = 0;
  for (let row = 0; row < rows && placed < seats; row++) {
    const y = firstRowY + row * rowSpacing;
    if (y + 20 > roomHeight - 30) break;

    // Left block
    for (let col = 0; col < halfRow && placed < seats; col++) {
      objects.push({
        id: uuidv4(),
        type: 'chair',
        x: leftBlockStartX + col * chairSpacing,
        y,
        width: 20,
        height: 20,
        rotation: 0,
      });
      placed++;
    }

    // Right block
    const rightHalf = chairsPerRow - halfRow;
    for (let col = 0; col < rightHalf && placed < seats; col++) {
      objects.push({
        id: uuidv4(),
        type: 'chair',
        x: rightBlockStartX + col * chairSpacing,
        y,
        width: 20,
        height: 20,
        rotation: 0,
      });
      placed++;
    }
  }

  // Flipchart on the side
  objects.push({
    id: uuidv4(),
    type: 'flipchart',
    x: 20,
    y: 30,
    width: 30,
    height: 50,
    rotation: 0,
    label: 'Flipchart',
  });

  return objects;
}

function generateRoomObjects(
  template: RoomTemplate,
  participantCount: number,
  width: number,
  height: number,
): RoomObject[] {
  switch (template) {
    case 'horseshoe_tables':
      return generateHorseshoeWithTables(participantCount, width, height);
    case 'horseshoe_no_tables':
      return generateHorseshoeNoTables(participantCount, width, height);
    case 'lecture_20plus':
      return generateLecture20Plus(participantCount, width, height);
    default:
      return generateHorseshoeWithTables(participantCount, width, height);
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // ── Initial state ────────────────────────────────────────────────────────
  project: null,
  currentScreen: 'setup',
  viewMode: 'plan',
  selectedBlockId: null,
  isPlaying: false,
  playbackPosition: 0,
  savedProjects: [],

  // ── Project actions ──────────────────────────────────────────────────────

  createProject: (data) => {
    const timestamp = now();
    const project: TrainingProject = {
      id: uuidv4(),
      schema_version: SCHEMA_VERSION,
      title: data.title ?? 'Untitled Training',
      industry: data.industry ?? '',
      participant_count: data.participant_count ?? 12,
      experience_level: data.experience_level ?? 'mixed',
      total_minutes: data.total_minutes ?? 480,
      start_time: data.start_time ?? '09:00',
      business_goals: data.business_goals ?? [],
      training_goals: data.training_goals ?? [],
      blocks: data.blocks ?? [],
      room: data.room ?? defaultRoom(),
      created_at: timestamp,
      updated_at: timestamp,
    };

    set({ project, currentScreen: 'timeline', selectedBlockId: null, playbackPosition: 0, isPlaying: false });
  },

  updateProject: (data) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        ...data,
        updated_at: now(),
      },
    });
  },

  loadProject: async (id) => {
    const project = await storage.load(id);
    if (project) {
      set({ project, currentScreen: 'timeline', selectedBlockId: null, playbackPosition: 0, isPlaying: false });
      get().recomputeAllBlocks();
    }
  },

  saveProject: async () => {
    const { project } = get();
    if (!project) return;

    const updated = { ...project, updated_at: now() };
    set({ project: updated });
    await storage.save(updated);

    // Refresh the project list
    await get().loadProjectList();
  },

  deleteProject: async (id) => {
    await storage.remove(id);
    const { project } = get();
    if (project?.id === id) {
      set({ project: null, currentScreen: 'setup' });
    }
    await get().loadProjectList();
  },

  loadProjectList: async () => {
    const list = await storage.list();
    set({ savedProjects: list });
  },

  importProject: (json) => {
    const project = storage.importJSON(json);
    set({ project, currentScreen: 'timeline', selectedBlockId: null, playbackPosition: 0, isPlaying: false });
    get().recomputeAllBlocks();
  },

  exportProject: () => {
    const { project } = get();
    if (!project) return '{}';
    return storage.exportJSON(project);
  },

  // ── Navigation actions ───────────────────────────────────────────────────

  setScreen: (screen) => set({ currentScreen: screen }),
  setViewMode: (mode) => set({ viewMode: mode }),

  // ── Block actions ────────────────────────────────────────────────────────

  addBlock: (type, insertAt) => {
    const { project } = get();
    if (!project) return;

    const meta = BLOCK_TYPE_META[type];
    const newBlock: AgendaBlock = {
      id: uuidv4(),
      type,
      title: meta.label,
      window_minutes: meta.defaultMinutes,
      required_assets: defaultRequiredAssets(),
      materials: '',
      workbook_link: '',
      facilitator_notes: '',
      order: 0,
    };

    const blocks = [...project.blocks];

    if (insertAt !== undefined && insertAt >= 0 && insertAt <= blocks.length) {
      blocks.splice(insertAt, 0, newBlock);
    } else {
      blocks.push(newBlock);
    }

    // Reindex order
    blocks.forEach((b, i) => (b.order = i));

    set({
      project: {
        ...project,
        blocks,
        updated_at: now(),
      },
    });

    get().recomputeAllBlocks();
  },

  updateBlock: (id, data) => {
    const { project } = get();
    if (!project) return;

    const blocks = project.blocks.map((b) =>
      b.id === id ? { ...b, ...data } : b,
    );

    set({
      project: {
        ...project,
        blocks,
        updated_at: now(),
      },
    });

    get().recomputeAllBlocks();
  },

  removeBlock: (id) => {
    const { project } = get();
    if (!project) return;

    const blocks = project.blocks.filter((b) => b.id !== id);
    blocks.forEach((b, i) => (b.order = i));

    const selectedBlockId = get().selectedBlockId === id ? null : get().selectedBlockId;

    set({
      project: {
        ...project,
        blocks,
        updated_at: now(),
      },
      selectedBlockId,
    });

    get().recomputeAllBlocks();
  },

  reorderBlocks: (fromIndex, toIndex) => {
    const { project } = get();
    if (!project) return;

    const blocks = [...project.blocks];
    if (
      fromIndex < 0 ||
      fromIndex >= blocks.length ||
      toIndex < 0 ||
      toIndex >= blocks.length
    ) {
      return;
    }

    const [moved] = blocks.splice(fromIndex, 1);
    blocks.splice(toIndex, 0, moved);
    blocks.forEach((b, i) => (b.order = i));

    set({
      project: {
        ...project,
        blocks,
        updated_at: now(),
      },
    });

    get().recomputeAllBlocks();
  },

  selectBlock: (id) => set({ selectedBlockId: id }),

  assignExercise: (blockId, exerciseId) => {
    const { project } = get();
    if (!project) return;

    const exercise = getExerciseById(exerciseId);
    if (!exercise) {
      console.warn(`Exercise "${exerciseId}" not found in library.`);
      return;
    }

    const blocks = project.blocks.map((b) => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        exercise_id: exerciseId,
        method: exercise.description,
        required_assets: {
          tables: exercise.requires_tables,
          flipchart_count: exercise.requires_flipchart_count,
          screen: exercise.requires_screen,
        },
        facilitator_notes: exercise.facilitator_steps.join('\n'),
        workbook_link: exercise.workbook_link,
        materials: exercise.tags.join(', '),
      };
    });

    set({ project: { ...project, blocks, updated_at: now() } });
    get().recomputeAllBlocks();
  },

  // ── Room actions ─────────────────────────────────────────────────────────

  updateRoom: (data) => {
    const { project } = get();
    if (!project) return;

    set({
      project: {
        ...project,
        room: { ...project.room, ...data },
        updated_at: now(),
      },
    });
  },

  applyRoomTemplate: (template, participantCount) => {
    const { project } = get();
    if (!project) return;

    const width = project.room.width || 800;
    const height = project.room.height || 600;
    const objects = generateRoomObjects(template, participantCount, width, height);

    const hasTables = template === 'horseshoe_tables';
    const flipchartCount = objects.filter((o) => o.type === 'flipchart').length;

    set({
      project: {
        ...project,
        room: {
          ...project.room,
          template,
          objects,
          has_tables: hasTables,
          has_screen: true,
          flipchart_count: flipchartCount,
        },
        updated_at: now(),
      },
    });
  },

  addRoomObject: (obj) => {
    const { project } = get();
    if (!project) return;

    const newObj: RoomObject = { ...obj, id: uuidv4() };

    set({
      project: {
        ...project,
        room: {
          ...project.room,
          objects: [...project.room.objects, newObj],
        },
        updated_at: now(),
      },
    });
  },

  updateRoomObject: (id, data) => {
    const { project } = get();
    if (!project) return;

    const objects = project.room.objects.map((o) =>
      o.id === id ? { ...o, ...data } : o,
    );

    set({
      project: {
        ...project,
        room: { ...project.room, objects },
        updated_at: now(),
      },
    });
  },

  removeRoomObject: (id) => {
    const { project } = get();
    if (!project) return;

    const objects = project.room.objects.filter((o) => o.id !== id);

    set({
      project: {
        ...project,
        room: { ...project.room, objects },
        updated_at: now(),
      },
    });
  },

  // ── Playback actions ─────────────────────────────────────────────────────

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  setPlaybackPosition: (minutes) => set({ playbackPosition: minutes }),

  // ── Recompute ────────────────────────────────────────────────────────────

  recomputeAllBlocks: () => {
    const { project } = get();
    if (!project) return;

    const blocks = project.blocks.map((block) => {
      // Breaks don't need time estimation
      if (block.type === 'break') {
        return {
          ...block,
          estimated_minutes: block.window_minutes,
          fits_in_window: true,
        };
      }

      const estimate = estimateBlockTime({
        base_minutes: block.window_minutes,
        experience_level: project.experience_level,
        participant_count: project.participant_count,
        method: block.type,
        room_template: project.room.template,
        question_config: block.question_config,
      });

      return {
        ...block,
        estimated_minutes: Math.round(estimate.total_minutes * 10) / 10,
        fits_in_window: estimate.total_minutes <= block.window_minutes,
      };
    });

    set({
      project: {
        ...project,
        blocks,
      },
    });
  },
}));
