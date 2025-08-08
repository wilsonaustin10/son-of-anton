┌───────────────────────────────────────────────────────────────────────────┐
│                            Client / UX Layer                              │
│  Next.js UI + WebRTC: mic capture, barge-in, partial captions, TTS out   │
└───────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        Realtime Gateway (Edge)                            │
│  - OpenAI Realtime API session (low-latency STT/LLM/TTS)                  │
│  - Function/tool-call events, cancel/interrupt on barge-in                │
│  - Backpressure & timeouts (kill stale tool calls)                        │
└───────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        Agent Orchestration Layer                          │
│  Policy/Guardrails & Budgeting                                            │
│    • JSON Schema validation (args/results), max tool-calls/turn           │
│    • Per-tool rate limits, timeouts, and cost caps                        │
│  Planner                                                                  │
│    • Decides: direct answer vs RAG vs web search vs custom tool           │
│    • `tool_choice` control (auto/required/none)                           │
│  Session State                                                            │
│    • Turn history + short-term summary for Realtime/Responses             │
└───────────────────────────────────────────────────────────────────────────┘
                                   │
                   ┌───────────────┴────────────────┐
                   ▼                                ▼
┌───────────────────────────────────────┐  ┌────────────────────────────────┐
│          Tooling Subsystem            │  │          Memory/RAG            │
│ - OpenAI **hosted tools**:            │  │ Supabase Postgres + pgvector   │
│   web search, file search, etc.       │  │ - HNSW index for ANN           │
│ - **Function tools** (local code)     │  │ - Write policy (what to store) │
│ - **MCP** connector to remote tools   │  │ - Retrieval profiles (recency) │
│ - Provider fallbacks (Tavily/Serper)  │  │ - 150–250 ms latency guard     │
└───────────────────────────────────────┘  └────────────────────────────────┘
                   │                                │
                   └───────────────┬────────────────┘
                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                            LLM Providers                                  │
│  OpenAI Responses API (tools + web search) & Realtime API                 │
│  (Model swap possible per intent)                                         │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                Observability, QA & Safety (sidecar services)              │
│  Tracing (per step/tool), p95 latency, cost/turn, evals on golden sets    │
└───────────────────────────────────────────────────────────────────────────┘
