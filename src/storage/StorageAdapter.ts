import type { TrainingProject } from '../model/types';

// ── Storage Adapter Interface ────────────────────────────────────────────────

export interface StorageAdapter {
  save(project: TrainingProject): Promise<void>;
  load(id: string): Promise<TrainingProject | null>;
  list(): Promise<{ id: string; title: string; updated_at: string }[]>;
  remove(id: string): Promise<void>;
  exportJSON(project: TrainingProject): string;
  importJSON(json: string): TrainingProject;
}

// ── LocalStorage Adapter ─────────────────────────────────────────────────────

export class LocalStorageAdapter implements StorageAdapter {
  private prefix = 'tfs_project_';

  async save(project: TrainingProject): Promise<void> {
    const key = this.prefix + project.id;
    const serialized = JSON.stringify(project);
    localStorage.setItem(key, serialized);
  }

  async load(id: string): Promise<TrainingProject | null> {
    const key = this.prefix + id;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as TrainingProject;
    } catch {
      console.error(`Failed to parse project ${id} from localStorage`);
      return null;
    }
  }

  async list(): Promise<{ id: string; title: string; updated_at: string }[]> {
    const results: { id: string; title: string; updated_at: string }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(this.prefix)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const project = JSON.parse(raw) as TrainingProject;
        results.push({
          id: project.id,
          title: project.title,
          updated_at: project.updated_at,
        });
      } catch {
        // Skip corrupted entries
        console.warn(`Skipping corrupted localStorage entry: ${key}`);
      }
    }

    // Most recently updated first
    results.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );

    return results;
  }

  async remove(id: string): Promise<void> {
    const key = this.prefix + id;
    localStorage.removeItem(key);
  }

  exportJSON(project: TrainingProject): string {
    return JSON.stringify(project, null, 2);
  }

  importJSON(json: string): TrainingProject {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('Invalid JSON: could not parse input');
    }

    const project = parsed as Record<string, unknown>;

    // Validate required fields
    const requiredFields: (keyof TrainingProject)[] = [
      'id',
      'schema_version',
      'title',
      'participant_count',
      'blocks',
      'room',
    ];

    for (const field of requiredFields) {
      if (!(field in project)) {
        throw new Error(`Invalid project: missing required field "${field}"`);
      }
    }

    if (typeof project.id !== 'string' || project.id.length === 0) {
      throw new Error('Invalid project: "id" must be a non-empty string');
    }

    if (!Array.isArray(project.blocks)) {
      throw new Error('Invalid project: "blocks" must be an array');
    }

    if (typeof project.room !== 'object' || project.room === null) {
      throw new Error('Invalid project: "room" must be an object');
    }

    return parsed as TrainingProject;
  }
}

// ── Google Drive Adapter (stub) ──────────────────────────────────────────────

export class GoogleDriveAdapter implements StorageAdapter {
  private fail(): never {
    throw new Error('Google Drive integration coming in v2');
  }

  async save(_project: TrainingProject): Promise<void> {
    this.fail();
  }

  async load(_id: string): Promise<TrainingProject | null> {
    this.fail();
  }

  async list(): Promise<{ id: string; title: string; updated_at: string }[]> {
    this.fail();
  }

  async remove(_id: string): Promise<void> {
    this.fail();
  }

  exportJSON(_project: TrainingProject): string {
    this.fail();
  }

  importJSON(_json: string): TrainingProject {
    this.fail();
  }
}
