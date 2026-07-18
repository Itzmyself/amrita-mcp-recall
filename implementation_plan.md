# Recall — MCP Memory Agent for Students

Build an MCP server called "Recall" using the NitroStack SDK that captures, stores, and retrieves student observations across lab sessions, lectures, and fieldwork.

## Proposed Changes

The project will be scaffolded at `c:\S5\nithya and associates\recall\` as a clean NitroStack TypeScript project implementing all 3 MCP primitives (Tools, Resources, Prompts) backed by SQLite.

---

### Project Scaffolding & Configuration

#### [NEW] [package.json](file:///c:/S5/nithya%20and%20associates/recall/package.json)
- NitroStack dependencies: `@nitrostack/core`, `better-sqlite3`, `uuid`
- Dev dependencies: `typescript`, `tsx`, `@types/better-sqlite3`, `@types/uuid`
- Scripts: `dev` (via `npx @nitrostack/cli dev`), `build`, `start`

#### [NEW] [tsconfig.json](file:///c:/S5/nithya%20and%20associates/recall/tsconfig.json)
- Strict mode, ES2022 target, decorators enabled (`experimentalDecorators`, `emitDecoratorMetadata`)
- Module: `NodeNext`, outDir: `dist`

#### [NEW] [.env.example](file:///c:/S5/nithya%20and%20associates/recall/.env.example)
- `DB_PATH=./data/recall.db` — SQLite database location

#### [NEW] [.env](file:///c:/S5/nithya%20and%20associates/recall/.env)
- Actual dev values mirroring `.env.example`

---

### Entry Point & Module Architecture

#### [NEW] [src/index.ts](file:///c:/S5/nithya%20and%20associates/recall/src/index.ts)
- Bootstrap the app via `McpApplicationFactory.create(AppModule)` → `server.start()`

#### [NEW] [src/app.module.ts](file:///c:/S5/nithya%20and%20associates/recall/src/app.module.ts)
- Root `@McpApp` + `@Module` with server name `recall-mcp`, version `1.0.0`
- Imports: `ConfigModule.forRoot()`, `StorageModule`, `RecallModule`

#### [NEW] [src/modules/recall/recall.module.ts](file:///c:/S5/nithya%20and%20associates/recall/src/modules/recall/recall.module.ts)
- `@Module` registering controllers: `RecallTools`, `RecallResources`, `RecallPrompts`
- Providers: `ObservationService`
- Imports: `StorageModule`

---

### Storage Layer (SQLite)

#### [NEW] [src/modules/storage/storage.module.ts](file:///c:/S5/nithya%20and%20associates/recall/src/modules/storage/storage.module.ts)
- `@Module` with `providers: [DatabaseService]`, `exports: [DatabaseService]`
- Global module so all features can use it

#### [NEW] [src/modules/storage/database.service.ts](file:///c:/S5/nithya%20and%20associates/recall/src/modules/storage/database.service.ts)
- `@Injectable()` service wrapping `better-sqlite3`
- Auto-creates `data/` directory and initializes the `observations` table on construction:
  ```sql
  CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    label TEXT NOT NULL,
    note TEXT NOT NULL,
    context TEXT DEFAULT '',
    timestamp TEXT NOT NULL,
    deleted INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_session ON observations(session_id);
  CREATE INDEX IF NOT EXISTS idx_label ON observations(label);
  ```
- Exposes typed query helpers: `run()`, `get()`, `all()`
- Designed to be swapped for a graph DB later (interface-based)

---

### Tools (5 tools)

#### [NEW] [src/modules/recall/recall.tools.ts](file:///c:/S5/nithya%20and%20associates/recall/src/modules/recall/recall.tools.ts)

Uses `ToolDecorator as Tool` and `z` from `@nitrostack/core`. Each tool uses Zod `inputSchema` for validation.

1. **`capture_observation`** — Stores a new observation with auto-generated UUID + ISO timestamp. Returns `{ id, timestamp }`.
   - `inputSchema`: `{ label: z.string(), note: z.string(), context: z.string().optional(), session_id: z.string() }`
   - Annotations: `{ destructiveHint: false, readOnlyHint: false, openWorldHint: false }`

2. **`recall`** — Keyword search via SQL `LIKE` on label, note, and context. Optional session_id filter. Returns matching records sorted by timestamp desc.
   - `inputSchema`: `{ query: z.string(), session_id: z.string().optional() }`
   - Annotations: `{ readOnlyHint: true, idempotentHint: true }`

3. **`update_observation`** — Updates an existing observation's note by ID. Returns the updated record.
   - `inputSchema`: `{ id: z.string(), new_note: z.string() }`
   - Annotations: `{ destructiveHint: false, idempotentHint: true }`

4. **`delete_observation`** — Soft-deletes by setting `deleted = 1`. Returns `{ success: true, id }`.
   - `inputSchema`: `{ id: z.string() }`
   - Annotations: `{ destructiveHint: true, idempotentHint: true }`

5. **`list_sessions`** — Aggregates sessions with observation counts, first/last timestamps. Returns array of session summaries.
   - No input required.
   - Annotations: `{ readOnlyHint: true, idempotentHint: true }`

---

### Observation Service

#### [NEW] [src/modules/recall/observation.service.ts](file:///c:/S5/nithya%20and%20associates/recall/src/modules/recall/observation.service.ts)

`@Injectable()` service encapsulating all DB queries for observations. Injected into tools, resources, and prompts via NitroStack DI.

Methods:
- `create(label, note, context, sessionId) → Observation`
- `search(query, sessionId?) → Observation[]`
- `getById(id) → Observation | null`
- `update(id, newNote) → Observation`
- `softDelete(id) → boolean`
- `listSessions() → SessionSummary[]`
- `getSessionObservations(sessionId) → Observation[]`
- `getSessionGraph(sessionId) → SessionGraph` — builds a graph with nodes (observations) and edges (inferred relations by label/context)

---

### Resources (1 resource template)

#### [NEW] [src/modules/recall/recall.resources.ts](file:///c:/S5/nithya%20and%20associates/recall/src/modules/recall/recall.resources.ts)

Uses `ResourceDecorator as Resource` from `@nitrostack/core`.

**`recall://sessions/{session_id}/graph`** — Read-only structured dump of all observations in a session.
- Returns JSON with `{ session_id, observations: [...], relations: [...], metadata: { count, dateRange } }`
- Relations are inferred: observations sharing the same `label` or `context` get an edge between them
- `mimeType: 'application/json'`
- `annotations: { audience: ['user', 'assistant'], priority: 0.8 }`

---

### Prompts (2 prompt templates)

#### [NEW] [src/modules/recall/recall.prompts.ts](file:///c:/S5/nithya%20and%20associates/recall/src/modules/recall/recall.prompts.ts)

Uses `PromptDecorator as Prompt` from `@nitrostack/core`.

1. **`study_summary`** — Takes `session_id` (required) and `topic` (optional). Fetches matching observations, then returns a multi-turn prompt that:
   - Provides all observations as context in the system/user message
   - Asks the model to produce a concise study summary organized by topic
   - `arguments: [{ name: 'session_id', required: true }, { name: 'topic', required: false }]`

2. **`lab_report_draft`** — Takes `session_id` (required). Fetches all session observations, then returns a prompt that:
   - Provides observations chronologically
   - Asks the model to produce a lab report skeleton: Objective → Method → Observations → Conclusion placeholders
   - `arguments: [{ name: 'session_id', required: true }]`

---

### Types

#### [NEW] [src/modules/recall/types.ts](file:///c:/S5/nithya%20and%20associates/recall/src/modules/recall/types.ts)

TypeScript interfaces:
- `Observation { id, session_id, label, note, context, timestamp, deleted }`
- `SessionSummary { session_id, observation_count, first_observation, last_observation }`
- `SessionGraph { session_id, observations, relations, metadata }`
- `Relation { source_id, target_id, type: 'same_label' | 'same_context', value }`

---

### Documentation

#### [NEW] [README.md](file:///c:/S5/nithya%20and%20associates/recall/README.md)
- **What Recall is**: Memory agent for students, captures narrated observations
- **Hackathon track**: Education & Research
- **Rubric alignment**: All 3 MCP primitives, clean architecture, SQLite storage
- **How to run locally**: `npm install` → `npx @nitrostack/cli dev`
- **MCP primitives list**: Tools (5), Resources (1), Prompts (2)
- **Project structure diagram**
- **Example usage flows**

---

## Final Project Structure

```
recall/
├── src/
│   ├── index.ts                          # Bootstrap entry point
│   ├── app.module.ts                     # Root @McpApp module
│   └── modules/
│       ├── storage/
│       │   ├── storage.module.ts          # Storage module
│       │   └── database.service.ts        # SQLite wrapper service
│       └── recall/
│           ├── recall.module.ts           # Feature module
│           ├── recall.tools.ts            # 5 MCP tools
│           ├── recall.resources.ts        # Session graph resource
│           ├── recall.prompts.ts          # 2 prompt templates
│           ├── observation.service.ts     # Business logic service
│           └── types.ts                   # TypeScript interfaces
├── data/                                  # SQLite DB (auto-created)
├── package.json
├── tsconfig.json
├── .env
├── .env.example
└── README.md
```

## Verification Plan

### Automated Tests
1. `npx @nitrostack/cli dev` — confirm server starts without errors
2. Via NitroStudio or MCP client calls:
   - Call `capture_observation` with sample lab data → verify returned ID
   - Call `capture_observation` again with same session → verify second record
   - Call `recall` with keyword → verify matching results
   - Call `update_observation` → verify note is updated
   - Call `delete_observation` → verify soft delete
   - Call `list_sessions` → verify session summary
   - Read `recall://sessions/{id}/graph` → verify structured graph output
   - Invoke `study_summary` prompt → verify formatted prompt messages
   - Invoke `lab_report_draft` prompt → verify lab report structure

### Manual Verification
- Confirm `data/recall.db` is created with correct schema
- Confirm tool annotations show correctly in NitroStudio
- Confirm keyword search returns relevant results across label, note, and context fields
