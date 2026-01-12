const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { validateRequest, validateExpressRequest } = require('twilio');
const OpenAI = require('openai');
const helmet = require('helmet');

require('dotenv').config();

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
    console.error('Missing required environment variables');
    process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Security & Parsing
app.set('trust proxy', true);
app.use(helmet());
app.use(express.urlencoded({ extended: true })); // Twilio sends form-urlencoded

// Health Check
app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

// Voice Answer Webhook
app.post('/voice-answer', (req, res) => {
    const twilioSignature = req.headers['x-twilio-signature'];
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
    // Twilio signs the full URL including query params
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

wss.on('connection', (ws) => {
    let sessionLang = 'en'; // Default
    let history = [
        { role: 'system', content: 'You are a helpful assistant for TradeLine 24/7. Keep answers concise (under 2 sentences). Do not use markdown.' }
    ];
    let inFlightController = null;
    let heartbeatInterval = null;

    // Heartbeat
    heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 20000);

    ws.on('close', () => {
        clearInterval(heartbeatInterval);
        if (inFlightController) inFlightController.abort();
    });

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);

            switch (msg.type) {
                case 'setup':
                    // Store session info if needed
                    break;

                case 'prompt':
                    if (!msg.last) return; // Buffer partials if needed, or just ignore for now (assuming 'last' is key)

                    if (msg.lang) {
                        sessionLang = msg.lang;
                        // Update system prompt or just rely on the AI to adapt, but user asked to force same language
                        // We can append a fleeting system instruction for the language
                    }

                    // Abort previous if any (though 'interrupt' usually handles this)
                    if (inFlightController) inFlightController.abort();
                    inFlightController = new AbortController();

                    history.push({ role: 'user', content: msg.token || '' });

                    // Cap history
                    if (history.length > 20) history = [history[0], ...history.slice(-19)];

                    // 1200ms Dead Air Guard
                    let deadAirTimer = setTimeout(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            const filler = sessionLang.startsWith('es') ? 'Un momento...' : 'One moment...';
                            ws.send(JSON.stringify({
                                type: 'text',
                                token: filler,
                                last: true, // It's a complete filler utterance
                                interruptible: true,
                                preemptible: true,
                                lang: sessionLang
                            }));
                        }
                    }, 1200);

                    try {
                        const stream = await openai.chat.completions.create({
                            model: 'gpt-4o', // Or user preferred model
                            messages: [
                                ...history,
                                { role: 'system', content: `Respond in language: ${sessionLang}` }
                            ],
                            stream: true,
                        }, { signal: inFlightController.signal });

                        let fullResponse = '';

                        for await (const chunk of stream) {
                            clearTimeout(deadAirTimer); // Clear timer on first byte
                            const content = chunk.choices[0]?.delta?.content || '';
                            if (content) {
                                fullResponse += content;
                                ws.send(JSON.stringify({
                                    type: 'text',
                                    token: content,
                                    last: false
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
                            lang: sessionLang
                        }));

                        history.push({ role: 'assistant', content: fullResponse });

                    } catch (err) {
                        clearTimeout(deadAirTimer);
                        if (err.name === 'AbortError') return;

                        console.error('OpenAI Error:', err);
                        const apology = sessionLang.startsWith('es') ? 'Lo siento, hubo un error.' : 'Sorry, I encountered an error.';
                        ws.send(JSON.stringify({
                            type: 'text',
                            token: apology,
                            last: true,
                            lang: sessionLang
                        }));
                    } finally {
                        inFlightController = null;
                    }
                    break;

                case 'interrupt':
                    if (inFlightController) {
                        inFlightController.abort();
                        inFlightController = null;
                    }
                    break;

                default:
                    break;
            }
        } catch (e) {
            console.error('WS Error:', e);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
