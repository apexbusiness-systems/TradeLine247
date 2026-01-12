const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const twilio = require('twilio');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://tradeline247-railway-production.up.railway.app';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL_NAME = process.env.MODEL_NAME || 'gpt-4-turbo-preview';

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/relay' });

// Health check
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

// Voice webhook - returns ConversationRelay TwiML
app.post('/voice-answer', (req, res) => {
  const signature = req.headers['x-twilio-signature'];
  const requestUrl = `${PUBLIC_BASE_URL}/voice-answer`;
  const params = req.body || {};

  if (!twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, requestUrl, params)) {
    console.error('[voice-answer] Invalid Twilio signature');
    return res.status(401).send('Invalid Twilio signature');
  }

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  const connect = response.connect();

  connect.conversationRelay({
    url: `${PUBLIC_BASE_URL.replace(/^http/, 'wss')}/relay`,
    welcomeGreeting: 'Thank you for calling TradeLine 24/7. How can I help?',
    transcriptionProvider: 'Deepgram',
    transcriptionLanguage: 'multi',
    speechModel: 'nova-3-general',
    interruptible: 'speech',
    preemptible: 'true',
    ttsProvider: 'ElevenLabs',
    ttsLanguage: 'multi'
  });

  res.type('text/xml');
  res.send(response.toString());
  console.log('[voice-answer] TwiML sent', { callSid: params.CallSid });
});

// Session state management
function createSession() {
  return {
    history: [],
    abortController: null,
    noDeadAirTimer: null,
    lastPongTs: Date.now()
  };
}

function getLocalizedFiller(lang) {
  const l = (lang || 'en').toLowerCase();
  if (l.startsWith('fr')) return 'Un instant, je prépare une réponse.';
  if (l.startsWith('es')) return 'Un momento, estoy preparando una respuesta.';
  if (l.startsWith('hi')) return 'एक क्षण, मैं आपका उत्तर तैयार कर रहा हूँ।';
  if (l.startsWith('pa')) return 'ਇੱਕ ਪਲ, ਮੈਂ ਤੁਹਾਡਾ ਜਵਾਬ ਤਿਆਰ ਕਰ ਰਿਹਾ ਹਾਂ।';
  return 'One moment, I am preparing an answer.';
}

// Simple LLM call (replace with actual OpenAI implementation)
async function callLLM({ prompt, history, lang, signal }) {
  // TODO: Implement actual OpenAI API call with AbortController signal
  // For now, returning a simple response
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay
  return `You said: "${prompt}". How can TradeLine 24/7 assist you further?`;
}

// WebSocket handler for ConversationRelay
wss.on('connection', (ws, req) => {
  const session = createSession();

  // Validate Twilio signature on WS handshake
  try {
    const parsed = url.parse(req.url, true);
    const requestUrl = `${PUBLIC_BASE_URL}${parsed.pathname}${parsed.search || ''}`;
    const params = parsed.query || {};
    const signature = req.headers['x-twilio-signature'];

    if (!twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, requestUrl, params)) {
      console.error('[relay] Invalid Twilio signature on handshake');
      ws.close(1008, 'Invalid Twilio signature');
      return;
    }
  } catch (err) {
    console.error('[relay] Signature validation error', { message: err.message });
    ws.close(1008, 'Signature validation error');
    return;
  }

  console.log('[relay] connection established');

  // Heartbeat ping/pong
  const heartbeatInterval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(heartbeatInterval);
      return;
    }
    const now = Date.now();
    if (now - session.lastPongTs > 40000) {
      console.warn('[relay] heartbeat timeout, terminating');
      clearInterval(heartbeatInterval);
      ws.terminate();
      return;
    }
    ws.ping();
  }, 20000);

  ws.on('pong', () => {
    session.lastPongTs = Date.now();
  });

  ws.on('close', () => {
    clearInterval(heartbeatInterval);
    if (session.noDeadAirTimer) clearTimeout(session.noDeadAirTimer);
    if (session.abortController) session.abortController.abort();
    console.log('[relay] connection closed');
  });

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return; // Ignore malformed JSON
    }

    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'setup') {
      console.log('[relay] setup', {
        callSid: msg.callSid,
        region: msg.region
      });
      return;
    }

    if (msg.type === 'interrupt') {
      console.log('[relay] interrupt');
      if (session.noDeadAirTimer) {
        clearTimeout(session.noDeadAirTimer);
        session.noDeadAirTimer = null;
      }
      if (session.abortController) {
        session.abortController.abort();
        session.abortController = null;
      }
      return;
    }

    if (msg.type === 'prompt') {
      const userText = msg.voicePrompt || '';
      const detectedLang = msg.lang || 'en-US';

      if (!userText.trim()) return;

      console.log('[relay] prompt', {
        lang: detectedLang,
        preview: userText.slice(0, 100)
      });

      // Update history
      session.history.push({ role: 'user', content: userText, lang: detectedLang });
      if (session.history.length > 20) {
        session.history = session.history.slice(-20);
      }

      // Abort existing turn
      if (session.abortController) {
        session.abortController.abort();
      }
      const abortController = new AbortController();
      session.abortController = abortController;

      const startTs = Date.now();
      let firstTokenTs = null;

      // No-dead-air timer (1.2s)
      const fillerPayload = {
        type: 'text',
        token: getLocalizedFiller(detectedLang),
        last: true
      };
      
      session.noDeadAirTimer = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(fillerPayload));
          firstTokenTs = Date.now();
          console.log('[relay] filler sent', {
            lang: detectedLang,
            delayMs: firstTokenTs - startTs
          });
        }
        session.noDeadAirTimer = null;
      }, 1200);

      try {
        const aiText = await callLLM({
          prompt: userText,
          history: session.history,
          lang: detectedLang,
          signal: abortController.signal
        });

        if (abortController.signal.aborted || ws.readyState !== WebSocket.OPEN) {
          return;
        }

        if (session.noDeadAirTimer) {
          clearTimeout(session.noDeadAirTimer);
          session.noDeadAirTimer = null;
        }

        const finalPayload = {
          type: 'text',
          token: aiText,
          last: true
        };
        ws.send(JSON.stringify(finalPayload));

        const finalTs = Date.now();
        if (!firstTokenTs) firstTokenTs = finalTs;
        
        console.log('[relay] final response sent', {
          lang: detectedLang,
          firstTokenMs: firstTokenTs - startTs,
          totalMs: finalTs - startTs
        });

        session.history.push({ role: 'assistant', content: aiText, lang: detectedLang });
        if (session.history.length > 20) {
          session.history = session.history.slice(-20);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('[relay] LLM aborted after interrupt');
          return;
        }
        console.error('[relay] LLM error', { message: err.message });
        if (session.noDeadAirTimer) {
          clearTimeout(session.noDeadAirTimer);
          session.noDeadAirTimer = null;
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'text',
            token: getLocalizedFiller(detectedLang),
            last: true
          }));
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`tradeline-voice-server listening on ${PORT}`);
  console.log(`PUBLIC_BASE_URL: ${PUBLIC_BASE_URL}`);
});
