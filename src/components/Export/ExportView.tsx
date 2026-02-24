import { useState, useMemo } from 'react';
import {
  Printer,
  Download,
  Eye,
  EyeOff,
  Target,
  Briefcase,
  FileText,
  Clock,
  Users,
  Monitor,
  ClipboardList,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { formatMinutesToTime } from '../../engine/timeEngine';
import { BLOCK_TYPE_META } from '../../model/types';
import type { AgendaBlock } from '../../model/types';

// ── Types ────────────────────────────────────────────────────────────────────

type ExportVersion = 'trainer' | 'client';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getBlockTimeSlot(
  blocks: AgendaBlock[],
  index: number,
  startTime: string,
): { from: string; to: string } {
  let accumulated = 0;
  for (let i = 0; i < index; i++) {
    accumulated += blocks[i].window_minutes;
  }
  const from = formatMinutesToTime(accumulated, startTime);
  const to = formatMinutesToTime(accumulated + blocks[index].window_minutes, startTime);
  return { from, to };
}

function aggregateMaterials(blocks: AgendaBlock[]): string[] {
  const materials = new Set<string>();
  for (const block of blocks) {
    if (block.materials) {
      block.materials.split(',').forEach((m) => {
        const trimmed = m.trim();
        if (trimmed) materials.add(trimmed);
      });
    }
  }
  return Array.from(materials);
}

function aggregateFormsOfWork(blocks: AgendaBlock[]): string[] {
  const forms = new Set<string>();
  for (const block of blocks) {
    const meta = BLOCK_TYPE_META[block.type];
    if (meta) forms.add(meta.label);
  }
  return Array.from(forms);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ExportView() {
  const { project, exportProject } = useProjectStore();
  const [version, setVersion] = useState<ExportVersion>('trainer');

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        No project loaded.
      </div>
    );
  }

  const {
    title,
    blocks,
    start_time,
    participant_count,
    experience_level,
    training_goals,
    business_goals,
    room,
  } = project;

  const materials = useMemo(() => aggregateMaterials(blocks), [blocks]);
  const formsOfWork = useMemo(() => aggregateFormsOfWork(blocks), [blocks]);

  // Room requirements
  const needsTables = room.has_tables || blocks.some((b) => b.required_assets.tables);
  const flipchartCount = Math.max(
    room.flipchart_count,
    ...blocks.map((b) => b.required_assets.flipchart_count),
  );
  const needsScreen = room.has_screen || blocks.some((b) => b.required_assets.screen);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handlePrint = () => window.print();

  const handleDownloadJSON = () => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar (hidden in print) */}
      <div className="no-print shrink-0 flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/50">
        {/* Version toggle */}
        <div className="flex items-center bg-slate-900/60 rounded-lg p-0.5 border border-slate-700/50">
          <button
            onClick={() => setVersion('trainer')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              version === 'trainer'
                ? 'bg-slate-700 text-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Eye className="w-3 h-3" />
            Trainer Version
          </button>
          <button
            onClick={() => setVersion('client')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              version === 'client'
                ? 'bg-slate-700 text-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <EyeOff className="w-3 h-3" />
            Client Version
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button
            onClick={handleDownloadJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download JSON
          </button>
        </div>
      </div>

      {/* Print content area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-8 print:p-4 print:max-w-none">
          {/* ── Print styles (inline for portability) ─────────────────────── */}
          <style>{`
            @media print {
              body { background: white !important; color: black !important; }
              .no-print { display: none !important; }
              .print-page { background: white !important; color: #1e293b !important; }
              .print-page * { color: #1e293b !important; border-color: #e2e8f0 !important; }
              .print-page .print-accent { color: #2563eb !important; }
              .print-page .print-muted { color: #64748b !important; }
              .print-block { page-break-inside: avoid; }
            }
          `}</style>

          <div className="print-page space-y-6">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="border-b border-slate-700/50 pb-4 print:border-slate-300">
              <h1 className="text-2xl font-bold text-slate-100 print:text-slate-900">
                {title}
              </h1>

              {version === 'trainer' && (
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-400 print:text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {participant_count} participants
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {project.total_minutes} min (start: {start_time})
                  </span>
                  <span className="capitalize">{experience_level} level</span>
                  {project.industry && <span>{project.industry}</span>}
                </div>
              )}
            </div>

            {/* ── Goals ───────────────────────────────────────────────────── */}
            {training_goals.length > 0 && (
              <Section
                icon={<Target className="w-4 h-4" />}
                title="Training Goals"
              >
                <ul className="space-y-1">
                  {training_goals.map((g, i) => (
                    <li key={i} className="text-sm text-slate-300 print:text-slate-700 flex gap-2">
                      <span className="text-blue-400 print-accent">-</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {version === 'trainer' && business_goals.length > 0 && (
              <Section
                icon={<Briefcase className="w-4 h-4" />}
                title="Business Goals"
              >
                <ul className="space-y-1">
                  {business_goals.map((g, i) => (
                    <li key={i} className="text-sm text-slate-300 print:text-slate-700 flex gap-2">
                      <span className="text-blue-400 print-accent">-</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* ── Agenda ──────────────────────────────────────────────────── */}
            <Section
              icon={<ClipboardList className="w-4 h-4" />}
              title="Agenda"
            >
              <div className="space-y-2">
                {blocks.map((block, index) => {
                  const { from, to } = getBlockTimeSlot(blocks, index, start_time);
                  const meta = BLOCK_TYPE_META[block.type];

                  return (
                    <div
                      key={block.id}
                      className="print-block rounded-lg border border-slate-700/50 print:border-slate-200 px-4 py-3 space-y-2"
                    >
                      {/* Block header row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400 print-muted min-w-[90px]">
                            {from} - {to}
                          </span>
                          <span className="text-sm font-semibold text-slate-100 print:text-slate-900">
                            {block.title}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded whitespace-nowrap shrink-0"
                          style={{
                            backgroundColor: meta.color + '20',
                            color: meta.color,
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>

                      {/* Block details */}
                      <div className="text-xs text-slate-400 print-muted space-y-1 pl-[98px]">
                        <span>{block.window_minutes} min</span>

                        {block.method && (
                          <p className="text-slate-300 print:text-slate-600">
                            {block.method}
                          </p>
                        )}

                        {/* Trainer-only fields */}
                        {version === 'trainer' && (
                          <>
                            {block.facilitator_notes && (
                              <div className="mt-1 p-2 bg-slate-800/50 print:bg-slate-50 rounded text-xs text-slate-300 print:text-slate-600 whitespace-pre-line">
                                <span className="font-semibold text-slate-400 print-muted">
                                  Notes:{' '}
                                </span>
                                {block.facilitator_notes}
                              </div>
                            )}
                            {block.materials && (
                              <p>
                                <span className="font-semibold text-slate-400 print-muted">
                                  Materials:{' '}
                                </span>
                                <span className="text-slate-300 print:text-slate-600">
                                  {block.materials}
                                </span>
                              </p>
                            )}
                            {block.workbook_link && (
                              <p>
                                <span className="font-semibold text-slate-400 print-muted">
                                  Workbook:{' '}
                                </span>
                                <a
                                  href={block.workbook_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 print-accent hover:underline break-all"
                                >
                                  {block.workbook_link}
                                </a>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* ── Trainer-only: Room requirements ─────────────────────────── */}
            {version === 'trainer' && (
              <Section
                icon={<Monitor className="w-4 h-4" />}
                title="Room Requirements"
              >
                <div className="flex flex-wrap gap-4 text-sm text-slate-300 print:text-slate-700">
                  <span>Tables: {needsTables ? 'Yes' : 'No'}</span>
                  <span>Flipcharts: {flipchartCount}</span>
                  <span>Screen/Projector: {needsScreen ? 'Yes' : 'No'}</span>
                </div>
              </Section>
            )}

            {/* ── Trainer-only: Materials checklist ───────────────────────── */}
            {version === 'trainer' && materials.length > 0 && (
              <Section
                icon={<FileText className="w-4 h-4" />}
                title="Materials Checklist"
              >
                <ul className="grid grid-cols-2 gap-1">
                  {materials.map((m, i) => (
                    <li key={i} className="text-sm text-slate-300 print:text-slate-700 flex gap-2">
                      <span className="text-slate-500">[ ]</span>
                      {m}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* ── Client-only: Forms of work summary ──────────────────────── */}
            {version === 'client' && formsOfWork.length > 0 && (
              <Section
                icon={<FileText className="w-4 h-4" />}
                title="Forms of Work"
              >
                <div className="flex flex-wrap gap-2">
                  {formsOfWork.map((f, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-full bg-slate-700/60 print:bg-slate-100 text-slate-300 print:text-slate-600 border border-slate-600/50 print:border-slate-200"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Goals recap (client version) ────────────────────────────── */}
            {version === 'client' && training_goals.length > 0 && (
              <Section
                icon={<Target className="w-4 h-4" />}
                title="After this training, participants will be able to:"
              >
                <ul className="space-y-1">
                  {training_goals.map((g, i) => (
                    <li key={i} className="text-sm text-slate-300 print:text-slate-700 flex gap-2">
                      <span className="text-green-400 print-accent">-</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section sub-component ────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300 print:text-slate-800 uppercase tracking-wider">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}
