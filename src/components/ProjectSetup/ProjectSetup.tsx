import { useEffect, useState, useRef } from 'react';
import {
  Plus,
  Upload,
  Trash2,
  Clock,
  Users,
  FolderOpen,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import type { ExperienceLevel } from '../../model/types';
import { createDemoProject } from '../../model/demo';
import Button from '../shared/Button';

interface FormState {
  title: string;
  industry: string;
  participant_count: number;
  experience_level: ExperienceLevel;
  total_minutes: number;
  start_time: string;
  business_goals: string;
  training_goals: string;
}

const INITIAL_FORM: FormState = {
  title: '',
  industry: '',
  participant_count: 12,
  experience_level: 'mixed',
  total_minutes: 480,
  start_time: '09:00',
  business_goals: '',
  training_goals: '',
};

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; hint: string }[] = [
  { value: 'novice', label: 'Novice', hint: '+20% time' },
  { value: 'mixed', label: 'Mixed', hint: 'baseline' },
  { value: 'advanced', label: 'Advanced', hint: '-20% time' },
];

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ProjectSetup() {
  const {
    savedProjects,
    loadProjectList,
    loadProject,
    deleteProject,
    createProject,
    importProject,
    setScreen,
  } = useProjectStore();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjectList();
  }, [loadProjectList]);

  // ── Form helpers ────────────────────────────────────────────────────────

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;

    createProject({
      title: form.title.trim(),
      industry: form.industry.trim(),
      participant_count: form.participant_count,
      experience_level: form.experience_level,
      total_minutes: form.total_minutes,
      start_time: form.start_time,
      business_goals: form.business_goals
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      training_goals: form.training_goals
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    });
  }

  // ── Import JSON ─────────────────────────────────────────────────────────

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        importProject(reader.result as string);
      } catch (err) {
        console.error('Import failed:', err);
        alert(`Import failed: ${err instanceof Error ? err.message : 'Invalid JSON file'}`);
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be re-imported
    e.target.value = '';
  }

  function handleLoadDemo() {
    const demo = createDemoProject();
    const json = JSON.stringify(demo);
    importProject(json);
    setScreen('timeline');
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const hasSaved = savedProjects.length > 0;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className={`max-w-6xl mx-auto grid gap-6 ${hasSaved ? 'lg:grid-cols-[340px_1fr]' : ''}`}>
        {/* ── Section A: Saved Projects ──────────────────────────────── */}
        {hasSaved && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider">
              <FolderOpen className="w-4 h-4" />
              Saved Projects
            </h2>

            <div className="space-y-2">
              {savedProjects.map((p) => (
                <div
                  key={p.id}
                  className="group flex items-center justify-between bg-slate-800/70 hover:bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2.5 cursor-pointer transition-colors"
                  onClick={() => loadProject(p.id)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">
                      {p.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDate(p.updated_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${p.title}"? This cannot be undone.`)) {
                        deleteProject(p.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-600/20 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Import & Demo buttons */}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="w-3.5 h-3.5" />
                Import JSON
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleLoadDemo}
                className="w-full"
              >
                Load Demo Project
              </Button>
            </div>
          </section>
        )}

        {/* ── Section B: New Project Form ────────────────────────────── */}
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            <Plus className="w-4 h-4" />
            New Project
          </h2>

          <form
            onSubmit={handleSubmit}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-5"
          >
            {/* Title */}
            <Field label="Title" required>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. AI Fundamentals for Sales Teams"
                className="input-field"
                required
              />
            </Field>

            {/* Industry */}
            <Field label="Industry">
              <input
                type="text"
                value={form.industry}
                onChange={(e) => update('industry', e.target.value)}
                placeholder="e.g. Finance, Pharma, IT..."
                className="input-field"
              />
            </Field>

            {/* Row: Participants + Experience */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Participants" icon={<Users className="w-3.5 h-3.5" />}>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={form.participant_count}
                  onChange={(e) => update('participant_count', Number(e.target.value))}
                  className="input-field"
                />
              </Field>

              <Field label="Experience Level">
                <div className="flex gap-2">
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`
                        flex-1 flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border cursor-pointer transition-all text-center
                        ${
                          form.experience_level === opt.value
                            ? 'border-blue-500 bg-blue-600/15 text-blue-400'
                            : 'border-slate-600 bg-slate-700/40 text-slate-400 hover:border-slate-500'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="experience_level"
                        value={opt.value}
                        checked={form.experience_level === opt.value}
                        onChange={() => update('experience_level', opt.value)}
                        className="sr-only"
                      />
                      <span className="text-xs font-medium">{opt.label}</span>
                      <span className="text-[10px] opacity-70">{opt.hint}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </div>

            {/* Row: Duration + Start time */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Total Minutes" icon={<Clock className="w-3.5 h-3.5" />}>
                <input
                  type="number"
                  min={30}
                  max={2880}
                  value={form.total_minutes}
                  onChange={(e) => update('total_minutes', Number(e.target.value))}
                  className="input-field"
                />
              </Field>

              <Field label="Start Time">
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => update('start_time', e.target.value)}
                  className="input-field"
                />
              </Field>
            </div>

            {/* Business Goals */}
            <Field label="Business Goals" hint="One per line">
              <textarea
                value={form.business_goals}
                onChange={(e) => update('business_goals', e.target.value)}
                placeholder={"Increase team productivity with AI tools\nReduce manual reporting time by 50%"}
                rows={3}
                className="input-field resize-none"
              />
            </Field>

            {/* Training Goals */}
            <Field label="Training Goals" hint="One per line">
              <textarea
                value={form.training_goals}
                onChange={(e) => update('training_goals', e.target.value)}
                placeholder={"Participants can write effective prompts\nParticipants understand AI limitations"}
                rows={3}
                className="input-field resize-none"
              />
            </Field>

            {/* Submit */}
            <Button type="submit" variant="primary" size="lg" className="w-full">
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          </form>

          {/* Import & Demo fallback when no saved projects */}
          {!hasSaved && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" />
                Import JSON
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleLoadDemo}
              >
                Load Demo Project
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Field wrapper ──────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  icon,
  required,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        {icon}
        {label}
        {required && <span className="text-red-400">*</span>}
        {hint && (
          <span className="ml-auto text-[10px] text-slate-500 font-normal">
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
