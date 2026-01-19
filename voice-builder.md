---
name: voice-builder
description: "Omniscient Voice AI Agent and Telephony Systems Engineer. Triggers: build voice agent, create AI phone system, voice AI architecture, telephony integration, SIP setup, WebRTC implementation, call flow design, voice API integration, fix voice latency, debug voice agent, optimize voice quality, voice AI deployment, conversational AI phone, IVR system, voice bot, phone automation, call center AI, voice assistant integration, STT/TTS setup, real-time voice, voice pipeline, telephony debugging. Produces: production-grade voice AI systems with <200ms latency, enterprise telephony architecture, optimized call flows, compliant voice solutions."
license: "Proprietary - APEX Business Systems Ltd. Edmonton, AB, Canada. https://apexbusiness-systems.com"
version: "1.0.0"
---

# Voice AI Agent & Telephony Systems Engineer

**Mission**: Build production-grade voice AI systems with <200ms latency, enterprise reliability, and human-level conversation quality.

## Quick Decision Tree

**What are you building?**
- **New voice agent** → Section A: Architecture Selection
- **Integrating telephony** → Section B: Telephony Stack
- **Fixing latency/quality** → Section C: Optimization
- **Debugging issues** → Section D: Diagnostic Tree
- **Scaling/Production** → Section E: Production Deploy

---

## Section A: Architecture Selection

### Decision: Choose Your Stack

**Managed Platform (Fastest)?**
- **Vapi.ai** → Best for: rapid deployment, advanced features, $0.05/min
- **Bland AI** → Best for: outbound at scale, enterprise compliance
- **Retell AI** → Best for: ultra-low latency, custom voices
- **Twilio Voice + AI** → Best for: existing Twilio infrastructure

**Custom Build (Maximum Control)?**
- **WebRTC + LiveKit** → Best for: browser-based, real-time features
- **Twilio Media Streams** → Best for: hybrid approach, flexibility
- **FreeSWITCH/Asterisk** → Best for: on-premise, telco-grade

**Success Criteria**:
- First response <200ms
- Turn-taking feels natural
- <3% call failure rate
- Graceful degradation on poor networks

### Pattern 1: Vapi.ai Implementation (Fastest Path)

**Input**: Use case requirements, LLM choice, voice preference  
**Output**: Production voice agent with phone number  
**Time**: 30-60 minutes

```javascript
// vapi-config.js - Production-ready template
const vapiConfig = {
  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en-US",
    smartFormat: true,
    keywords: ["your_brand_name:10"] // Boost recognition
  },
  model: {
    provider: "openai",
    model: "gpt-4", // or gpt-4-turbo for speed
    temperature: 0.7,
    maxTokens: 250, // Keep responses tight
    messages: [
      {
        role: "system",
        content: `You are a professional phone assistant for [COMPANY].

CRITICAL RULES:
- Keep responses under 30 seconds
- Ask ONE question at a time
- Confirm understanding before proceeding
- Never say "I'm an AI" unless asked
- Use verbal acknowledgments: "I understand", "Got it"
- Handle interruptions gracefully

CONVERSATION STRUCTURE:
1. Greet warmly
2. Identify caller's need
3. Execute task or route appropriately
4. Confirm completion
5. Professional close

TONE: Professional, efficient, empathetic`
      }
    ]
  },
  voice: {
    provider: "11labs",
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel (professional)
    stability: 0.5,
    similarityBoost: 0.75,
    optimizeStreamingLatency: 4 // Max performance
  },
  firstMessage: "Hi! Thanks for calling [COMPANY]. How can I help you today?",
  
  // CRITICAL: Endpointing configuration
  endpointingConfig: {
    endpointingSensitivity: 0.5, // Lower = more patient
    clientSensitivity: 0.5,
    serverSensitivity: 0.5
  },
  
  // Call controls
  maxDurationSeconds: 900, // 15 min max
  silenceTimeoutSeconds: 30,
  
  // Recording & compliance
  recordingEnabled: true,
  hipaaEnabled: false, // Set true for healthcare
  
  // Analytics
  analysisPlan: {
    summaryPrompt: "Summarize call outcome and action items",
    structuredDataSchema: {
      outcome: "string",
      sentiment: "string",
      followUpRequired: "boolean"
    }
  }
};

// Create assistant via API
const createAssistant = async () => {
  const response = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(vapiConfig)
  });
  
  const assistant = await response.json();
  console.log(`✅ Assistant created: ${assistant.id}`);
  return assistant;
};

// Buy phone number and link
const setupPhoneNumber = async (assistantId) => {
  // Buy number
  const numberResponse = await fetch('https://api.vapi.ai/phone-number/buy', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      areaCode: '780', // Edmonton
      name: 'Main Line'
    })
  });
  
  const number = await numberResponse.json();
  
  // Link to assistant
  await fetch(`https://api.vapi.ai/phone-number/${number.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      assistantId: assistantId
    })
  });
  
  console.log(`✅ Phone number ready: ${number.number}`);
  return number;
};
```

**Common Failures to Pre-empt**:
- ❌ Not setting `optimizeStreamingLatency` → Slow responses
- ❌ Long system prompts (>500 words) → Increased latency
- ❌ No `maxTokens` limit → Agents ramble
- ❌ Missing keywords in transcriber → Poor name recognition
- ❌ No endpointing tuning → Awkward interruptions
- ❌ Forgetting `firstMessage` → Dead air on pickup

### Pattern 2: Twilio Media Streams (Custom Build)

**Input**: Custom logic requirements, existing backend  
**Output**: WebSocket-based real-time voice pipeline  
**Latency**: 150-250ms achievable

```javascript
// server.js - Production Twilio + OpenAI real-time
const WebSocket = require('ws');
const express = require('express');
const OpenAI = require('openai');

const app = express();
const wss = new WebSocket.Server({ port: 8080 });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// State management per call
const activeCalls = new Map();

wss.on('connection', (ws) => {
  console.log('📞 New Twilio connection');
  
  let callState = {
    streamSid: null,
    audioBuffer: [],
    transcript: '',
    conversationHistory: []
  };

  ws.on('message', async (message) => {
    const msg = JSON.parse(message);
    
    switch(msg.event) {
      case 'start':
        callState.streamSid = msg.start.streamSid;
        console.log(`✅ Call started: ${callState.streamSid}`);
        
        // Send greeting
        await sendTTS(ws, callState.streamSid, 
          "Hi! How can I help you today?");
        break;
        
      case 'media':
        // Accumulate audio chunks
        callState.audioBuffer.push(msg.media.payload);
        
        // Process every 1 second of audio
        if (callState.audioBuffer.length >= 50) { // ~1s at 20ms chunks
          await processAudio(ws, callState);
          callState.audioBuffer = [];
        }
        break;
        
      case 'stop':
        console.log(`📴 Call ended: ${callState.streamSid}`);
        activeCalls.delete(callState.streamSid);
        break;
    }
  });
});

// Process accumulated audio
async function processAudio(ws, callState) {
  // 1. Convert to audio file (use script)
  const audioData = Buffer.concat(
    callState.audioBuffer.map(b64 => Buffer.from(b64, 'base64'))
  );
  
  // 2. Transcribe with Deepgram (faster than Whisper)
  const transcript = await transcribeAudio(audioData);
  
  if (!transcript || transcript.length < 3) return; // Ignore noise
  
  console.log(`👤 User: ${transcript}`);
  callState.conversationHistory.push({
    role: 'user',
    content: transcript
  });
  
  // 3. Get LLM response
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful phone assistant. Keep responses under 30 seconds.'
      },
      ...callState.conversationHistory
    ],
    max_tokens: 150,
    temperature: 0.7
  });
  
  const aiMessage = response.choices[0].message.content;
  console.log(`🤖 AI: ${aiMessage}`);
  
  callState.conversationHistory.push({
    role: 'assistant',
    content: aiMessage
  });
  
  // 4. Synthesize and stream back
  await sendTTS(ws, callState.streamSid, aiMessage);
}

// TTS using ElevenLabs for quality
async function sendTTS(ws, streamSid, text) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_turbo_v2', // Fastest
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    }
  );
  
  // Stream audio back to Twilio
  const audioStream = response.body;
  for await (const chunk of audioStream) {
    const base64Audio = chunk.toString('base64');
    ws.send(JSON.stringify({
      event: 'media',
      streamSid: streamSid,
      media: {
        payload: base64Audio
      }
    }));
  }
  
  // Send mark when done
  ws.send(JSON.stringify({
    event: 'mark',
    streamSid: streamSid,
    mark: { name: 'audio_complete' }
  }));
}

// Fast transcription with Deepgram
async function transcribeAudio(audioBuffer) {
  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/wav'
      },
      body: audioBuffer
    }
  );
  
  const result = await response.json();
  return result.results?.channels[0]?.alternatives[0]?.transcript || '';
}

// TwiML endpoint for inbound calls
app.post('/incoming', (req, res) => {
  res.type('text/xml');
  res.send(`
    <Response>
      <Connect>
        <Stream url="wss://your-domain.com:8080" />
      </Connect>
    </Response>
  `);
});

app.listen(3000, () => {
  console.log('✅ Server running on port 3000');
});
```

**Critical Failures**:
- ❌ Not buffering audio correctly → Choppy transcription
- ❌ No VAD (Voice Activity Detection) → Transcribing silence
- ❌ Synchronous processing → High latency
- ❌ Not handling Twilio marks → Audio overlap
- ❌ Missing error handling on WebSocket disconnect

---

## Section B: Telephony Stack Integration

### Decision: Telephony Provider

**Need SIP trunking?** → Twilio Elastic SIP / Telnyx  
**Need compliance?** → Twilio Verify / Plivo (HIPAA ready)  
**Need international?** → Vonage / Bandwidth  
**Need cost optimization?** → Telnyx / SignalWire  

### SIP Configuration (Production Template)

```bash
# FreeSWITCH dialplan.xml - Production grade
<extension name="inbound_ai_agent">
  <condition field="destination_number" expression="^(\+1780\d{7})$">
    <!-- Log call -->
    <action application="log" data="INFO Incoming call from ${caller_id_number}"/>
    
    <!-- Answer immediately -->
    <action application="answer"/>
    
    <!-- Set codecs for quality -->
    <action application="set" data="absolute_codec_string=OPUS,PCMU,PCMA"/>
    
    <!-- Enable recording -->
    <action application="set" data="RECORD_TITLE=${uuid}"/>
    <action application="set" data="RECORD_COPYRIGHT=APEX Business Systems"/>
    <action application="record_session" data="/var/recordings/${uuid}.wav"/>
    
    <!-- Connect to AI agent via WebSocket -->
    <action application="socket" data="localhost:8080 async full"/>
    
    <!-- Fallback on error -->
    <action application="playback" data="/sounds/technical_difficulty.wav"/>
    <action application="hangup"/>
  </condition>
</extension>
```

**Common SIP Failures**:
- ❌ Wrong codec negotiation → Audio quality issues
- ❌ No DTMF relay setup → IVR buttons don't work
- ❌ Missing RTP timeout → Calls don't drop on silence
- ❌ No NAT traversal config → One-way audio
- ❌ Improper INVITE handling → Calls fail randomly

---

## Section C: Optimization (Latency & Quality)

### Latency Budget Breakdown

**Target**: <200ms total response time

| Component | Budget | Optimization |
|-----------|--------|--------------|
| **STT** | 50-80ms | Use Deepgram Nova-2 or AssemblyAI |
| **LLM** | 80-120ms | Use GPT-4 Turbo or Claude 3.5 Haiku |
| **TTS** | 50-70ms | Use ElevenLabs Turbo or Play.ht |
| **Network** | <30ms | Use edge deployment, CDN |

### Latency Optimization Checklist

```javascript
// optimize-latency.js - Apply all these patterns

// 1. STREAMING: Never wait for complete responses
const streamResponse = async (prompt) => {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: prompt }],
    stream: true, // CRITICAL
    max_tokens: 150 // Limit for speed
  });
  
  let buffer = '';
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    buffer += content;
    
    // Stream to TTS immediately on sentence boundary
    if (content.match(/[.!?]/)) {
      await streamTTS(buffer);
      buffer = '';
    }
  }
};

// 2. PARALLEL PROCESSING: Don't chain sequentially
const parallelProcess = async (audio) => {
  const [transcript, sentiment, intent] = await Promise.all([
    transcribe(audio),
    analyzeSentiment(audio),
    detectIntent(audio)
  ]);
  // Use all results together
};

// 3. EDGE CACHING: Cache common responses
const cache = new Map();
const getCachedResponse = async (key) => {
  if (cache.has(key)) {
    return cache.get(key); // Instant response
  }
  const response = await generateResponse(key);
  cache.set(key, response);
  return response;
};

// 4. PREFETCH: Start TTS before LLM finishes
let ttsQueue = [];
const prefetchTTS = async (partialText) => {
  // Start generating audio for likely responses
  if (partialText.length > 20) {
    ttsQueue.push(synthesize(partialText));
  }
};

// 5. CONNECTION POOLING: Reuse connections
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 50
});

// 6. COMPRESSION: Enable audio compression
const compressAudio = (pcmData) => {
  return opus.encode(pcmData, {
    rate: 16000,
    bitrate: 24000 // Balance quality vs size
  });
};
```

**Quality Optimization**:

```javascript
// Audio quality configuration
const qualityConfig = {
  // Noise suppression
  noiseSuppression: {
    enabled: true,
    level: 'high',
    type: 'krisp' // Best-in-class
  },
  
  // Echo cancellation
  echoCancellation: {
    enabled: true,
    tailLength: 256 // ms
  },
  
  // Automatic Gain Control
  agc: {
    enabled: true,
    targetLevel: -18 // dBFS
  },
  
  // Jitter buffer for packet loss
  jitterBuffer: {
    minDelay: 20,
    maxDelay: 200,
    adaptive: true
  }
};
```

---

## Section D: Debugging Decision Tree

**Issue: High Latency**
1. Measure each component → Use script `diagnose-latency.py`
2. STT slow? → Switch provider or upgrade tier
3. LLM slow? → Reduce max_tokens, use faster model
4. TTS slow? → Enable streaming, use Turbo models
5. Network? → Check edge deployment, use CDN

**Issue: Poor Audio Quality**
1. One-way audio? → NAT/firewall, check RTP
2. Choppy/robotic? → Codec mismatch, increase bitrate
3. Echo? → Enable AEC, check speaker/mic isolation
4. Noise? → Enable Krisp, upgrade noise suppression

**Issue: Conversation Problems**
1. Interrupts poorly? → Tune endpointing sensitivity
2. Talks over user? → Implement better VAD
3. Rambles? → Reduce max_tokens, add "be brief" to prompt
4. Misunderstands? → Add keywords, improve prompt, use examples

**Issue: Call Failures**
1. Check SIP response codes → Use script `analyze-sip-logs.py`
2. 503 Service Unavailable → Provider outage, add failover
3. 408 Request Timeout → Network issue, increase timeout
4. 488 Not Acceptable → Codec negotiation, fix SDP

---

## Section E: Production Deployment

### Pre-Flight Checklist

```yaml
# production-checklist.yml
infrastructure:
  - [ ] Load balancer configured with health checks
  - [ ] Auto-scaling enabled (CPU >70%)
  - [ ] CDN for static assets
  - [ ] Database connection pooling
  - [ ] Redis for session management

monitoring:
  - [ ] Call quality metrics (MOS scores)
  - [ ] Latency tracking (<200ms p95)
  - [ ] Error rate alerts (<1%)
  - [ ] Uptime monitoring (99.9%+ SLA)
  - [ ] Cost tracking per minute

security:
  - [ ] HTTPS/WSS only
  - [ ] API key rotation
  - [ ] Rate limiting (100 req/min per IP)
  - [ ] Input sanitization
  - [ ] PCI compliance (if payments)
  - [ ] HIPAA compliance (if healthcare)

compliance:
  - [ ] Call recording consent
  - [ ] TCPA compliance (opt-in required)
  - [ ] GDPR data retention policies
  - [ ] Accessibility (WCAG 2.1 AA)
  - [ ] E911 registration (if PSTN)

testing:
  - [ ] Load test (1000 concurrent calls)
  - [ ] Failover testing
  - [ ] Poor network simulation
  - [ ] Multi-language testing
  - [ ] Edge case scenarios
```

### Production Architecture

```
┌─────────────────┐
│   Phone/SIP     │
│   Provider      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Load Balancer  │  ← Cloudflare/AWS ALB
│  + Rate Limit   │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ Node  │ │ Node  │  ← Auto-scaling group
│   1   │ │   2   │
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│  WebSocket      │
│  Manager        │  ← Persistent connections
└────────┬────────┘
         │
    ┌────┴────────────┐
    ▼                 ▼
┌─────────┐    ┌──────────┐
│   STT   │    │   LLM    │  ← Parallel processing
│ Service │    │ Service  │
└────┬────┘    └─────┬────┘
     │               │
     └───────┬───────┘
             ▼
      ┌────────────┐
      │    TTS     │
      │  Service   │
      └──────┬─────┘
             │
             ▼
      ┌────────────┐
      │   Redis    │  ← Session state
      │   Cache    │
      └────────────┘
```

---

## Critical Anti-Patterns (NEVER DO)

❌ **Blocking I/O** → Always async/await  
❌ **No timeout handling** → Calls hang forever  
❌ **Hardcoded credentials** → Use env vars  
❌ **No fallback strategy** → Single point of failure  
❌ **Ignoring DTMF** → Users can't navigate IVR  
❌ **No call recording consent** → Legal liability  
❌ **Long prompts** → Increases latency  
❌ **No conversation memory** → Repetitive questions  
❌ **Synchronous LLM calls** → Terrible UX  
❌ **No monitoring** → Flying blind in production  

---

## Advanced Patterns

### Pattern: Interruption Handling

```javascript
// Advanced interruption detection
class InterruptionHandler {
  constructor() {
    this.isSpeaking = false;
    this.audioQueue = [];
  }
  
  async handleUserSpeech(transcript) {
    if (this.isSpeaking) {
      // User interrupted - stop immediately
      this.stopCurrentAudio();
      this.audioQueue = []; // Clear queue
      console.log('🛑 User interrupted');
    }
    
    // Process new input
    await this.processUserInput(transcript);
  }
  
  async playAudio(audioData) {
    this.isSpeaking = true;
    try {
      await this.streamAudio(audioData);
    } finally {
      this.isSpeaking = false;
    }
  }
  
  stopCurrentAudio() {
    // Send stop signal to audio stream
    this.emit('stop-audio');
    this.isSpeaking = false;
  }
}
```

### Pattern: Multi-Language Support

```javascript
// Automatic language detection and switching
const detectAndSwitch = async (audio) => {
  const detected = await detectLanguage(audio);
  
  return {
    transcriber: {
      language: detected.code,
      model: detected.code === 'en' ? 'nova-2' : 'whisper-large'
    },
    voice: {
      voiceId: VOICE_MAP[detected.code], // Pre-configured voices
      model: 'eleven_multilingual_v2'
    },
    prompt: PROMPTS[detected.code] // Localized system prompt
  };
};
```

---

## Reference Documents

Complex topics moved to `/references/`:
- `telephony-protocols.md` - Deep dive on SIP, RTP, WebRTC
- `voice-quality-metrics.md` - MOS scoring, audio analysis
- `compliance-guide.md` - TCPA, GDPR, HIPAA requirements
- `provider-comparison.md` - Feature matrix of all platforms
- `latency-optimization.md` - Advanced performance techniques
- `testing-scenarios.md` - Edge cases and load testing

## Scripts

- `scripts/diagnose-latency.py` - Component-level latency analysis
- `scripts/analyze-sip-logs.py` - SIP troubleshooting automation
- `scripts/load-test.py` - Stress test voice infrastructure
- `scripts/quality-check.py` - Audio quality validation

---

**Version**: 1.0.0  
**Updated**: January 2025  
**License**: APEX Business Systems Ltd.
