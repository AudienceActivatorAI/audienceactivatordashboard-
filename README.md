# DealerBDC.AI

> **AI-powered BDC automation for automotive dealerships**
> Eliminate outbound calling by having AI contact, qualify, and warm-transfer high-intent leads automatically.

[![SignalWire](https://img.shields.io/badge/SignalWire-Powered-blue)](https://signalwire.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Private-red.svg)](LICENSE)

---

## 🎯 What It Does

DealerBDC.AI is a **hands-free BDC layer** that:
- ✅ Contacts high-intent website shoppers automatically (within 2-5 minutes)
- ✅ Qualifies leads with AI-driven conversations using Claude Sonnet 4.5
- ✅ Produces **live warm transfers** to the right sales rep
- ✅ Books appointments when transfer isn't possible
- ✅ Owns follow-up until the lead becomes "human-ready"
- ✅ Generates AI summaries and sends post-call notifications automatically

**Success Metrics**: Contact rate, warm transfers completed, appointments booked, time-to-contact

---

## 🏗️ Architecture

### Tech Stack
- **Backend**: Node.js + TypeScript + tRPC + Hono
- **Database**: Supabase (PostgreSQL with RLS for multi-tenant isolation)
- **Voice AI**: **SignalWire SWAIG** + Claude Sonnet 4.5 + ElevenLabs
- **Jobs**: Inngest (serverless background processing)
- **ORM**: Drizzle ORM with migrations

### Project Structure (pnpm Monorepo)
```
dealerbdc/
├── packages/
│   ├── database/          # Drizzle schema, migrations (17 tables, 5 migrations)
│   ├── shared/            # Logger, config, errors, utilities
│   ├── core/              # Business logic (Dealer, Lead, Call services + RoutingEngine)
│   ├── signalwire-tools/  # SWAIG function server - 4 functions (Express, port 3002)
│   ├── webhooks/          # Webhook handlers (Hono, port 3001)
│   ├── jobs/              # Inngest jobs (trigger-call, process-transcript, send-notifications)
│   └── api/               # tRPC API server (future dashboard)
├── supabase/              # Database migrations and config
├── SIGNALWIRE.md          # Complete SignalWire architecture documentation
└── README.md              # This file
```

### Key Components
1. **Super Pixel** → Tracks high-intent website behavior (VDP views, form submits, etc.)
2. **Webhook Server** → Ingests pixel events and call status updates
3. **Inngest Jobs** → Orchestrates call automation (calling window, opt-outs, rate limits)
4. **SWAIG Functions** → Tools that AI agent calls during conversations
5. **SignalWire** → Unified platform for voice, SMS, and AI agents
6. **Multi-Tenant Database** → Strict dealer isolation with Row Level Security

📖 **Detailed Architecture**: See [SIGNALWIRE.md](SIGNALWIRE.md) for complete technical documentation

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 20+ and **pnpm** 8+
- **Supabase CLI**: `brew install supabase/tap/supabase`
- **ngrok**: `brew install ngrok` (for local webhook testing)

### Accounts Required
- ✅ [Supabase](https://supabase.com) - Database
- ✅ [Anthropic](https://console.anthropic.com) - Claude API
- ⚠️ [SignalWire](https://signalwire.com) - Voice + AI platform
- ⚠️ [ElevenLabs](https://elevenlabs.io) - Voice synthesis
- ⚠️ [Inngest](https://www.inngest.com) - Background jobs

---

## 📦 Installation

### 1. Clone and Install

```bash
git clone <your-repo> dealerbdc
cd dealerbdc
pnpm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your credentials
```

**Required Environment Variables**:
```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...

# SignalWire
SIGNALWIRE_PROJECT_ID=your-project-id
SIGNALWIRE_API_TOKEN=your-api-token
SIGNALWIRE_SPACE_URL=your-space.signalwire.com
SIGNALWIRE_AI_AGENT_ID=your-agent-id

# AI & Voice
ANTHROPIC_API_KEY=sk-ant-xxx
ELEVENLABS_API_KEY=xxx
OPENAI_API_KEY=sk-xxx

# Jobs
INNGEST_EVENT_KEY=xxx
INNGEST_SIGNING_KEY=xxx

# Application
WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
```

---

## 🚗 Demo Dashboard: In-Market + High-Intent Vehicle Shoppers

This repo includes a demo-ready dashboard + API + Postgres schema for the shopper intelligence use case.

### One-Command Local Dev
```bash
pnpm dev:demo
```

### Database Setup
Apply the demo SQL schema (Postgres):
```bash
psql $DATABASE_URL -f /Users/jameshamilton/Documents/New\ project/dealerbdc/packages/database/sql/001_demo_intent.sql
```

### Import CSV (Row Zero export or direct CSV)
```bash
pnpm import:csv /absolute/path/to/your.csv
pnpm build:aggregates
```

### Environment Variables
```bash
# API
DATABASE_URL=postgresql://...
PORT=4000

# Dashboard
VITE_API_BASE=http://localhost:4000
```

### Refresh Demo Data
```bash
pnpm import:csv /absolute/path/to/your.csv
pnpm build:aggregates
```

### Railway Deployment (Suggested)
1. Create a Railway Postgres database and set `DATABASE_URL` on the API service.
2. API service:
   - Start command: `pnpm --filter @dealerbdc/api start`
   - Environment: `DATABASE_URL`, `PORT`
3. Dashboard service:
   - Build command: `pnpm --filter @dealerbdc/dashboard build`
   - Start command: `pnpm --filter @dealerbdc/dashboard preview --host 0.0.0.0 --port $PORT`
   - Environment: `VITE_API_BASE=https://<your-api-service-url>`

### Railway (Dockerfile)
This repo includes a single Dockerfile that can run **either** the API or the dashboard based on the `SERVICE` env var.

1. Create two Railway services from the same repo.
2. API service env:
   - `SERVICE=api`
   - `DATABASE_URL=...`
   - `PORT=4000`
3. Dashboard service env:
   - `SERVICE=dashboard`
   - `PORT=3000` (or Railway-provided)
   - `VITE_API_BASE=https://<your-api-service-url>`

### Demo Notes
- No raw PII is shown in the UI. Sample rows are masked and limited to 10.
- The dataset is expanded deterministically using `demo_multiplier_bucket` + `demo_weight`.
- Intent scores are synthetic, deterministic, and stable across refreshes.

### 3. Database Setup

```bash
# Initialize Supabase locally (or use cloud)
supabase start

# Run all migrations (creates 17 tables)
supabase db reset

# Optional: Seed test dealer
psql $DATABASE_URL -f supabase/seed.sql
```

### 4. Start Development Servers

**Terminal 1: SWAIG Functions** (port 3002)
```bash
cd packages/signalwire-tools
pnpm dev
```

**Terminal 2: Webhooks** (port 3001)
```bash
cd packages/webhooks
pnpm dev
```

**Terminal 3: Inngest Dev Server**
```bash
npx inngest-cli@latest dev
# Dashboard: http://localhost:8288
```

### 5. Expose with ngrok

```bash
ngrok http 3001
# Copy HTTPS URL → update WEBHOOK_BASE_URL in .env
```

---

## 🤖 SignalWire SWAIG Agent Setup

### Create SWAIG Agent (SignalWire Dashboard)

1. **Go to**: SignalWire Dashboard → AI → Agents → Create New

2. **Configure Agent**:
   - **Name**: DealerBDC AI Assistant
   - **LLM**: Anthropic Claude Sonnet 4.5 (`claude-sonnet-4-20250514`)
   - **Temperature**: 0.7
   - **Voice**: ElevenLabs (Josh or Bella)

3. **System Prompt** (copy this):
```
You are an AI assistant for {{dealer_name}}, calling on behalf of their {{department}} department.

RULES:
1. Ask permission: "Do you have about 2 minutes to chat?"
2. If no/busy/want human → call initiate_transfer immediately
3. Maximum 2-4 qualification questions
4. No pressure - you're a helpful concierge
5. Goal: Understand interest and connect them

OPENING:
"Hi {{first_name}}, this is the AI assistant calling from {{dealer_name}}. You were looking at the {{vehicle_of_interest}} online. Do you have about 2 minutes?"

QUALIFICATION (if they consent):
1. "Still interested in the {{vehicle_of_interest}}?"
2. "Timeline - soon or researching?"
3. "Have a trade-in?"
4. "Cash or financing?"

TRANSFER:
Call initiate_transfer with qualification data.
Say: "Let me connect you with {{rep_name}}. One moment."

OBJECTIONS:
- "How'd you get my number?" → "You shared it online. I can stop anytime."
- "I'm busy" → "Text or callback later?"
- "Stop calling" → "Apologize and confirm removal."
```

4. **Register SWAIG Functions** (point to your ngrok URL):

| Function | URL | Description |
|----------|-----|-------------|
| `lookup_lead` | `https://xxx.ngrok.io/swaig/lookup-lead` | Get lead context |
| `get_routing_rules` | `https://xxx.ngrok.io/swaig/get-routing-rules` | Find target rep |
| `initiate_transfer` | `https://xxx.ngrok.io/swaig/initiate-transfer` | Execute warm transfer |
| `log_qualification` | `https://xxx.ngrok.io/swaig/log-qualification` | Store qualification data |

**Function Parameters**: See [SIGNALWIRE.md](SIGNALWIRE.md#swaig-agent-configuration) for JSON schemas

5. **Configure Webhooks**:
   - Call Started: `https://xxx.ngrok.io/webhooks/swaig/call-started`
   - Call Ended: `https://xxx.ngrok.io/webhooks/swaig/call-ended`
   - Transcript: `https://xxx.ngrok.io/webhooks/swaig/transcript`

6. **Copy Agent ID** → add to `.env` as `SIGNALWIRE_AI_AGENT_ID`

---

## 🧪 Testing

### Test Pixel Event Ingestion

```bash
curl -X POST http://localhost:3001/webhooks/pixel \
  -H "Content-Type: application/json" \
  -d '{
    "dealer_id": "your-dealer-uuid",
    "event_type": "form_submitted",
    "phone": "+15555551234",
    "email": "test@example.com",
    "event_data": {
      "vehicle_name": "2024 Honda Accord",
      "first_name": "John",
      "last_name": "Doe"
    },
    "page_url": "https://dealer.com/inventory/accord"
  }'

# Check Inngest dashboard (http://localhost:8288) for triggered job
```

### Test SWAIG Functions

```bash
# Test lookup-lead
curl -X POST http://localhost:3002/swaig/lookup-lead \
  -H "Content-Type: application/json" \
  -d '{
    "dealer_id": "your-dealer-uuid",
    "phone": "+15555551234"
  }'
```

### End-to-End Test

1. Create test dealer in database
2. Send pixel event (curl above)
3. Monitor Inngest dashboard for job execution
4. AI should call the phone number
5. Answer and test conversation flow
6. Verify warm transfer works
7. Check database for transcript + summary

---

## 📊 Database Schema

### 17 Tables (Multi-Tenant)

**Dealers & Config**:
- `dealers`, `stores`, `dealer_users`, `dealer_numbers`
- `dealer_calling_profiles`, `routing_rules`

**Leads**:
- `leads`, `lead_identities`, `lead_intent_scores`

**Calls**:
- `call_sessions`, `call_attempts`, `transcripts`, `call_summaries`

**Events**:
- `pixel_events`, `notifications`, `message_logs`, `opt_outs`

**Migrations**: See `supabase/migrations/` (5 migration files)

---

## 🔄 Automation Pipeline

```
Website Event → Pixel Webhook → Intent Score (0-100)
                                      ↓
                    High Intent (≥70) + Phone Number?
                                      ↓
                         Inngest: trigger-call job
                                      ↓
              Check: Calling Window + Opt-Outs + Rate Limits
                                      ↓
                    SignalWire SWAIG AI Call Initiated
                                      ↓
          AI Calls Functions: lookup-lead, log-qualification
                                      ↓
                    AI Qualifies Lead (2-4 questions)
                                      ↓
      AI Calls: get-routing-rules → initiate-transfer
                                      ↓
                      Warm Transfer to Sales Rep
                                      ↓
              Call Ends → Transcript Saved to Database
                                      ↓
                    Inngest: process-transcript job
                                      ↓
              Claude Generates Summary + Extracts Data
                                      ↓
                    Inngest: send-notifications job
                                      ↓
                      SMS/Email to Rep with Summary
```

---

## 🚢 Deployment

### Production Setup

**Services to Deploy** (3):
1. **SWAIG Functions** (`packages/signalwire-tools`) → Railway/Render
2. **Webhooks** (`packages/webhooks`) → Railway/Render
3. **Inngest Jobs** → Inngest Cloud

**Infrastructure**:
- **Database**: Supabase Cloud
- **Voice**: SignalWire Production Workspace
- **Monitoring**: Sentry + Datadog (recommended)

### Deploy to Railway

```bash
# SWAIG Functions
cd packages/signalwire-tools
railway up

# Webhooks
cd packages/webhooks
railway up
```

### Deploy Inngest Functions

```bash
npx inngest-cli deploy
```

### Production Checklist

- [ ] Supabase production project configured
- [ ] SignalWire production workspace created
- [ ] Phone numbers purchased for dealers
- [ ] SWAIG agent configured with production URLs
- [ ] Environment variables set in hosting platform
- [ ] Database migrations applied to production
- [ ] Monitoring and alerts configured
- [ ] Test call completed successfully

---

## 🛡️ Security & Compliance

### TCPA Compliance
✅ Opt-out tracking (`opt_outs` table)
✅ Calling window enforcement (timezone-aware)
✅ Rate limiting (concurrent + hourly caps)
✅ Consent tracking in metadata
✅ Immediate opt-out honor (no delays)

### Multi-Tenant Isolation
✅ Row Level Security (RLS) on all tables
✅ All queries filtered by `dealer_id`
✅ No cross-dealer data access
✅ Service role for server operations only

### Data Protection
✅ Phone numbers in E.164 format
✅ Emails normalized (lowercase)
✅ Transcripts encrypted at rest
✅ Audit logs for all operations

---

## 📈 Monitoring

### Key Metrics
- **Contact Rate**: Answered / Attempted (target: >30%)
- **Transfer Success**: Completed / Initiated (target: >80%)
- **Call Duration**: Average (target: 3-5 minutes)
- **Time to Contact**: Event → Call (target: <5 minutes)
- **Transcript Capture**: All calls (target: 100%)

### Dashboards
- **Inngest**: Job success rates, latency, retries
- **Supabase**: Query performance, connections
- **SignalWire**: Call quality, duration, costs

---

## 🤝 Support

For issues or questions:
- **Documentation**: [SIGNALWIRE.md](SIGNALWIRE.md)
- **Issues**: GitHub Issues
- **Email**: support@dealerbdc.ai

---

## 📄 License

**Private - All Rights Reserved**

---

## 🙏 Credits

Built with:
- [SignalWire](https://signalwire.com) - Voice AI platform
- [Anthropic Claude](https://anthropic.com) - LLM
- [ElevenLabs](https://elevenlabs.io) - Voice synthesis
- [Inngest](https://inngest.com) - Job orchestration
- [Supabase](https://supabase.com) - Database

---

**DealerBDC.AI** - Transforming automotive BDCs with AI automation
