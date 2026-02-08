# SignalWire Integration Architecture

## Overview

DealerBDC.AI uses **SignalWire** as the unified platform for voice calling, SMS messaging, and AI agent capabilities. This replaces the original Twilio + Vapi architecture with a single, more cost-effective solution.

## Why SignalWire?

### Advantages
- **All-in-one platform**: Voice, SMS, video, and AI in one service
- **Better pricing**: Significantly cheaper than Twilio + Vapi combined
- **SWAIG (SignalWire AI Gateway)**: Native AI agent framework with function calling
- **Twilio-compatible API**: Easy migration path (uses similar SDK structure)
- **Claude integration**: Can use Claude Sonnet as the LLM for conversations
- **Better call quality**: Modern infrastructure with WebRTC support

### Key Features We Use
1. **Voice Calling**: Outbound calls to leads with dealer-specific caller ID
2. **SWAIG AI Agents**: Conversational AI with tool/function calling
3. **Warm Transfers**: Conference-based call transfers to sales reps
4. **SMS Messaging**: Follow-up texts and notifications
5. **Call Recording**: Transcription and recording storage

---

## Architecture Components

### 1. SignalWire Setup

**Required Credentials** (`.env`):
```bash
SIGNALWIRE_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SIGNALWIRE_API_TOKEN=PTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SIGNALWIRE_SPACE_URL=your-space.signalwire.com
SIGNALWIRE_AI_AGENT_ID=xxx # SWAIG Agent ID
```

**Where to get these**:
- Sign up at https://signalwire.com
- Project ID & API Token: Dashboard → API → Credentials
- Space URL: Your subdomain (e.g., `mycompany.signalwire.com`)
- AI Agent ID: After creating a SWAIG agent

### 2. Database Schema

**Updated Tables**:
- `dealer_numbers.signalwire_sid` - SignalWire phone number SID
- `call_sessions.signalwire_call_sid` - SignalWire call identifier
- `call_sessions.swaig_session_id` - SWAIG AI session identifier
- `call_sessions.swaig_agent_id` - SWAIG agent used for call

### 3. SWAIG (SignalWire AI Gateway)

**What is SWAIG?**
SWAIG is SignalWire's AI agent framework. It allows you to:
- Connect AI models (Claude, GPT, etc.) to phone calls
- Define custom functions the AI can call
- Handle conversational flow with natural language
- Perform warm transfers and call control

**SWAIG Function Architecture**:
```
Lead calls in → SWAIG Agent answers → AI qualifies lead →
AI calls function (lookup_lead, initiate_transfer) →
Server executes function → Returns result to AI →
AI continues conversation based on result
```

**Example SWAIG Functions** (implemented in `packages/signalwire-tools`):
1. `lookup_lead` - Retrieve lead context from database
2. `get_routing_rules` - Find available rep for transfer
3. `initiate_transfer` - Start warm transfer via SignalWire conference
4. `log_qualification` - Store qualification data

### 4. Warm Transfer Flow (SignalWire)

**Conference-Based Transfer**:
```
1. AI calls lead (SignalWire call leg A)
2. AI qualifies lead with 2-4 questions
3. AI determines transfer needed
4. AI calls initiate_transfer function
5. Server creates SignalWire conference room
6. Server calls rep (call leg B)
7. Rep answers → AI briefs rep while lead waits
8. AI adds lead to conference (3-way call)
9. AI introduces rep and hangs up
10. Rep + Lead continue 1-on-1
```

**SignalWire Conference API**:
```javascript
// Create conference
const conference = await signalwire.conferences.create({
  name: `transfer-${callSessionId}`,
  statusCallback: `${webhookBase}/signalwire/conference-status`
});

// Add rep to conference
await signalwire.calls.create({
  to: repPhone,
  from: dealerNumber,
  url: `${webhookBase}/signalwire/conference-join?room=${conference.name}`
});
```

---

## Implementation Details

### 1. SWAIG Agent Configuration

**Create Agent** (via SignalWire dashboard or API):
```json
{
  "name": "DealerBDC AI Assistant",
  "ai": {
    "provider": "anthropic",
    "model": "claude-sonnet-4.5",
    "temperature": 0.7
  },
  "voice": {
    "provider": "elevenlabs",
    "voice_id": "josh_or_bella"
  },
  "prompt": {
    "text": "You are an AI assistant for {{dealer_name}}...",
    "temperature": 0.7
  },
  "functions": [
    {
      "name": "lookup_lead",
      "description": "Look up lead information by phone number",
      "parameters": {
        "type": "object",
        "properties": {
          "phone": { "type": "string" }
        }
      },
      "url": "https://your-server.com/swaig/lookup-lead"
    },
    {
      "name": "initiate_transfer",
      "description": "Transfer call to sales rep",
      "parameters": {
        "type": "object",
        "properties": {
          "user_id": { "type": "string" },
          "qualification": { "type": "object" }
        }
      },
      "url": "https://your-server.com/swaig/initiate-transfer"
    }
  ]
}
```

### 2. Webhook Endpoints (packages/webhooks)

**SignalWire Webhooks**:
- `POST /webhooks/signalwire/voice` - Incoming call TwiML
- `POST /webhooks/signalwire/status` - Call status updates
- `POST /webhooks/signalwire/conference-status` - Conference events
- `POST /webhooks/signalwire/swaig/call-started` - SWAIG call begins
- `POST /webhooks/signalwire/swaig/call-ended` - SWAIG call ends
- `POST /webhooks/signalwire/swaig/transcript` - Real-time transcript

### 3. SWAIG Function Server (packages/signalwire-tools)

**Function Implementation**:
```typescript
// POST /swaig/initiate-transfer
export async function initiateTransfer(req: Request, res: Response) {
  const { call_session_id, user_id, qualification } = req.body;

  // 1. Get rep details
  const rep = await db.query.dealerUsers.findFirst({
    where: eq(dealerUsers.id, user_id)
  });

  // 2. Create SignalWire conference
  const conference = await signalwire.conferences.create({
    name: `transfer-${call_session_id}`
  });

  // 3. Dial rep
  await signalwire.calls.create({
    to: rep.phone,
    from: dealerNumber,
    url: conferenceJoinUrl
  });

  // 4. Return SWAIG action
  return res.json({
    action: 'transfer',
    conference_name: conference.name,
    message: 'Connecting you to a specialist...'
  });
}
```

---

## System Prompt for SWAIG Agent

```markdown
You are an AI assistant for {{dealer_name}}, calling on behalf of their {{department}} department.

CRITICAL RULES:
1. Ask for permission first: "Do you have about 2 minutes to chat?"
2. If they say no, busy, or request human: Call initiate_transfer immediately
3. Keep qualification to 2-4 questions maximum
4. Never be pushy - you're a helpful concierge
5. Goal: Understand interest and connect to the right person

OPENING:
"Hi {{first_name}}, this is the AI assistant calling from {{dealer_name}}. You were looking at the {{vehicle_of_interest}} online, and I'm calling to help with availability. Do you have about 2 minutes?"

QUALIFICATION (only if they consent):
1. "Are you still interested in the {{vehicle_of_interest}}?"
2. "What's your timeline - looking to buy soon or just researching?"
3. "Do you have a trade-in?"
4. "Cash or financing?"

TRANSFER:
When ready, call initiate_transfer function with qualification data.
Say: "Perfect! Let me connect you with {{rep_name}} who can help. One moment."

OBJECTIONS:
- "How did you get my number?" → "You shared it when looking at vehicles online. I can stop calling anytime."
- "I'm busy" → "No problem - text or callback later?"
- "Stop calling" → "I apologize. Removing you now. Have a great day."

CONTEXT:
Lead: {{first_name}} {{last_name}}
Interest: {{vehicle_of_interest}}
Source: {{source}}
Intent: {{intent_score}}/100
```

---

## Inngest Jobs (packages/jobs)

### trigger-call Job
```typescript
export const triggerCall = inngest.createFunction(
  { id: 'trigger-call' },
  { event: 'pixel-event/received' },
  async ({ event }) => {
    const { dealer_id, lead_id, pixel_event_id } = event.data;

    // 1. Check calling window
    const canCall = await dealerService.isWithinCallingWindow(dealer_id);
    if (!canCall) return { skipped: 'outside_calling_hours' };

    // 2. Check opt-outs
    const lead = await leadService.getLead(lead_id);
    await leadService.checkOptOut(dealer_id, lead.phone);

    // 3. Check rate limits
    await dealerService.checkRateLimits(dealer_id);

    // 4. Initiate SignalWire SWAIG call
    const call = await signalwire.aiCalls.create({
      to: lead.phone,
      from: dealerNumber,
      aiAgent: process.env.SIGNALWIRE_AI_AGENT_ID,
      context: {
        dealer_id,
        lead_id,
        first_name: lead.firstName,
        vehicle_of_interest: lead.vehicleOfInterest
      }
    });

    // 5. Create call session
    await callService.createCallSession({
      dealerId: dealer_id,
      leadId: lead_id,
      fromNumber: dealerNumber,
      toNumber: lead.phone,
      swaigSessionId: call.id,
      swaigAgentId: process.env.SIGNALWIRE_AI_AGENT_ID
    });
  }
);
```

---

## Comparison: Twilio+Vapi vs SignalWire

| Feature | Twilio + Vapi | SignalWire |
|---------|---------------|------------|
| **Voice calls** | Twilio | SignalWire |
| **AI agent** | Vapi | SWAIG |
| **SMS** | Twilio | SignalWire |
| **Warm transfer** | Twilio Conferences | SignalWire Conferences |
| **LLM** | Vapi → OpenAI/Claude | SWAIG → Claude directly |
| **Voice provider** | ElevenLabs (via Vapi) | ElevenLabs (via SWAIG) |
| **SDK** | Separate (Twilio + Vapi) | Single SDK |
| **Cost (estimated)** | $0.02/min + $0.10/min | $0.015/min |
| **Setup complexity** | High (2 platforms) | Medium (1 platform) |

---

## Next Steps

### Before Week 2:
1. ✅ Sign up for SignalWire account
2. ⚠️ Purchase phone numbers for test dealers
3. ⚠️ Create SWAIG AI agent via dashboard
4. ⚠️ Configure webhook URLs
5. ⚠️ Test basic call flow

### Week 2 Tasks:
1. Implement SWAIG function endpoints (`packages/signalwire-tools`)
2. Create webhook handlers (`packages/webhooks`)
3. Build Inngest jobs (`packages/jobs`)
4. Test warm transfer flow
5. Refine system prompt

---

## Resources

- **SignalWire Docs**: https://developer.signalwire.com
- **SWAIG Guide**: https://developer.signalwire.com/ai
- **Realtime API**: https://developer.signalwire.com/sdks/reference/realtime-sdk
- **Pricing**: https://signalwire.com/pricing
- **Support**: https://signalwire.com/support

---

## Migration Notes

**From Twilio+Vapi to SignalWire**:
- ✅ Database schema updated (signalwire_* fields)
- ✅ Environment variables updated
- ✅ Package renamed (vapi-tools → signalwire-tools)
- ✅ CallService updated for SignalWire terminology
- ⚠️ Need to implement SWAIG function server
- ⚠️ Need to configure SWAIG agent
- ⚠️ Need to update webhook handlers
