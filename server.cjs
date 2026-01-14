const express = require('express');
const http = require('node:http');
const WebSocket = require('ws');
const { validateRequest, validateExpressRequest } = require('twilio');
const OpenAI = require('openai');
const helmet = require('helmet');

require('dotenv').config();

// Global Error Handlers (Railway requirement for clear logs)
process.on('uncaughtException', (err) => {
    console.error('❌ UNCAUGHT EXCEPTION:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ UNHANDLED REJECTION:', reason);
    process.exit(1);
});

console.log('✅ Server starting...');
console.log('Environment:', {
    PORT: process.env.PORT,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ SET' : '❌ MISSING',
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? '✅ SET' : '❌ MISSING', // Keep consistent with user request, though we use AUTH_TOKEN in code
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? '✅ SET' : '❌ MISSING',
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Environment check
const {
    OPENAI_API_KEY,
    TWILIO_AUTH_TOKEN,
    PUBLIC_BASE_URL,
    PORT = 3000,
} = process.env;

if (!OPENAI_API_KEY || !TWILIO_AUTH_TOKEN || !PUBLIC_BASE_URL) {
    console.warn("⚠️ [BUILD WARNING] Missing env var, skipping exit for build phase.");
    // process.exit(1);
}

let openai;
if (OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
    console.warn("⚠️ [STARTUP] OpenAI API Key missing. AI features will be disabled.");
}

// Security & Parsing
app.set('trust proxy', true);
app.use(helmet());
app.use(express.urlencoded({ extended: true })); // Twilio sends form-urlencoded

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Alias for internal consistency or legacy checks, if any
app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

// Voice Answer Webhook
app.post('/voice-answer', (req, res) => {
    const url = `${PUBLIC_BASE_URL}/voice-answer`;

    // Validate Twilio Signature
    if (!validateExpressRequest(req, TWILIO_AUTH_TOKEN, { url })) {
        return res.status(403).send('Forbidden');
    }

    const wsUrl = PUBLIC_BASE_URL.replace('https://', 'wss://') + '/relay';

    const twiml = `
    <Response>
      <Connect>
        <ConversationRelay
          url="${wsUrl}"
          welcomeGreeting="Thank you for calling TradeLine 24/7. How can I help?"
          transcriptionProvider="Deepgram"
          transcriptionLanguage="multi"
          speechModel="nova-3-general"
          ttsProvider="ElevenLabs"
          ttsLanguage="multi"
          interruptible="speech"
          preemptible="true"
        />
      </Connect>
    </Response>
  `;

    res.type('text/xml');
    res.send(twiml.trim());
});

// WebSocket Handling
server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, PUBLIC_BASE_URL);

    if (url.pathname !== '/relay') {
        socket.destroy();
        return;
    }

    // Validate Twilio Signature for WebSocket
    const fullUrl = PUBLIC_BASE_URL + request.url;
    const signature = request.headers['x-twilio-signature'];

    if (!validateRequest(TWILIO_AUTH_TOKEN, signature, fullUrl, {})) {
        console.error('WebSocket signature validation failed');
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

/**
 * Handles the 'prompt' message from Twilio ConversationRelay
 */
async function handlePrompt(msg, ws, state) {
    if (!msg.last) return; // Buffer partials if needed, or just ignore for now

    if (msg.lang) {

        state.sessionLang = msg.lang;
    }

    // Abort previous if any
    if (state.inFlightController) state.inFlightController.abort();

    state.inFlightController = new AbortController();

    state.history.push({ role: 'user', content: msg.token || '' });

    // Cap history
    if (state.history.length > 20) {

        state.history = [state.history[0], ...state.history.slice(-19)];
    }

    // 1200ms Dead Air Guard
    const deadAirTimer = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            const filler = state.sessionLang.startsWith('es') ? 'Un momento...' : 'One moment...';
            ws.send(JSON.stringify({
                type: 'text',
                token: filler,
                last: true,
                interruptible: true,
                preemptible: true,
                lang: state.sessionLang,
            }));
        }
    }, 1200);

    try {
        if (!openai) {
            throw new Error("OpenAI client not initialized (missing API Key)");
        }

        const stream = await openai.chat.completions.create({
            model: 'gpt-4o', // Or user preferred model
            messages: [
                ...state.history,
                { role: 'system', content: `Respond in language: ${state.sessionLang}` },
            ],
            stream: true,
        }, { signal: state.inFlightController.signal });

        let fullResponse = '';

        for await (const chunk of stream) {
            clearTimeout(deadAirTimer); // Clear timer on first byte
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullResponse += content;
                ws.send(JSON.stringify({
                    type: 'text',
                    token: content,
                    last: false,
                }));
            }
        }

        // End of stream
        ws.send(JSON.stringify({
            type: 'text',
            token: '',
            last: true,
            interruptible: true,
            preemptible: true,
            lang: state.sessionLang,
        }));

        state.history.push({ role: 'assistant', content: fullResponse });

    } catch (err) {
        clearTimeout(deadAirTimer);
        if (err.name === 'AbortError') return;

        console.error('OpenAI Error:', err);
        const apology = state.sessionLang.startsWith('es') ? 'Lo siento, hubo un error.' : 'Sorry, I encountered an error.';
        ws.send(JSON.stringify({
            type: 'text',
            token: apology,
            last: true,
            lang: state.sessionLang,
        }));
    } finally {

        state.inFlightController = null;
    }
}

/**
 * Handles the 'interrupt' message
 */
function handleInterrupt(state) {
    if (state.inFlightController) {
        state.inFlightController.abort();

        state.inFlightController = null;
    }
}

wss.on('connection', (ws) => {
    // Session State
    const state = {
        sessionLang: 'en',
        history: [
            { role: 'system', content: 'You are a helpful assistant for TradeLine 24/7. Keep answers concise (under 2 sentences). Do not use markdown.' },
        ],
        inFlightController: null,
    };

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 20000);

    ws.on('close', () => {
        clearInterval(heartbeatInterval);
        if (state.inFlightController) state.inFlightController.abort();
    });

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);

            switch (msg.type) {
                case 'setup':
                    break;
                case 'prompt':
                    await handlePrompt(msg, ws, state);
                    break;
                case 'interrupt':
                    handleInterrupt(state);
                    break;
                default:
                    break;
            }
        } catch (e) {
            console.error('WS Error:', e);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Voice server running on port ${PORT}`);
});
