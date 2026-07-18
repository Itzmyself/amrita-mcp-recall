# 🧠 Recall — Memory Agent for Students

> **Amrita University MCP Hackathon 2026**
> 
> **Track**: Education & Research
> 
> **Team Members**: [Insert Names & Roll Numbers]
> 
> **Deployed URL**: [Insert Nitrostack URL]
> 
> **Demo Video**: [Insert Video Link]

## Problem & Solution
Recall is an MCP (Model Context Protocol) server that acts as a persistent memory agent for students. It captures narrated observations during labs, lectures, or fieldwork, stores them as structured, searchable memory, and lets the student — or an AI study assistant — recall them later across sessions.

**Example**: A chemistry student narrates _"this is the titration setup for experiment 3, the flask needs to sit for 10 minutes"_ during a lab. Later, they (or their AI assistant) can recall that observation, get a study summary, or generate a lab report draft — all from the MCP server.

---

## 🏗 Architecture

Built with the [NitroStack](https://nitrostack.ai) MCP framework using a NestJS-style modular architecture:

```
recall/
├── src/
│   ├── index.ts                          # Bootstrap entry point
│   ├── app.module.ts                     # Root @McpApp module
│   └── modules/
│       ├── storage/
│       │   ├── storage.module.ts          # Global storage module
│       │   └── database.service.ts        # SQLite wrapper (sql.js)
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
├── .env / .env.example
└── README.md
```

---

## 🔌 MCP Primitives

### Tools (5)

| Tool | Description |
|------|-------------|
| `capture_observation` | Store a new observation with label, note, context, and session ID |
| `recall` | Search observations by keyword, optionally scoped to a session |
| `update_observation` | Edit an existing observation's note |
| `delete_observation` | Soft-delete an observation |
| `list_sessions` | List all sessions with counts and date ranges |

### Resources (1)

| URI | Description |
|-----|-------------|
| `recall://sessions/{session_id}/graph` | Read-only structured dump of all observations in a session with inferred relations |

### Prompts (2)

| Prompt | Description |
|--------|-------------|
| `study_summary` | Generates a concise study summary from session observations |
| `lab_report_draft` | Turns session observations into a structured lab report skeleton |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20.18.1 (use [nvm](https://github.com/nvm-sh/nvm) to manage versions)
- **npm** ≥ 9
- **tsx** installed globally: `npm i tsx -g`

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npx @nitrostack/cli dev
```

The server starts in stdio mode, ready for any MCP client (NitroStudio, Claude Desktop, etc.) to connect.

### Environment Variables

Copy `.env.example` to `.env` and adjust if needed:

```env
DB_PATH=./data/recall.db
```

The SQLite database and `data/` directory are created automatically on first run.

---

## 📋 Example Usage Flow

### 1. Capture observations during a lab

```
→ capture_observation({
    label: "titration setup",
    note: "Flask with 25ml NaOH, add phenolphthalein indicator, 3 drops",
    context: "experiment-3",
    session_id: "chem-lab-2026-07-18"
  })
← { id: "abc-123", timestamp: "2026-07-18T10:30:00Z" }

→ capture_observation({
    label: "titration endpoint",
    note: "Color changed from pink to colorless at 22.4ml HCl",
    context: "experiment-3",
    session_id: "chem-lab-2026-07-18"
  })
← { id: "def-456", timestamp: "2026-07-18T10:45:00Z" }
```

### 2. Recall observations later

```
→ recall({ query: "titration", session_id: "chem-lab-2026-07-18" })
← { count: 2, results: [ ... ] }
```

### 3. Browse session graph

```
→ read resource: recall://sessions/chem-lab-2026-07-18/graph
← { observations: [...], relations: [...], metadata: { ... } }
```

### 4. Generate a study summary

```
→ use prompt: study_summary({ session_id: "chem-lab-2026-07-18", topic: "titration" })
← [Formatted prompt with observations embedded, asking AI to produce a study summary]
```

### 5. Draft a lab report

```
→ use prompt: lab_report_draft({ session_id: "chem-lab-2026-07-18" })
← [Formatted prompt asking AI to produce Objective → Method → Observations → Conclusion]
```

---

## 🏆 Hackathon Rubric Alignment

| Criterion | How Recall Addresses It |
|-----------|------------------------|
| **MCP Primitives** | All 3 implemented: Tools (5), Resources (1), Prompts (2) |
| **Education & Research** | Memory agent designed for students in labs, lectures, fieldwork |
| **Code Quality** | TypeScript strict mode, NitroStack decorators, DI, modular architecture |
| **Architecture** | Clean separation: storage → service → tools/resources/prompts |
| **Runnable Locally** | `npm install && npx @nitrostack/cli dev` — zero external dependencies |
| **Storage** | SQLite via sql.js (WASM-based, auto-schema, swappable) |

---

## 🔮 Future Enhancements (if time allows)

- Semantic similarity search (embeddings + vector store)
- Camera/mic streaming for real-time observation capture
- Canvas UI for visual browsing of observation graphs
- Notion/Slack/Gmail integrations for exporting summaries
- Graph DB backend (Neo4j/SurrealDB) for richer relation queries

---

## 📄 License

MIT
