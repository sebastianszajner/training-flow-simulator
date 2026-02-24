import { describe, it, expect } from 'vitest';
import { LocalStorageAdapter } from './StorageAdapter';
import type { TrainingProject } from '../model/types';

// ── Minimal valid TrainingProject for testing ───────────────────────────────

function createTestProject(overrides: Partial<TrainingProject> = {}): TrainingProject {
  return {
    id: 'test-project-1',
    schema_version: '1.0.0',
    title: 'Test Training',
    industry: 'IT',
    participant_count: 12,
    experience_level: 'mixed',
    total_minutes: 480,
    start_time: '09:00',
    business_goals: ['Goal 1'],
    training_goals: ['Training Goal 1'],
    blocks: [
      {
        id: 'block-1',
        type: 'lecture',
        title: 'Introduction',
        window_minutes: 30,
        required_assets: { tables: false, flipchart_count: 0, screen: true },
        materials: 'Slides',
        workbook_link: '',
        facilitator_notes: 'Start with energy',
        order: 1,
      },
    ],
    room: {
      template: 'horseshoe_tables',
      width: 800,
      height: 600,
      objects: [],
      flipchart_count: 2,
      has_screen: true,
      has_tables: true,
    },
    created_at: '2026-02-24T10:00:00Z',
    updated_at: '2026-02-24T10:00:00Z',
    ...overrides,
  };
}

// ── exportJSON / importJSON ─────────────────────────────────────────────────

describe('LocalStorageAdapter — exportJSON', () => {
  it('returns a valid JSON string', () => {
    const adapter = new LocalStorageAdapter();
    const project = createTestProject();

    const json = adapter.exportJSON(project);

    expect(typeof json).toBe('string');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('exported JSON contains all project fields', () => {
    const adapter = new LocalStorageAdapter();
    const project = createTestProject();

    const json = adapter.exportJSON(project);
    const parsed = JSON.parse(json);

    expect(parsed.id).toBe(project.id);
    expect(parsed.title).toBe(project.title);
    expect(parsed.participant_count).toBe(project.participant_count);
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.room.template).toBe('horseshoe_tables');
  });
});

describe('LocalStorageAdapter — importJSON', () => {
  it('parses valid JSON back to a TrainingProject object', () => {
    const adapter = new LocalStorageAdapter();
    const project = createTestProject();
    const json = adapter.exportJSON(project);

    const imported = adapter.importJSON(json);

    expect(imported.id).toBe(project.id);
    expect(imported.title).toBe(project.title);
    expect(imported.participant_count).toBe(project.participant_count);
    expect(imported.blocks).toHaveLength(1);
    expect(imported.room.template).toBe('horseshoe_tables');
  });

  it('throws on invalid JSON string', () => {
    const adapter = new LocalStorageAdapter();

    expect(() => adapter.importJSON('not valid json {')).toThrow('Invalid JSON');
  });

  it('throws when required field "id" is missing', () => {
    const adapter = new LocalStorageAdapter();
    const incomplete = { title: 'No ID', schema_version: '1.0.0' };

    expect(() => adapter.importJSON(JSON.stringify(incomplete))).toThrow(
      'missing required field',
    );
  });

  it('throws when "id" is empty string', () => {
    const adapter = new LocalStorageAdapter();
    const project = createTestProject({ id: '' });
    const json = JSON.stringify(project);

    expect(() => adapter.importJSON(json)).toThrow('non-empty string');
  });

  it('throws when "blocks" is not an array', () => {
    const adapter = new LocalStorageAdapter();
    const bad = { ...createTestProject(), blocks: 'not-an-array' };
    const json = JSON.stringify(bad);

    expect(() => adapter.importJSON(json)).toThrow('must be an array');
  });

  it('throws when "room" is null', () => {
    const adapter = new LocalStorageAdapter();
    const bad = { ...createTestProject(), room: null };
    const json = JSON.stringify(bad);

    expect(() => adapter.importJSON(json)).toThrow('must be an object');
  });
});

describe('LocalStorageAdapter — round-trip', () => {
  it('export then import produces identical data', () => {
    const adapter = new LocalStorageAdapter();
    const project = createTestProject();

    const json = adapter.exportJSON(project);
    const imported = adapter.importJSON(json);

    expect(imported).toEqual(project);
  });

  it('round-trip preserves nested structures', () => {
    const adapter = new LocalStorageAdapter();
    const project = createTestProject({
      blocks: [
        {
          id: 'block-1',
          type: 'groups',
          title: 'Group Work',
          window_minutes: 45,
          required_assets: { tables: true, flipchart_count: 2, screen: false },
          materials: 'Cards, markers',
          workbook_link: 'https://example.com/wb',
          facilitator_notes: 'Split into 3 groups',
          order: 1,
          question_config: {
            questions: ['What did you learn?', 'How will you apply it?'],
            persons_per_question: 4,
            questions_per_group: 2,
            seconds_per_question_prompt: 15,
            seconds_per_answer: 30,
            expected_answers_per_question: 3,
          },
        },
      ],
    });

    const json = adapter.exportJSON(project);
    const imported = adapter.importJSON(json);

    expect(imported.blocks[0].question_config).toEqual(
      project.blocks[0].question_config,
    );
    expect(imported.blocks[0].required_assets).toEqual(
      project.blocks[0].required_assets,
    );
  });
});
