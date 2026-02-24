import { useState, useRef, useEffect } from 'react';
import {
  LayoutGrid,
  Save,
  Download,
  FileJson,
  FileText,
  Eye,
  Pencil,
  ChevronDown,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import Button from './Button';

const SCREENS = ['setup', 'timeline', 'room', 'simulation'] as const;

const SCREEN_LABELS: Record<(typeof SCREENS)[number], string> = {
  setup: 'Setup',
  timeline: 'Timeline',
  room: 'Room',
  simulation: 'Simulation',
};

interface HeaderProps {
  onExport?: () => void;
}

export default function Header({ onExport }: HeaderProps) {
  const {
    project,
    currentScreen,
    setScreen,
    viewMode,
    setViewMode,
    saveProject,
    exportProject,
  } = useProjectStore();

  const [exportOpen, setExportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    if (exportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportOpen]);

  const handleSave = async () => {
    setSaving(true);
    await saveProject();
    setSaving(false);
  };

  const handleExportJSON = () => {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.title ?? 'project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const handleExportText = () => {
    if (!project) return;
    const lines: string[] = [
      `# ${project.title}`,
      `Industry: ${project.industry || '(none)'}`,
      `Participants: ${project.participant_count}`,
      `Experience: ${project.experience_level}`,
      `Duration: ${project.total_minutes} min`,
      `Start: ${project.start_time}`,
      '',
      '## Blocks',
    ];
    project.blocks.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.title} (${b.window_minutes} min)`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title ?? 'project'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  return (
    <header className="flex items-center justify-between h-14 px-4 bg-slate-900 border-b border-slate-700/60 select-none shrink-0">
      {/* Left: Logo + name */}
      <div className="flex items-center gap-2.5">
        <LayoutGrid className="w-5 h-5 text-blue-500" />
        <span className="text-sm font-semibold tracking-tight text-slate-100 hidden sm:inline">
          Training Flow Simulator
        </span>
      </div>

      {/* Center: Tabs */}
      <nav className="flex items-center gap-1">
        {SCREENS.map((screen) => {
          const isActive = currentScreen === screen;
          const needsProject = screen !== 'setup';
          const disabled = needsProject && !project;

          return (
            <button
              key={screen}
              onClick={() => !disabled && setScreen(screen)}
              disabled={disabled}
              className={`
                relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer
                ${disabled ? 'text-slate-600 cursor-not-allowed' : ''}
                ${isActive ? 'text-blue-400' : ''}
                ${!isActive && !disabled ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : ''}
              `}
            >
              {SCREEN_LABELS[screen]}
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: View toggle + Save + Export */}
      <div className="flex items-center gap-2">
        {/* View mode toggle */}
        {project && (
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700/50">
            <button
              onClick={() => setViewMode('plan')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                viewMode === 'plan'
                  ? 'bg-slate-700 text-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Pencil className="w-3 h-3" />
              Plan
            </button>
            <button
              onClick={() => setViewMode('show')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                viewMode === 'show'
                  ? 'bg-slate-700 text-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3 h-3" />
              Show
            </button>
          </div>
        )}

        {/* Save */}
        {project && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        )}

        {/* Export dropdown */}
        {project && (
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExportOpen(!exportOpen)}
            >
              <Download className="w-3.5 h-3.5" />
              Export
              <ChevronDown className="w-3 h-3" />
            </Button>

            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1">
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors cursor-pointer"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  Export JSON
                </button>
                <button
                  onClick={handleExportText}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Export Text
                </button>
                {onExport && (
                  <button
                    onClick={() => { onExport(); setExportOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Print View
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
