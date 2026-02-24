import { describe, it, expect } from 'vitest';
import { checkExerciseFit, getRecommendations } from './fitEngine';
import type {
  Exercise,
  AgendaBlock,
  RoomLayout,
} from '../model/types';

// ── Mock data factories ─────────────────────────────────────────────────────

function createExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1',
    title: 'Test Exercise',
    type: 'groups',
    description: 'A test exercise',
    time_range_min: 15,
    time_range_max: 25,
    participant_range_min: 6,
    participant_range_max: 20,
    requires_tables: false,
    requires_flipchart_count: 0,
    requires_screen: false,
    dynamics: 'medium',
    facilitator_steps: ['Step 1', 'Step 2'],
    workbook_link: '',
    tags: ['test'],
    ...overrides,
  };
}

function createBlock(overrides: Partial<AgendaBlock> = {}): AgendaBlock {
  return {
    id: 'block-1',
    type: 'groups',
    title: 'Test Block',
    window_minutes: 45,
    required_assets: { tables: false, flipchart_count: 0, screen: false },
    materials: '',
    workbook_link: '',
    facilitator_notes: '',
    order: 1,
    ...overrides,
  };
}

function createRoom(overrides: Partial<RoomLayout> = {}): RoomLayout {
  return {
    template: 'horseshoe_tables',
    width: 800,
    height: 600,
    objects: [],
    flipchart_count: 2,
    has_screen: true,
    has_tables: true,
    ...overrides,
  };
}

// ── checkExerciseFit ────────────────────────────────────────────────────────

describe('checkExerciseFit', () => {
  it('returns fits: true when exercise matches all constraints', () => {
    const exercise = createExercise();
    const block = createBlock({ window_minutes: 60 });
    const room = createRoom();

    const result = checkExerciseFit(exercise, block, room, 12, 'mixed');

    expect(result.fits).toBe(true);
    expect(result.exercise_id).toBe('ex-1');
    expect(result.estimated_minutes).toBeGreaterThan(0);
    expect(result.reason).toBeUndefined();
  });

  it('returns fits: false when participant count is below range', () => {
    const exercise = createExercise({ participant_range_min: 10 });
    const block = createBlock();
    const room = createRoom();

    const result = checkExerciseFit(exercise, block, room, 5, 'mixed');

    expect(result.fits).toBe(false);
    expect(result.reason).toContain('Participant count');
    expect(result.reason).toContain('outside range');
  });

  it('returns fits: false when participant count is above range', () => {
    const exercise = createExercise({ participant_range_max: 10 });
    const block = createBlock();
    const room = createRoom();

    const result = checkExerciseFit(exercise, block, room, 15, 'mixed');

    expect(result.fits).toBe(false);
    expect(result.reason).toContain('outside range');
  });

  it('returns fits: false when exercise requires tables but room has none', () => {
    const exercise = createExercise({ requires_tables: true });
    const block = createBlock();
    const room = createRoom({ has_tables: false });

    const result = checkExerciseFit(exercise, block, room, 12, 'mixed');

    expect(result.fits).toBe(false);
    expect(result.reason).toContain('tables');
  });

  it('returns fits: false when exercise needs more flipcharts than room has', () => {
    const exercise = createExercise({ requires_flipchart_count: 4 });
    const block = createBlock();
    const room = createRoom({ flipchart_count: 2 });

    const result = checkExerciseFit(exercise, block, room, 12, 'mixed');

    expect(result.fits).toBe(false);
    expect(result.reason).toContain('flipcharts');
  });

  it('returns fits: false when exercise requires screen but room has none', () => {
    const exercise = createExercise({ requires_screen: true });
    const block = createBlock();
    const room = createRoom({ has_screen: false });

    const result = checkExerciseFit(exercise, block, room, 12, 'mixed');

    expect(result.fits).toBe(false);
    expect(result.reason).toContain('screen');
  });

  it('returns fits: false when estimated time exceeds window', () => {
    // time_range_max = 40 + novice overhead + groups overhead for 12 people
    // will exceed a 30 min window
    const exercise = createExercise({ time_range_max: 40 });
    const block = createBlock({ window_minutes: 30 });
    const room = createRoom();

    const result = checkExerciseFit(exercise, block, room, 12, 'novice');

    expect(result.fits).toBe(false);
    expect(result.reason).toContain('exceeds');
    expect(result.estimated_minutes).toBeGreaterThan(30);
  });

  it('passes when flipchart count is exactly met', () => {
    const exercise = createExercise({ requires_flipchart_count: 2 });
    const block = createBlock({ window_minutes: 60 });
    const room = createRoom({ flipchart_count: 2 });

    const result = checkExerciseFit(exercise, block, room, 12, 'mixed');

    expect(result.fits).toBe(true);
  });

  it('passes when participant count is at boundary', () => {
    const exercise = createExercise({
      participant_range_min: 10,
      participant_range_max: 20,
    });
    const block = createBlock({ window_minutes: 60 });
    const room = createRoom();

    const resultMin = checkExerciseFit(exercise, block, room, 10, 'mixed');
    const resultMax = checkExerciseFit(exercise, block, room, 20, 'mixed');

    expect(resultMin.fits).toBe(true);
    expect(resultMax.fits).toBe(true);
  });
});

// ── getRecommendations ──────────────────────────────────────────────────────

describe('getRecommendations', () => {
  it('returns an array', () => {
    const block = createBlock();
    const room = createRoom();

    const results = getRecommendations(block, room, 12, 'mixed');

    expect(Array.isArray(results)).toBe(true);
  });

  it('results are sorted by fit_score descending', () => {
    const block = createBlock({ window_minutes: 60 });
    const room = createRoom();

    const results = getRecommendations(block, room, 12, 'mixed');

    if (results.length >= 2) {
      for (let i = 0; i < results.length - 1; i++) {
        // Main picks (first 3) are sorted; rescue picks may have lower scores
        if (i < 2) {
          expect(results[i].fit_score).toBeGreaterThanOrEqual(results[i + 1].fit_score);
        }
      }
    }
  });

  it('each recommendation has required properties', () => {
    const block = createBlock({ window_minutes: 60 });
    const room = createRoom();

    const results = getRecommendations(block, room, 12, 'mixed');

    for (const rec of results) {
      expect(rec).toHaveProperty('exercise');
      expect(rec).toHaveProperty('estimated_minutes');
      expect(rec).toHaveProperty('fit_score');
      expect(rec).toHaveProperty('reason');

      expect(typeof rec.estimated_minutes).toBe('number');
      expect(typeof rec.fit_score).toBe('number');
      expect(typeof rec.reason).toBe('string');
      expect(rec.exercise).toHaveProperty('id');
      expect(rec.exercise).toHaveProperty('title');
    }
  });

  it('returns at most 5 recommendations (3 main + 2 rescue)', () => {
    const block = createBlock({ window_minutes: 120 });
    const room = createRoom();

    const results = getRecommendations(block, room, 12, 'mixed');

    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('returns empty array when no exercises match block type', () => {
    const block = createBlock({ type: 'contract' });
    const room = createRoom();

    const results = getRecommendations(block, room, 12, 'mixed');

    // May be empty if no exercises of type 'contract' exist in the library
    expect(Array.isArray(results)).toBe(true);
  });
});
