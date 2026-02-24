import type {
  ExperienceLevel,
  BlockType,
  QuestionConfig,
  RoomTemplate,
  TimeEstimate,
} from '../model/types';

// ── Experience Modifier ─────────────────────────────────────────────────────
// Returns the delta minutes (not the total).
// novice: +20%, mixed: 0, advanced: -20%

export function calculateExperienceModifier(
  base_minutes: number,
  level: ExperienceLevel,
): number {
  switch (level) {
    case 'novice':
      return base_minutes * 0.2;
    case 'advanced':
      return base_minutes * -0.2;
    case 'mixed':
    default:
      return 0;
  }
}

// ── Overhead ────────────────────────────────────────────────────────────────
// Transition / setup overhead based on method and room size.

export function calculateOverhead(
  participant_count: number,
  method: BlockType,
  room_template: RoomTemplate,
): number {
  let overhead: number;

  switch (method) {
    case 'groups':
      overhead = 3 + 0.3 * participant_count;
      break;
    case 'pairs':
      overhead = 2 + 0.15 * participant_count;
      break;
    case 'workbook':
      overhead = 1 + 0.1 * participant_count;
      break;
    case 'video_debrief':
      overhead = 2;
      break;
    case 'lecture':
      overhead = 1;
      break;
    case 'energizer':
      overhead = 1;
      break;
    default:
      overhead = 0.5;
      break;
  }

  // Larger room = more transition time
  if (room_template === 'lecture_20plus') {
    overhead += 1;
  }

  return overhead;
}

// ── Interaction Minutes ─────────────────────────────────────────────────────
// Time consumed by Q&A / interaction rounds.

export function calculateInteractionMinutes(
  question_config: QuestionConfig | undefined,
  participant_count: number,
): number {
  if (!question_config) return 0;

  const autoCount = getSuggestedQuestionCount(
    participant_count,
    question_config.persons_per_question,
    question_config.questions_per_group,
  );

  const questionsCount = Math.max(autoCount, question_config.questions.length);

  const totalSeconds =
    questionsCount *
    (question_config.seconds_per_question_prompt +
      question_config.expected_answers_per_question *
        question_config.seconds_per_answer);

  return totalSeconds / 60;
}

// ── Estimate Block Time ─────────────────────────────────────────────────────
// Combines experience modifier, overhead, and interaction into a full estimate.

export function estimateBlockTime(params: {
  base_minutes: number;
  experience_level: ExperienceLevel;
  participant_count: number;
  method: BlockType;
  room_template: RoomTemplate;
  question_config?: QuestionConfig;
}): TimeEstimate {
  const {
    base_minutes,
    experience_level,
    participant_count,
    method,
    room_template,
    question_config,
  } = params;

  const experience_modifier_minutes = calculateExperienceModifier(
    base_minutes,
    experience_level,
  );

  const overhead_minutes = calculateOverhead(
    participant_count,
    method,
    room_template,
  );

  const interaction_minutes = calculateInteractionMinutes(
    question_config,
    participant_count,
  );

  const total_minutes =
    base_minutes +
    experience_modifier_minutes +
    overhead_minutes +
    interaction_minutes;

  return {
    base_minutes,
    experience_modifier_minutes,
    overhead_minutes,
    interaction_minutes,
    total_minutes,
  };
}

// ── Suggested Question Count ────────────────────────────────────────────────

export function getSuggestedQuestionCount(
  participant_count: number,
  persons_per_question: number,
  questions_per_group: number,
): number {
  return Math.ceil(participant_count / persons_per_question) * questions_per_group;
}

// ── Format Minutes to Time ──────────────────────────────────────────────────
// Converts a minutes offset to HH:MM. If start_time provided, adds offset.

export function formatMinutesToTime(
  minutes: number,
  start_time?: string,
): string {
  let totalMinutes = Math.round(minutes);

  if (start_time) {
    const [hours, mins] = start_time.split(':').map(Number);
    totalMinutes += hours * 60 + mins;
  }

  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
