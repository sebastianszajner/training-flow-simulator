# Training Flow Simulator

A web application for designing and presenting training session flows. Built for trainers who need to quickly plan training agendas and demo them to clients.

## Features

- **Project Setup** -- Define training parameters (participants, duration, experience level, business and training goals, industry)
- **Timeline Builder** -- Block-based agenda editor with drag & drop reordering and time validation
- **Room Builder** -- Canvas-based room layout editor with templates (horseshoe with tables, horseshoe without tables, lecture hall 20+)
- **Simulation Mode** -- Animated walkthrough with participant tokens and real-time playback controls
- **Exercise Library** -- 30 built-in exercises with metadata, time estimation, and smart recommendations
- **Time Engine** -- Calculates realistic timing with experience modifiers, overhead, and interaction time
- **Fit Engine (Tetris)** -- Validates exercises fit time windows, suggests alternatives with scoring
- **Energy Curve** -- Visualizes energy dynamics across the training day with warnings for problematic sequences
- **Dual View Modes** -- Plan (trainer) and Show (client) views
- **Export** -- JSON import/export, print-ready trainer and client versions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript 5.9 |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 |
| State | Zustand 5 |
| Icons | Lucide React |
| IDs | uuid |
| Testing | Vitest 4 |
| Canvas API | Room rendering and animation (native requestAnimationFrame) |

### Why Canvas over SVG?

Canvas was chosen for room rendering because:

1. Better performance with many animated objects (participant tokens with micro-movement)
2. Game-like feel (Sims-style) requires smooth 60fps rendering loop
3. Easier batch rendering of complex scenes (tables with wood grain, chairs with 3D highlights, flipcharts with paper texture, zones with dashed borders)
4. `requestAnimationFrame` integration is more natural with imperative drawing

## Quick Start

```bash
npm install
npm run dev        # Development server at http://localhost:5173
npm run build      # Production build (tsc + vite build)
npm run lint       # ESLint
npx vitest         # Run tests
npx vitest --run   # Run tests once (CI mode)
```

## Loading Demo Project

The app includes a built-in demo project. On the Setup screen, click "Load Demo" or import the demo JSON to see a fully configured **"AI in Business -- Workshop"** with:

- 14 agenda blocks across a full 480-minute (8-hour) day
- 12 participants, mixed experience level
- Horseshoe with tables room layout (screen, facilitator spot, 6 tables, 12 chairs, 2 flipcharts)
- Exercises covering: opening, contract, lecture, pairs, groups, workbook, energizer, video debrief, and recaps

## Project Structure

```
src/
├── model/                       # TypeScript types and data model
│   ├── types.ts                 # All interfaces, enums, constants, block metadata
│   └── demo.ts                  # Demo project generator (AI in Business workshop)
├── engine/                      # Core logic engines
│   ├── timeEngine.ts            # Time estimation engine
│   ├── timeEngine.test.ts       # Vitest tests for time engine
│   └── fitEngine.ts             # Exercise fit/tetris engine with scoring
├── library/
│   └── exercises.ts             # 30 built-in exercises with metadata
├── store/
│   └── projectStore.ts          # Zustand state management (project, blocks, room, playback)
├── storage/
│   └── StorageAdapter.ts        # LocalStorage adapter + Google Drive stub
├── room/
│   └── RoomCanvas.tsx           # Canvas room renderer with drag & drop, hit testing
├── components/
│   ├── ProjectSetup/
│   │   └── ProjectSetup.tsx     # Project configuration screen
│   ├── TimelineBuilder/
│   │   └── TimelineBuilder.tsx  # Agenda editor with block management
│   ├── RoomBuilder/
│   │   └── RoomBuilder.tsx      # Room layout editor (template picker + canvas)
│   ├── Simulation/
│   │   ├── Simulation.tsx       # Playback and animation screen
│   │   └── EnergyCurve.tsx      # SVG energy dynamics visualization
│   ├── Export/
│   │   └── ExportView.tsx       # Print-ready export views
│   └── shared/
│       ├── Header.tsx           # Navigation header with screen tabs
│       └── Button.tsx           # Reusable button component
├── App.tsx                      # Main app with screen routing
└── main.tsx                     # Entry point
```

## Time Engine

The time engine calculates realistic training block duration by combining four components:

```
estimated_total_minutes =
  base_minutes
  + experience_modifier(base_minutes)
  + overhead(participant_count, method, room_layout)
  + interaction_minutes(question_config)
```

### Experience Modifier

Applied to `base_minutes` only:

| Level | Modifier |
|-------|----------|
| Novice | +20% |
| Mixed | 0% |
| Advanced | -20% |

### Overhead

Logistic/transition time based on block method and room size:

| Method | Formula |
|--------|---------|
| Groups | `3 + 0.3 * participants` |
| Pairs | `2 + 0.15 * participants` |
| Workbook | `1 + 0.1 * participants` |
| Video + Debrief | 2 min fixed |
| Lecture | 1 min fixed |
| Energizer | 1 min fixed |
| Other | 0.5 min fixed |
| Lecture 20+ room | +1 min additional |

### Interaction Time

For blocks with question configuration (opening + questions):

```
questions_count * (prompt_seconds + answers_count * answer_seconds) / 60
```

Where `questions_count = max(auto_suggested_count, manual_questions_count)`.

## Fit Engine (Tetris)

After every change to blocks, participants, or room layout:

1. Recalculates estimated time for each block using `time_range_max` as base
2. Checks hard filters: participant range, tables, flipcharts, screen requirements
3. Checks time: `estimated_total <= window_minutes`
4. If exercise doesn't fit: suggests TOP 3 alternatives + 2 "rescue" short exercises
5. Scoring weights: time fit (40%), participant match (30%), asset match (20%), dynamics (10%)

Rescue picks prefer exercises whose `time_range_max < 70%` of the time window.

## Exercise Library

30 exercises across all block types:

| Block Type | Count | Examples |
|-----------|-------|---------|
| Opening + Questions | 3 | Expectations Round Robin, Two Truths and a Lie, Scale Question |
| Contract | 2 | Group Norms Co-Creation, Parking Lot + Logistics |
| Lecture | 4 | Situational Leadership, Feedback Models, Prompt Engineering, Active Listening |
| Pairs | 4 | Feedback Practice, Active Listening Drill, Elevator Pitch, Challenger Sale |
| Groups | 5 | Case Study Analysis, AI Use Case Mapping, Marshmallow Tower, Objection Handling, Design Thinking Sprint |
| Workbook | 3 | Leadership Self-Assessment, Personal Action Plan, Communication Style Quiz |
| Energizer | 3 | Human Bingo, Stand Up If..., One Word Story |
| Video + Debrief | 3 | TED Talk Debrief, Customer Service Scenario, AI Tool Live Demo |
| Recap Module | 2 | 3 Key Takeaways, Quick Quiz Battle |
| Recap Day | 2 | One Word Checkout, Letter to Future Self |

### Exercise Format

Each exercise includes:

```typescript
{
  id: string,
  title: string,
  type: BlockType,
  description: string,
  time_range_min: number,
  time_range_max: number,
  participant_range_min: number,
  participant_range_max: number,
  requires_tables: boolean,
  requires_flipchart_count: number,
  requires_screen: boolean,
  dynamics: 'low' | 'medium' | 'high',
  facilitator_steps: string[],
  workbook_link: string,
  tags: string[]
}
```

### Adding New Exercises

Add entries to `src/library/exercises.ts` in the `EXERCISE_LIBRARY` array. Follow the same format. The exercise will automatically appear in Fit Engine recommendations for matching block types.

## Question Rule

For "Opening + Questions" blocks:

- User adds 1+ questions manually
- System suggests additional questions: `ceil(participants / X) * Y`
  - `X` = `persons_per_question` (default 5)
  - `Y` = `questions_per_group` (default 2)
- Both X and Y are user-configurable
- Interaction time is auto-calculated and added to the block estimate

## Room Templates

Three built-in room templates that auto-generate furniture layout based on participant count:

| Template | Description | Tables | Best for |
|----------|------------|--------|----------|
| `horseshoe_tables` | U-shape with tables and chairs | Yes | Workshops, group work |
| `horseshoe_no_tables` | U-shape with chairs only (tighter) | No | Discussion, coaching |
| `lecture_20plus` | Rows with center aisle | No | Large lectures, presentations |

All templates include screen, facilitator spot, and flipcharts. Room objects are draggable in the Room Builder.

## Storage

- **LocalStorage** (MVP): Projects saved in browser localStorage with `tfs_project_` prefix
- **Google Drive** (stub): Interface ready for v2 implementation
- **JSON export/import**: Full project portable via JSON files with validation

## Data Model

```
TrainingProject
  ├── id, schema_version, title, industry
  ├── participant_count, experience_level
  ├── total_minutes, start_time
  ├── business_goals[], training_goals[]
  ├── AgendaBlock[] (ordered, with time windows)
  │   ├── type, title, window_minutes, order
  │   ├── exercise_id?, question_config?
  │   ├── required_assets, materials, facilitator_notes
  │   └── estimated_minutes?, fits_in_window? (computed)
  └── RoomLayout
      ├── template, width, height
      ├── flipchart_count, has_screen, has_tables
      └── RoomObject[] (table, chair, flipchart, screen, projector, facilitator_spot, zone)
```

Schema versioned (`schema_version: "1.0.0"`) for future migrations.

## Block Types

11 block types with color-coded metadata:

| Type | Label | Default Minutes |
|------|-------|----------------|
| `opening_questions` | Opening + Questions | 20 |
| `contract` | Contract | 10 |
| `lecture` | Lecture | 30 |
| `pairs` | Pairs Work | 20 |
| `groups` | Group Work | 30 |
| `workbook` | Workbook | 15 |
| `energizer` | Energizer / Standup | 10 |
| `video_debrief` | Video + Debrief | 25 |
| `recap_module` | Module Recap | 10 |
| `recap_day` | Day Recap | 15 |
| `break` | Break | 15 |

## Energy Curve

Visualizes energy dynamics across the training day using an SVG bar:

- Each block type has an energy level: high (energizers), medium (groups, pairs, video), low (lectures, workbook, recaps)
- Color-coded segments show the energy flow at a glance
- Red position indicator tracks current playback position
- Warns about: 3+ low-energy blocks in a row, low energy immediately after lunch

## Application Screens

The app has four main screens accessible via the header navigation:

1. **Setup** -- Configure project parameters, load demo, manage saved projects
2. **Timeline** -- Build and reorder agenda blocks, assign exercises, view time estimates
3. **Room** -- Select template, drag objects, customize room layout
4. **Simulation** -- Play/pause animated walkthrough, view energy curve

Plus an **Export** overlay for print-ready views.

## License

MIT
