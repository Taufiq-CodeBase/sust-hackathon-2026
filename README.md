# QueueStorm Copilot

An AI-powered complaint investigation API for fintech support teams. Built for the QueueStorm hackathon.

## What It Does

Accepts customer support tickets with transaction history, investigates whether the complaint is supported by transaction data, and returns structured routing and response guidance — safely.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20 (LTS) |
| Framework | Express.js 4.x |
| AI Engine | OpenAI GPT-4o-mini |
| Validation | Zod |
| Security | Helmet, CORS, express-rate-limit |
| Logging | Winston + Morgan |
| Testing | Jest + Supertest |
| Container | Docker + Docker Compose |

## MODELS Section

| Model | Provider | Where It Runs | Why Chosen |
|-------|----------|--------------|------------|
| `gpt-oss-120b-free` | OpenRouter | OpenRouter Cloud API | Free tier access via OpenRouter. 120B parameter open-source model. OpenAI SDK compatible — same interface, zero cost. Handles multilingual input (English, Bangla, Banglish). |

**Cost:** Free tier on OpenRouter (rate limited)
**Base URL:** `https://openrouter.ai/api/v1`
**SDK:** `openai` npm package with custom `baseURL`


## Quick Start

### Prerequisites
- Node.js 18+ 
- OpenRouter API key

### Local Setup

```bash
# Clone
git clone https://github.com/your-username/queuestorm-copilot
cd queuestorm-copilot

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start development server
npm run dev

# Run tests
npm test
```



## API Endpoints

### `GET /health`
Returns `{"status":"ok"}` — used by judge harness for readiness check.

### `POST /analyze-ticket`
Accepts a ticket with complaint and transaction history. Returns investigation result.

**Request:**
```json
{
  "ticket_id": "TKT-001",
  "complaint": "I sent 5000 taka to wrong number",
  "language": "en",
  "channel": "in_app_chat",
  "user_type": "customer",
  "transaction_history": [
    {
      "transaction_id": "TXN-9101",
      "timestamp": "2026-04-14T14:08:22Z",
      "type": "transfer",
      "amount": 5000,
      "counterparty": "+8801719876543",
      "status": "completed"
    }
  ]
}
```

**Response:**
```json
{
  "ticket_id": "TKT-001",
  "relevant_transaction_id": "TXN-9101",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports sending 5000 BDT to wrong number. TXN-9101 confirms a completed 5000 BDT transfer at 14:08 UTC, consistent with the complaint.",
  "recommended_next_action": "Verify TXN-9101 in the payment system and initiate dispute investigation workflow per standard policy.",
  "customer_reply": "We have noted your concern regarding transaction TXN-9101. Our team is investigating this matter and will update you within 24-48 hours through official channels. Any eligible amount will be processed through official channels as per our policy.",
  "human_review_required": true,
  "confidence": 0.92,
  "reason_codes": ["wrong_transfer", "transaction_match", "high_value"]
}
```

## AI Approach

1. **System Prompt Engineering**: A carefully engineered system prompt instructs the LLM to act as a financial investigator, not a classifier. It embeds all safety rules, enum constraints, and evidence reasoning logic.

2. **Evidence Reasoning**: The LLM cross-references complaint text against transaction history to produce `evidence_verdict` (`consistent`, `inconsistent`, `insufficient_data`) and `relevant_transaction_id`.

3. **Temperature 0.1**: Low temperature ensures consistent, factual output rather than creative generation.

4. **JSON Mode**: `response_format: { type: "json_object" }` forces valid JSON output.

5. **Post-processing Safety Net**: Even if the LLM produces a slightly off enum, our normalization layer corrects it.

## Safety Logic

Three layers of safety protection:

### Layer 1: Input Sanitization
- Detects prompt injection patterns in complaint text
- Sanitizes strings to prevent token exhaustion
- Limits input length

### Layer 2: LLM Prompt Rules
- System prompt explicitly prohibits PIN/OTP/password requests
- System prompt prohibits unauthorized refund confirmations  
- System prompt instructs the LLM to ignore embedded instructions

### Layer 3: Post-LLM Safety Checks (safety.service.js)
- Regex patterns scan `customer_reply` and `recommended_next_action`
- Any violation triggers automatic sanitization and `human_review_required: true`
- Violations are logged for monitoring

### Deterministic Business Rules (investigation.service.js)
- `wrong_transfer` → always `dispute_resolution` + `human_review_required: true`
- `phishing_or_social_engineering` → always `fraud_risk` + `human_review_required: true`
- Amount > 50,000 BDT → always `human_review_required: true`
- `evidence_verdict: inconsistent` → always `human_review_required: true`

## Assumptions

- The service is stateless (no persistence between requests)
- Complaint language detection is provided by the `language` field; the LLM handles multilingual input natively
- Transaction history reflects recent activity (2-5 entries)
- All monetary amounts are in BDT

## Known Limitations

- LLM response times can vary; under heavy load may approach the 30s timeout
- Banglish (mixed Bengali-English) reasoning depends on GPT-4o-mini's multilingual capability
- No persistent audit trail of violations (would need database for production)
- Rate limiting is per-instance; would need Redis for multi-instance deployments