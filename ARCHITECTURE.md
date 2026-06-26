# Architecture — QueueStorm Copilot

## System Overview

Client / Judge Harness
│
▼ HTTP (REST)
┌─────────────────────────────────────────────┐
│ Express.js Server │
│ │
│ ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Helmet │ │ CORS │ │Rate Limit│ │
│ └─────────┘ └──────────┘ └──────────┘ │
│ │
│ GET /health ──────────────→ 200 {"status":"ok"}
│ │
│ POST /analyze-ticket │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────┐ │
│ │ ticket.controller.js │ │
│ │ 1. Sanitize (injection detection) │ │
│ │ 2. Validate (Zod schema) │ │
│ │ 3. Call investigation.service │ │
│ └──────────────┬──────────────────────┘ │
│ │ │
│ ┌───────▼──────────────────┐ │
│ │ investigation.service │ │
│ │ 1. Injection handling │ │
│ │ 2. Call LLM │ │
│ │ 3. Normalize output │ │
│ │ 4. Safety checks │ │
│ │ 5. Business rules │ │
│ │ 6. TX ID validation │ │
│ └──────┬────────┬──────────┘ │
│ │ │ │
│ ┌──────▼──┐ ┌───▼──────────┐ │
│ │llm.svc │ │ safety.svc │ │
│ │OpenAI │ │ Rule checks │ │
│ │API call │ │ Sanitization │ │
│ └──────┬──┘ └─────────────┘ │
│ │ │
└────────────────│────────────────────────────┘
│
▼ HTTPS
OpenAI API (gpt-4o-mini)

text


## Request Lifecycle
Request arrives at POST /analyze-ticket
│
Helmet middleware adds security headers
│
Rate limiter checks request count
│
JSON body is parsed (1MB limit)
│
sanitizeRequestBody() removes null bytes, limits length
│
detectPromptInjection() checks complaint text
│
validateTicketRequest() (Zod) validates all fields and enums
│
investigateTicket() is called
│
├─ handlePromptInjection() — tags suspicious input
│
├─ callLLM() — sends to OpenAI with system prompt
│ ├─ System prompt enforces safety rules
│ ├─ Temperature 0.1 for consistent output
│ ├─ JSON mode for reliable schema
│ └─ Returns raw JSON
│
├─ validateAndNormalizeLLMOutput() — corrects any enum drift
│
├─ applySafetyChecks() — regex scan of customer_reply + next_action
│ ├─ Checks for PIN/OTP/password requests
│ ├─ Checks for unauthorized refund confirmations
│ └─ Checks for third-party redirects
│
├─ enforceBusinessRules() — deterministic overrides
│ ├─ wrong_transfer → dispute_resolution
│ ├─ phishing → fraud_risk + human_review
│ ├─ >50K BDT → human_review
│ └─ inconsistent evidence → human_review
│
└─ Validate relevant_transaction_id against actual history
│
Return 200 with structured JSON response
text


## Safety Architecture (Three Layers)
Layer 1: Input Gate
├── String sanitization (null bytes, length limits)
├── Prompt injection detection (regex patterns)
└── Zod schema validation (type safety)

Layer 2: LLM Instructions
├── System prompt hard-coded safety rules
├── Cannot be overridden by user input
└── Low temperature for consistent rule-following

Layer 3: Post-LLM Verification
├── Regex scan of all output fields
├── Deterministic business rule enforcement
└── Transaction ID cross-validation

text


## Directory Structure
src/
├── config/ # Environment and client configuration
├── controllers/ # HTTP request handlers (thin layer)
├── services/ # Core business logic
│ ├── investigation.service.js # Orchestration
│ ├── llm.service.js # AI interaction
│ └── safety.service.js # Safety enforcement
├── validators/ # Input validation schemas (Zod)
├── middleware/ # Express middleware
├── prompts/ # LLM system prompts
├── utils/ # Shared utilities
└── app.js # Express app + server

text


## Key Design Decisions

| Decision | Alternative Considered | Reason Chosen |
|----------|----------------------|---------------|
| Node.js + Express | Python + FastAPI | Faster startup, lighter Docker image, no GPU needed |
| GPT-4o-mini | GPT-4o / local model | Cost-efficient, fast, reliable JSON mode, multilingual |
| Zod validation | Joi / manual checks | Type-safe, excellent error messages, TypeScript-ready |
| Stateless design | Database-backed | Simplicity, no persistence needed, easier scaling |
| 3-layer safety | LLM-only safety | Defense in depth; LLM can hallucinate, rules cannot |
| Deterministic overrides | LLM decides everything | Critical routing (fraud, disputes) must be reliable |