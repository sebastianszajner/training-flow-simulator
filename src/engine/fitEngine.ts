import type {
  Exercise,
  AgendaBlock,
  RoomLayout,
  ExperienceLevel,
  Recommendation,
  FitResult,
} from '../model/types';
import { EXERCISE_LIBRARY } from '../library/exercises';
import { estimateBlockTime } from './timeEngine';

// ── Check Single Exercise Fit ───────────────────────────────────────────────
// Hard filters: participants, room assets, time window.

export function checkExerciseFit(
  exercise: Exercise,
  block: AgendaBlock,
  room: RoomLayout,
  participant_count: number,
  experience_level: ExperienceLevel,
): FitResult {
  // 1. Participant range check
  if (
    participant_count < exercise.participant_range_min ||
    participant_count > exercise.participant_range_max
  ) {
    return {
      exercise_id: exercise.id,
      fits: false,
      estimated_minutes: 0,
      reason: `Participant count ${participant_count} outside range ${exercise.participant_range_min}-${exercise.participant_range_max}`,
    };
  }

  // 2. Tables requirement
  if (exercise.requires_tables && !room.has_tables) {
    return {
      exercise_id: exercise.id,
      fits: false,
      estimated_minutes: 0,
      reason: 'Exercise requires tables but room has none',
    };
  }

  // 3. Flipchart requirement
  if (exercise.requires_flipchart_count > room.flipchart_count) {
    return {
      exercise_id: exercise.id,
      fits: false,
      estimated_minutes: 0,
      reason: `Exercise needs ${exercise.requires_flipchart_count} flipcharts, room has ${room.flipchart_count}`,
    };
  }

  // 4. Screen requirement
  if (exercise.requires_screen && !room.has_screen) {
    return {
      exercise_id: exercise.id,
      fits: false,
      estimated_minutes: 0,
      reason: 'Exercise requires a screen but room has none',
    };
  }

  // 5. Time estimate using exercise.time_range_max as base
  const estimate = estimateBlockTime({
    base_minutes: exercise.time_range_max,
    experience_level,
    participant_count,
    method: exercise.type,
    room_template: room.template,
    question_config: block.question_config,
  });

  // 6. Time window check
  if (estimate.total_minutes > block.window_minutes) {
    return {
      exercise_id: exercise.id,
      fits: false,
      estimated_minutes: estimate.total_minutes,
      reason: `Estimated ${estimate.total_minutes.toFixed(1)} min exceeds ${block.window_minutes} min window`,
    };
  }

  return {
    exercise_id: exercise.id,
    fits: true,
    estimated_minutes: estimate.total_minutes,
  };
}

// ── Score a fitting exercise ────────────────────────────────────────────────

function scoreExercise(
  exercise: Exercise,
  block: AgendaBlock,
  estimated_minutes: number,
  participant_count: number,
): number {
  // fits_time (40%): how well the estimated time fills the window (closer to 100% = better)
  const timeRatio = estimated_minutes / block.window_minutes;
  const fitsTimeScore = timeRatio <= 1 ? timeRatio : 0;

  // participant_match (30%): how centered the participant count is in the exercise range
  const range = exercise.participant_range_max - exercise.participant_range_min;
  const midpoint = exercise.participant_range_min + range / 2;
  const deviation = Math.abs(participant_count - midpoint);
  const participantScore = range > 0 ? 1 - deviation / (range / 2) : 1;
  const clampedParticipantScore = Math.max(0, Math.min(1, participantScore));

  // asset_match (20%): bonus for not needing more assets than available
  // Already filtered, so give full score if fits; minor penalty for requiring many assets
  const assetDemand =
    (exercise.requires_tables ? 1 : 0) +
    exercise.requires_flipchart_count +
    (exercise.requires_screen ? 1 : 0);
  const assetScore = Math.max(0, 1 - assetDemand * 0.1);

  // dynamics_variety (10%): prefer exercises that match block dynamics expectation
  // Simple heuristic: energizers should be high, lectures low, etc.
  const dynamicsScore = 1; // neutral — full variety scoring needs full agenda context

  return (
    fitsTimeScore * 0.4 +
    clampedParticipantScore * 0.3 +
    assetScore * 0.2 +
    dynamicsScore * 0.1
  );
}

// ── Generate reason string ──────────────────────────────────────────────────

function generateReason(
  exercise: Exercise,
  estimated_minutes: number,
  block: AgendaBlock,
): string {
  const timeUsage = Math.round((estimated_minutes / block.window_minutes) * 100);
  return `${exercise.title} fills ${timeUsage}% of the ${block.window_minutes}-min window for ${exercise.participant_range_min}-${exercise.participant_range_max} participants.`;
}

// ── Get Recommendations ─────────────────────────────────────────────────────
// Returns top 5: 3 main + 2 rescue (shorter alternatives).

export function getRecommendations(
  block: AgendaBlock,
  room: RoomLayout,
  participant_count: number,
  experience_level: ExperienceLevel,
): Recommendation[] {
  // 1. Filter exercises by block type
  const candidates = EXERCISE_LIBRARY.filter((ex) => ex.type === block.type);

  // 2. Run fit check on each
  const scored: Array<{
    exercise: Exercise;
    fitResult: FitResult;
    score: number;
  }> = [];

  for (const exercise of candidates) {
    const fitResult = checkExerciseFit(
      exercise,
      block,
      room,
      participant_count,
      experience_level,
    );

    if (!fitResult.fits) continue;

    const score = scoreExercise(
      exercise,
      block,
      fitResult.estimated_minutes,
      participant_count,
    );

    scored.push({ exercise, fitResult, score });
  }

  // 3. Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // 4. Build recommendations: top 3 main + 2 rescue (shorter alternatives)
  const mainPicks = scored.slice(0, 3);

  // Rescue picks: prefer exercises whose time_range_max < 70% of window
  const rescueThreshold = block.window_minutes * 0.7;
  const rescueCandidates = scored
    .filter(
      (s) =>
        !mainPicks.includes(s) &&
        s.exercise.time_range_max < rescueThreshold,
    )
    .slice(0, 2);

  // If not enough rescue candidates from the filtered set, take next from scored
  const remaining = scored.filter(
    (s) => !mainPicks.includes(s) && !rescueCandidates.includes(s),
  );
  while (rescueCandidates.length < 2 && remaining.length > 0) {
    rescueCandidates.push(remaining.shift()!);
  }

  const allPicks = [...mainPicks, ...rescueCandidates];

  return allPicks.map(({ exercise, fitResult, score }) => ({
    exercise,
    estimated_minutes: fitResult.estimated_minutes,
    fit_score: Math.round(score * 100) / 100,
    reason: generateReason(exercise, fitResult.estimated_minutes, block),
  }));
}

// ── Quick Alternatives (rescue) ─────────────────────────────────────────────
// Returns 2 very short exercises that fit. Prefers time_range_max < 70% of window.

export function getQuickAlternatives(
  block: AgendaBlock,
  room: RoomLayout,
  participant_count: number,
  experience_level: ExperienceLevel,
): Recommendation[] {
  const rescueThreshold = block.window_minutes * 0.7;

  const candidates = EXERCISE_LIBRARY.filter(
    (ex) => ex.type === block.type && ex.time_range_max < rescueThreshold,
  );

  const scored: Array<{
    exercise: Exercise;
    fitResult: FitResult;
    score: number;
  }> = [];

  for (const exercise of candidates) {
    const fitResult = checkExerciseFit(
      exercise,
      block,
      room,
      participant_count,
      experience_level,
    );

    if (!fitResult.fits) continue;

    const score = scoreExercise(
      exercise,
      block,
      fitResult.estimated_minutes,
      participant_count,
    );

    scored.push({ exercise, fitResult, score });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map(({ exercise, fitResult, score }) => ({
    exercise,
    estimated_minutes: fitResult.estimated_minutes,
    fit_score: Math.round(score * 100) / 100,
    reason: generateReason(exercise, fitResult.estimated_minutes, block),
  }));
}
