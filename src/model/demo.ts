import { v4 as uuidv4 } from 'uuid';
import type { TrainingProject, AgendaBlock, RoomLayout } from './types';
import { SCHEMA_VERSION } from './types';

// ── Helper ────────────────────────────────────────────────────────────────────

function block(
  order: number,
  type: AgendaBlock['type'],
  title: string,
  window_minutes: number,
  opts: Partial<Pick<AgendaBlock, 'exercise_id' | 'method' | 'facilitator_notes' | 'materials' | 'workbook_link' | 'required_assets' | 'question_config'>> = {},
): AgendaBlock {
  return {
    id: uuidv4(),
    type,
    title,
    window_minutes,
    order,
    exercise_id: opts.exercise_id,
    method: opts.method,
    facilitator_notes: opts.facilitator_notes ?? '',
    materials: opts.materials ?? '',
    workbook_link: opts.workbook_link ?? '',
    required_assets: opts.required_assets ?? { tables: false, flipchart_count: 0, screen: false },
    question_config: opts.question_config,
  };
}

// ── Room layout: horseshoe_tables for 12 ──────────────────────────────────────

function createDemoRoom(): RoomLayout {
  const W = 800;
  const H = 600;

  return {
    template: 'horseshoe_tables',
    width: W,
    height: H,
    flipchart_count: 2,
    has_screen: true,
    has_tables: true,
    objects: [
      // Screen — top center
      { id: uuidv4(), type: 'screen', x: 350, y: 20, width: 100, height: 15, rotation: 0, label: 'Screen' },
      // Facilitator spot — below screen
      { id: uuidv4(), type: 'facilitator_spot', x: 370, y: 60, width: 60, height: 30, rotation: 0, label: 'Facilitator' },

      // ── Left arm (4 participants) ──
      { id: uuidv4(), type: 'table', x: 150, y: 160, width: 120, height: 40, rotation: 0 },
      { id: uuidv4(), type: 'chair', x: 120, y: 165, width: 25, height: 25, rotation: 0 },
      { id: uuidv4(), type: 'chair', x: 120, y: 215, width: 25, height: 25, rotation: 0 },
      { id: uuidv4(), type: 'table', x: 150, y: 260, width: 120, height: 40, rotation: 0 },
      { id: uuidv4(), type: 'chair', x: 120, y: 265, width: 25, height: 25, rotation: 0 },
      { id: uuidv4(), type: 'chair', x: 120, y: 315, width: 25, height: 25, rotation: 0 },

      // ── Bottom arm (4 participants) ──
      { id: uuidv4(), type: 'table', x: 280, y: 400, width: 40, height: 120, rotation: 0 },
      { id: uuidv4(), type: 'chair', x: 285, y: 530, width: 25, height: 25, rotation: 0 },
      { id: uuidv4(), type: 'chair', x: 335, y: 530, width: 25, height: 25, rotation: 0 },
      { id: uuidv4(), type: 'table', x: 380, y: 400, width: 40, height: 120, rotation: 0 },
      { id: uuidv4(), type: 'chair', x: 385, y: 530, width: 25, height: 25, rotation: 0 },
      { id: uuidv4(), type: 'chair', x: 435, y: 530, width: 25, height: 25, rotation: 0 },

      // ── Right arm (4 participants) ──
      { id: uuidv4(), type: 'table', x: 530, y: 160, width: 120, height: 40, rotation: 0 },
      { id: uuidv4(), type: 'chair', x: 660, y: 165, width: 25, height: 25, rotation: 0 },
      { id: uuidv4(), type: 'chair', x: 660, y: 215, width: 25, height: 25, rotation: 0 },
      { id: uuidv4(), type: 'table', x: 530, y: 260, width: 120, height: 40, rotation: 0 },
      { id: uuidv4(), type: 'chair', x: 660, y: 265, width: 25, height: 25, rotation: 0 },
      { id: uuidv4(), type: 'chair', x: 660, y: 315, width: 25, height: 25, rotation: 0 },

      // Flipcharts — corners
      { id: uuidv4(), type: 'flipchart', x: 30, y: 30, width: 50, height: 40, rotation: 0, label: 'Flipchart 1' },
      { id: uuidv4(), type: 'flipchart', x: 720, y: 30, width: 50, height: 40, rotation: 0, label: 'Flipchart 2' },
    ],
  };
}

// ── Demo agenda blocks (14 blocks, 480 min total) ─────────────────────────────

function createDemoBlocks(): AgendaBlock[] {
  return [
    // 1. Opening + Questions — 30 min
    block(1, 'opening_questions', 'Opening + Expectations Round', 30, {
      exercise_id: 'opening-expectations-round',
      method:
        'Participants introduce themselves and share one expectation for the day. Facilitator captures expectations on a flipchart and maps them to agenda items.',
      facilitator_notes:
        'Arrive early, set up flipchart with two columns: Name | Expectation. Welcome each person individually. After the round, highlight which agenda blocks address which expectations.',
      materials: 'flipchart, markers, name-tags',
      required_assets: { tables: true, flipchart_count: 1, screen: false },
    }),

    // 2. Contract — 15 min
    block(2, 'contract', 'Team Contract', 15, {
      exercise_id: 'contract-team-canvas',
      method:
        'Co-create a working agreement using Team Canvas. Groups propose rules, then the whole team votes on the final set.',
      facilitator_notes:
        'Keep it lightweight — max 5-6 rules. Pin the final canvas on the wall for the entire day. Refer back to it if energy drops.',
      materials: 'A1-paper, markers, sticky-notes, voting-dots',
      required_assets: { tables: true, flipchart_count: 1, screen: false },
    }),

    // 3. Lecture: Core AI Concepts — 50 min
    block(3, 'lecture', 'What is AI? Core Concepts', 50, {
      exercise_id: 'lecture-interactive-mini',
      method:
        'Interactive mini-lecture with 3 knowledge-check questions embedded. Covers: AI vs ML vs GenAI, how LLMs work (simplified), capabilities and limitations.',
      facilitator_notes:
        'Use poll questions every 10 min to keep engagement. Show live ChatGPT demo for the "wow moment." Keep jargon minimal — audience is mixed experience.',
      materials: 'slides, screen, clicker, poll-tool',
      required_assets: { tables: true, flipchart_count: 0, screen: true },
    }),

    // 4. Break: Coffee — 15 min
    block(4, 'break', 'Coffee Break', 15, {
      materials: 'coffee, tea, snacks',
      facilitator_notes: 'Check energy level when participants return.',
    }),

    // 5. Pairs: Prompt Engineering Practice — 40 min
    block(5, 'pairs', 'Prompt Engineering Practice', 40, {
      exercise_id: 'pairs-think-pair-share',
      method:
        'Think-Pair-Share: each person writes 3 prompts for their real work tasks (Think), then pairs compare results and refine (Pair), then best prompts are shared with group (Share).',
      facilitator_notes:
        'Provide a prompt template cheat-sheet. Walk around during pair work to spot common mistakes. Collect 2-3 great prompts for the plenary share.',
      materials: 'laptops, prompt-cheatsheet, workbook',
      workbook_link: '#prompt-engineering-practice',
      required_assets: { tables: true, flipchart_count: 0, screen: true },
    }),

    // 6. Groups: AI Use Case Mapping — 50 min
    block(6, 'groups', 'AI Use Case Mapping', 50, {
      exercise_id: 'groups-case-study-analysis',
      method:
        'In groups of 3-4, participants analyze real department workflows and identify where AI can add value. Each group maps use cases on an Impact/Effort matrix and selects their top 3.',
      facilitator_notes:
        'Pre-assign groups to mix departments. Provide printed workflow templates. Each group presents their top 3 use cases — keep presentations to 3 min max per group.',
      materials: 'A1-paper, markers, impact-effort-matrix-template, sticky-notes, timer',
      required_assets: { tables: true, flipchart_count: 2, screen: true },
    }),

    // 7. Break: Lunch — 60 min
    block(7, 'break', 'Lunch Break', 60, {
      materials: 'catering',
      facilitator_notes: 'Set up afternoon materials during lunch. Rearrange room if needed for group work.',
    }),

    // 8. Energizer — 15 min
    block(8, 'energizer', 'Human Rock-Paper-Scissors', 15, {
      exercise_id: 'energizer-human-rock-paper-scissors',
      method:
        'Full-body rock-paper-scissors tournament. Losers become cheerleaders for the winner. Continues until a champion emerges.',
      facilitator_notes:
        'Great post-lunch energizer. Demo the full-body poses first. Keep it fast — 3-4 rounds max. End with applause for the champion.',
      materials: 'open-space',
      required_assets: { tables: false, flipchart_count: 0, screen: false },
    }),

    // 9. Video + Debrief: AI in Action — 35 min
    block(9, 'video_debrief', 'AI in Action — Case Study', 35, {
      exercise_id: 'video-case-study-documentary',
      method:
        'Watch a 10-min documentary-style video showing AI implementation at a similar company. Follow with structured debrief: What surprised you? What applies to us? What concerns do you have?',
      facilitator_notes:
        'Test video playback before the session. Prepare 3 debrief questions on a slide. Give 2 min silent reflection before opening discussion.',
      materials: 'video-file, screen, speakers, debrief-questions-slide',
      required_assets: { tables: true, flipchart_count: 0, screen: true },
    }),

    // 10. Workbook: AI Workflow Design — 30 min
    block(10, 'workbook', 'AI Workflow Design', 30, {
      exercise_id: 'workbook-reflection-journal',
      method:
        'Individual workbook exercise: participants sketch their ideal AI-enhanced workflow using a structured template. Covers: current process, AI touchpoints, expected time savings, risks.',
      facilitator_notes:
        'Play soft background music. Walk around to offer 1-on-1 guidance. Remind participants this is their personal action artifact — they keep it.',
      materials: 'workbook, pens',
      workbook_link: '#ai-workflow-design',
      required_assets: { tables: true, flipchart_count: 0, screen: false },
    }),

    // 11. Break: Coffee — 15 min
    block(11, 'break', 'Afternoon Coffee', 15, {
      materials: 'coffee, tea, fruit',
      facilitator_notes: 'Prepare World Café stations during the break.',
    }),

    // 12. Groups: Implementation Planning — 55 min
    block(12, 'groups', 'Implementation Planning — World Café', 55, {
      exercise_id: 'groups-world-cafe',
      method:
        'World Café with 3 stations: (1) Quick Wins — what can we start tomorrow? (2) Infrastructure — what tools/access do we need? (3) Change Management — how do we bring the team along? Groups rotate every 15 min.',
      facilitator_notes:
        'Assign a table host per station who stays and summarizes for each new group. Provide clear rotation signals. Final 5 min: table hosts present consolidated insights.',
      materials: 'A1-paper, markers, station-cards, timer, bell',
      required_assets: { tables: true, flipchart_count: 2, screen: false },
    }),

    // 13. Recap Module — 20 min
    block(13, 'recap_module', 'Module Recap — One Word Checkout', 20, {
      exercise_id: 'recap-module-one-word-checkout',
      method:
        'Each participant shares one word that captures their key takeaway from the implementation planning module. Facilitator groups words into themes on a flipchart.',
      facilitator_notes:
        'Go around the horseshoe in order. Write each word on a sticky note and cluster on the flipchart. Use clusters to bridge into the day recap.',
      materials: 'sticky-notes, flipchart, markers',
      required_assets: { tables: true, flipchart_count: 1, screen: false },
    }),

    // 14. Recap Day — 50 min
    block(14, 'recap_day', 'Day Recap — Gallery Walk', 50, {
      exercise_id: 'recap-day-gallery-walk',
      method:
        'All flipcharts and outputs from the day are displayed as a gallery. Participants walk through, add comments on sticky notes, and vote for the most impactful idea with dot stickers.',
      facilitator_notes:
        'Set up gallery during module recap. Include: expectations flipchart, contract, use case matrices, implementation plans. Close with top-voted idea and a call to action for Monday.',
      materials: 'all-day-flipcharts, sticky-notes, voting-dots, markers',
      required_assets: { tables: false, flipchart_count: 2, screen: false },
    }),
  ];
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function createDemoProject(): TrainingProject {
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    schema_version: SCHEMA_VERSION,
    title: 'AI in Business – Workshop',
    industry: 'Corporate / Cross-industry',
    participant_count: 12,
    experience_level: 'mixed',
    total_minutes: 480,
    start_time: '09:00',
    business_goals: [
      'Increase AI adoption in daily workflows',
      'Build team competency for AI tools',
      'Identify 3 quick-win AI use cases per department',
    ],
    training_goals: [
      'Understand core AI concepts and limitations',
      'Practice prompt engineering techniques',
      'Design AI-powered workflow improvements',
      'Build an AI implementation action plan',
    ],
    blocks: createDemoBlocks(),
    room: createDemoRoom(),
    created_at: now,
    updated_at: now,
  };
}
