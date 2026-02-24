// ── Core Types ──────────────────────────────────────────────────────────────

export type ExperienceLevel = 'novice' | 'mixed' | 'advanced';

export type BlockType =
  | 'opening_questions'
  | 'contract'
  | 'lecture'
  | 'pairs'
  | 'groups'
  | 'workbook'
  | 'energizer'
  | 'video_debrief'
  | 'recap_module'
  | 'recap_day'
  | 'break';

export type BreakType = 'lunch' | 'coffee' | 'other';
export type Dynamics = 'low' | 'medium' | 'high';

export type RoomTemplate =
  | 'horseshoe_tables'
  | 'horseshoe_no_tables'
  | 'lecture_20plus';

export type RoomObjectType =
  | 'table'
  | 'chair'
  | 'flipchart'
  | 'screen'
  | 'projector'
  | 'zone'
  | 'facilitator_spot';

export type ViewMode = 'plan' | 'show';

// ── Question Config ─────────────────────────────────────────────────────────

export interface QuestionConfig {
  questions: string[];
  persons_per_question: number; // X in "2 questions per X persons"
  questions_per_group: number;  // default 2
  seconds_per_question_prompt: number;
  seconds_per_answer: number;
  expected_answers_per_question: number;
}

// ── Required Assets ─────────────────────────────────────────────────────────

export interface RequiredAssets {
  tables: boolean;
  flipchart_count: number;
  screen: boolean;
}

// ── Agenda Block ────────────────────────────────────────────────────────────

export interface AgendaBlock {
  id: string;
  type: BlockType;
  title: string;
  window_minutes: number;
  exercise_id?: string;
  method?: string;
  required_assets: RequiredAssets;
  materials: string;
  workbook_link: string;
  facilitator_notes: string;
  order: number;
  question_config?: QuestionConfig;
  // computed (not persisted, recalculated)
  estimated_minutes?: number;
  fits_in_window?: boolean;
}

// ── Break ───────────────────────────────────────────────────────────────────

export interface BreakConfig {
  id: string;
  type: BreakType;
  title: string;
  duration_minutes: number;
}

// ── Room ────────────────────────────────────────────────────────────────────

export interface RoomObject {
  id: string;
  type: RoomObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label?: string;
}

export interface RoomLayout {
  template: RoomTemplate;
  width: number;
  height: number;
  objects: RoomObject[];
  flipchart_count: number;
  has_screen: boolean;
  has_tables: boolean;
}

// ── Exercise (library item) ─────────────────────────────────────────────────

export interface Exercise {
  id: string;
  title: string;
  type: BlockType;
  description: string;
  time_range_min: number;
  time_range_max: number;
  participant_range_min: number;
  participant_range_max: number;
  requires_tables: boolean;
  requires_flipchart_count: number;
  requires_screen: boolean;
  dynamics: Dynamics;
  facilitator_steps: string[];
  workbook_link: string;
  tags: string[];
}

// ── Training Project ────────────────────────────────────────────────────────

export interface TrainingProject {
  id: string;
  schema_version: string;
  title: string;
  industry: string;
  participant_count: number;
  experience_level: ExperienceLevel;
  total_minutes: number;
  start_time: string; // HH:MM
  business_goals: string[];
  training_goals: string[];
  blocks: AgendaBlock[];
  room: RoomLayout;
  created_at: string;
  updated_at: string;
}

// ── Time Engine Results ─────────────────────────────────────────────────────

export interface TimeEstimate {
  base_minutes: number;
  experience_modifier_minutes: number;
  overhead_minutes: number;
  interaction_minutes: number;
  total_minutes: number;
}

// ── Fit Engine Results ──────────────────────────────────────────────────────

export interface FitResult {
  exercise_id: string;
  fits: boolean;
  estimated_minutes: number;
  reason?: string;
}

export interface Recommendation {
  exercise: Exercise;
  estimated_minutes: number;
  fit_score: number;
  reason: string;
}

// ── Energy Curve (bonus feature) ────────────────────────────────────────────

export interface EnergyPoint {
  block_id: string;
  block_title: string;
  position_minutes: number;
  energy_level: Dynamics;
  energy_value: number; // 1-3 numeric
  warning?: string;
}

// ── Schema version ──────────────────────────────────────────────────────────

export const SCHEMA_VERSION = '1.0.0';

// ── Block type metadata ─────────────────────────────────────────────────────

export const BLOCK_TYPE_META: Record<BlockType, { label: string; icon: string; color: string; defaultMinutes: number }> = {
  opening_questions: { label: 'Opening + Questions', icon: 'MessageCircle', color: '#4CAF50', defaultMinutes: 20 },
  contract:          { label: 'Contract',            icon: 'FileCheck',     color: '#2196F3', defaultMinutes: 10 },
  lecture:           { label: 'Lecture',              icon: 'BookOpen',      color: '#9C27B0', defaultMinutes: 30 },
  pairs:             { label: 'Pairs Work',          icon: 'Users',         color: '#FF9800', defaultMinutes: 20 },
  groups:            { label: 'Group Work',           icon: 'UsersRound',    color: '#E91E63', defaultMinutes: 30 },
  workbook:          { label: 'Workbook',             icon: 'NotebookPen',   color: '#00BCD4', defaultMinutes: 15 },
  energizer:         { label: 'Energizer / Standup',  icon: 'Zap',           color: '#FFC107', defaultMinutes: 10 },
  video_debrief:     { label: 'Video + Debrief',      icon: 'Video',         color: '#795548', defaultMinutes: 25 },
  recap_module:      { label: 'Module Recap',          icon: 'RotateCcw',     color: '#607D8B', defaultMinutes: 10 },
  recap_day:         { label: 'Day Recap',             icon: 'CalendarCheck', color: '#3F51B5', defaultMinutes: 15 },
  break:             { label: 'Break',                 icon: 'Coffee',        color: '#8BC34A', defaultMinutes: 15 },
};
