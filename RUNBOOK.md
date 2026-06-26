# RUNBOOK — QueueStorm Copilot

Complete deployment and operation guide. A complete stranger should be able to bring up the service from this document alone.

## Prerequisites

| Tool | Version | Check Command |
|------|---------|--------------|
| Node.js | 18.x or 20.x | `node --version` |
| npm | 8.x+ | `npm --version` |
| Docker | 20.x+ | `docker --version` |
| Docker Compose | 2.x+ | `docker compose version` |

## Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env`:

```env
OPENAI_API_KEY=sk-...          # Required. Your OpenAI API key.
OPENAI_MODEL=gpt-4o-mini       # Optional. Default: gpt-4o-mini
PORT=3000                       # Optional. Default: 3000
NODE_ENV=production             # Optional. Default: development
RATE_LIMIT_WINDOW_MS=900000    # Optional. Rate limit window (15 min)
RATE_LIMIT_MAX=100             # Optional. Max requests per window
ALLOWED_ORIGINS=*              # Optional. Comma-separated allowed origins
```

## Option A: Run with Node.js directly

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Fill in OPENAI_API_KEY in .env

# 3. Start server
npm start

# 4. Verify health
curl http://localhost:3000/health
# Expected: {"status":"ok"}

# 5. Test analyze-ticket
curl -X POST http://localhost:3000/analyze-ticket \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TKT-TEST-001",
    "complaint": "I sent 5000 taka to a wrong number around 2pm today",
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
  }'
```

## Option B: Run with Docker Compose (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/your-username/queuestorm-copilot
cd queuestorm-copilot

# 2. Set up environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 3. Build and start
docker compose up --build -d

# 4. Check logs
docker compose logs -f copilot

# 5. Verify health (wait ~10 seconds for startup)
curl http://localhost:3000/health

# 6. Stop
docker compose down
```

## Option C: Run Docker Image Directly

```bash
docker pull your-username/queuestorm-copilot:latest

docker run -d \
  --name queuestorm-copilot \
  -p 3000:3000 \
  -e OPENAI_API_KEY=your_key_here \
  -e NODE_ENV=production \
  your-username/queuestorm-copilot:latest

curl http://localhost:3000/health
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx jest tests/safety.test.js
```

Expected output:
```
PASS tests/health.test.js
PASS tests/safety.test.js
PASS tests/ticket.test.js

Test Suites: 3 passed, 3 total
Tests:       15+ passed
```

## Troubleshooting

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| `Missing required environment variables: OPENAI_API_KEY` | .env not set | Copy .env.example and fill in values |
| Port 3000 already in use | Another process | Change PORT in .env or kill the process |
| `AI service temporarily unavailable` | Invalid/expired OpenAI key | Check OPENAI_API_KEY value |
| Response takes >20s | High OpenAI load | Retry; consider switching to gpt-4o-mini if using gpt-4o |
| Docker build fails | Node version | Ensure Dockerfile uses node:20-alpine |

## Verifying Correct Output

A correct response to the sample ticket above should have:
- `ticket_id`: `"TKT-TEST-001"`
- `relevant_transaction_id`: `"TXN-9101"`
- `evidence_verdict`: `"consistent"`
- `case_type`: `"wrong_transfer"`
- `department`: `"dispute_resolution"`
- `human_review_required`: `true`
- `customer_reply`: Must NOT contain PIN, OTP, password, "we will refund"