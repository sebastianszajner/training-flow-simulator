import { describe, it, expect } from 'vitest';
import {
  calculateExperienceModifier,
  calculateOverhead,
  calculateInteractionMinutes,
  estimateBlockTime,
  getSuggestedQuestionCount,
  formatMinutesToTime,
} from './timeEngine';

// ── calculateExperienceModifier ─────────────────────────────────────────────

describe('calculateExperienceModifier', () => {
  it('returns +20% for novice', () => {
    expect(calculateExperienceModifier(100, 'novice')).toBe(20);
  });

  it('returns -20% for advanced', () => {
    expect(calculateExperienceModifier(100, 'advanced')).toBe(-20);
  });

  it('returns 0 for mixed', () => {
    expect(calculateExperienceModifier(100, 'mixed')).toBe(0);
  });

  it('scales proportionally with base_minutes', () => {
    expect(calculateExperienceModifier(50, 'novice')).toBe(10);
    expect(calculateExperienceModifier(200, 'advanced')).toBe(-40);
  });

  it('returns 0 for zero base_minutes regardless of level', () => {
    expect(calculateExperienceModifier(0, 'novice')).toBe(0);
    // 0 * -0.2 produces -0 in JS; numerically equivalent to 0
    expect(calculateExperienceModifier(0, 'advanced')).toBeCloseTo(0);
  });
});

// ── calculateOverhead ───────────────────────────────────────────────────────

describe('calculateOverhead', () => {
  it('calculates groups overhead correctly', () => {
    // 3 + 0.3 * 12 = 6.6
    expect(calculateOverhead(12, 'groups', 'horseshoe_tables')).toBe(6.6);
  });

  it('calculates pairs overhead correctly', () => {
    // 2 + 0.15 * 12 = 3.8
    expect(calculateOverhead(12, 'pairs', 'horseshoe_tables')).toBe(3.8);
  });

  it('calculates lecture overhead for lecture_20plus room', () => {
    // 1 (lecture base) + 1 (lecture_20plus bonus) = 2
    expect(calculateOverhead(12, 'lecture', 'lecture_20plus')).toBe(2);
  });

  it('calculates workbook overhead correctly', () => {
    // 1 + 0.1 * 10 = 2
    expect(calculateOverhead(10, 'workbook', 'horseshoe_no_tables')).toBe(2);
  });

  it('calculates video_debrief overhead correctly', () => {
    expect(calculateOverhead(12, 'video_debrief', 'horseshoe_tables')).toBe(2);
  });

  it('calculates energizer overhead correctly', () => {
    expect(calculateOverhead(12, 'energizer', 'horseshoe_tables')).toBe(1);
  });

  it('adds +1 for lecture_20plus room template', () => {
    const base = calculateOverhead(12, 'groups', 'horseshoe_tables');
    const withLargeRoom = calculateOverhead(12, 'groups', 'lecture_20plus');
    expect(withLargeRoom).toBe(base + 1);
  });
});

// ── calculateInteractionMinutes ─────────────────────────────────────────────

describe('calculateInteractionMinutes', () => {
  it('returns 0 when question_config is undefined', () => {
    expect(calculateInteractionMinutes(undefined, 12)).toBe(0);
  });

  it('calculates interaction time based on question config', () => {
    const config = {
      questions: ['Q1', 'Q2', 'Q3'],
      persons_per_question: 5,
      questions_per_group: 2,
      seconds_per_question_prompt: 15,
      seconds_per_answer: 30,
      expected_answers_per_question: 3,
    };

    // autoCount = ceil(12/5) * 2 = 3 * 2 = 6
    // questionsCount = max(6, 3) = 6
    // totalSeconds = 6 * (15 + 3 * 30) = 6 * 105 = 630
    // result = 630 / 60 = 10.5
    expect(calculateInteractionMinutes(config, 12)).toBe(10.5);
  });

  it('uses questions array length when larger than auto count', () => {
    const config = {
      questions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10'],
      persons_per_question: 5,
      questions_per_group: 1,
      seconds_per_question_prompt: 10,
      seconds_per_answer: 20,
      expected_answers_per_question: 2,
    };

    // autoCount = ceil(4/5) * 1 = 1
    // questionsCount = max(1, 10) = 10
    // totalSeconds = 10 * (10 + 2 * 20) = 10 * 50 = 500
    // result = 500 / 60 ≈ 8.333...
    expect(calculateInteractionMinutes(config, 4)).toBeCloseTo(8.333, 2);
  });
});

// ── estimateBlockTime ───────────────────────────────────────────────────────

describe('estimateBlockTime', () => {
  it('combines all components into total_minutes', () => {
    const result = estimateBlockTime({
      base_minutes: 30,
      experience_level: 'novice',
      participant_count: 12,
      method: 'groups',
      room_template: 'horseshoe_tables',
    });

    // experience: 30 * 0.2 = 6
    // overhead: 3 + 0.3 * 12 = 6.6
    // interaction: 0 (no question_config)
    // total: 30 + 6 + 6.6 + 0 = 42.6
    expect(result.base_minutes).toBe(30);
    expect(result.experience_modifier_minutes).toBe(6);
    expect(result.overhead_minutes).toBe(6.6);
    expect(result.interaction_minutes).toBe(0);
    expect(result.total_minutes).toBe(42.6);
  });

  it('total equals sum of all components', () => {
    const result = estimateBlockTime({
      base_minutes: 20,
      experience_level: 'advanced',
      participant_count: 8,
      method: 'pairs',
      room_template: 'horseshoe_no_tables',
      question_config: {
        questions: ['Q1'],
        persons_per_question: 4,
        questions_per_group: 1,
        seconds_per_question_prompt: 10,
        seconds_per_answer: 20,
        expected_answers_per_question: 2,
      },
    });

    const expectedTotal =
      result.base_minutes +
      result.experience_modifier_minutes +
      result.overhead_minutes +
      result.interaction_minutes;

    expect(result.total_minutes).toBeCloseTo(expectedTotal, 10);
  });

  it('includes interaction time when question_config is provided', () => {
    const result = estimateBlockTime({
      base_minutes: 20,
      experience_level: 'mixed',
      participant_count: 10,
      method: 'lecture',
      room_template: 'horseshoe_tables',
      question_config: {
        questions: ['Q1', 'Q2'],
        persons_per_question: 5,
        questions_per_group: 2,
        seconds_per_question_prompt: 15,
        seconds_per_answer: 30,
        expected_answers_per_question: 3,
      },
    });

    expect(result.interaction_minutes).toBeGreaterThan(0);
  });
});

// ── getSuggestedQuestionCount ───────────────────────────────────────────────

describe('getSuggestedQuestionCount', () => {
  it('calculates ceil(participants/persons_per_question) * questions_per_group', () => {
    // ceil(12/5) * 2 = 3 * 2 = 6
    expect(getSuggestedQuestionCount(12, 5, 2)).toBe(6);
  });

  it('rounds up partial groups', () => {
    // ceil(7/3) * 1 = 3 * 1 = 3
    expect(getSuggestedQuestionCount(7, 3, 1)).toBe(3);
  });

  it('handles exact division', () => {
    // ceil(10/5) * 2 = 2 * 2 = 4
    expect(getSuggestedQuestionCount(10, 5, 2)).toBe(4);
  });

  it('handles single participant per question', () => {
    // ceil(8/1) * 1 = 8
    expect(getSuggestedQuestionCount(8, 1, 1)).toBe(8);
  });
});

// ── formatMinutesToTime ─────────────────────────────────────────────────────

describe('formatMinutesToTime', () => {
  it('formats 90 minutes as 01:30', () => {
    expect(formatMinutesToTime(90)).toBe('01:30');
  });

  it('formats 90 minutes with start time 09:00 as 10:30', () => {
    expect(formatMinutesToTime(90, '09:00')).toBe('10:30');
  });

  it('formats 0 minutes as 00:00', () => {
    expect(formatMinutesToTime(0)).toBe('00:00');
  });

  it('formats 0 minutes with start time as the start time itself', () => {
    expect(formatMinutesToTime(0, '14:30')).toBe('14:30');
  });

  it('wraps around 24 hours', () => {
    // 23:00 + 120 min = 01:00 (next day)
    expect(formatMinutesToTime(120, '23:00')).toBe('01:00');
  });

  it('pads single-digit hours and minutes', () => {
    expect(formatMinutesToTime(5)).toBe('00:05');
    expect(formatMinutesToTime(65)).toBe('01:05');
  });
});
