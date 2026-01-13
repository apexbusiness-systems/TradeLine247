# TradeLine Voice Server

Standalone Node.js service for TradeLine247 voice capabilities. Features protocol-correct ConversationRelay support, multi-language handling, and strict security validation.

## Environment Variables

Ensure these are set in your deployment environment (e.g., Railway):

- \`OPENAI_API_KEY\`: Your OpenAI API key.
- \`TWILIO_AUTH_TOKEN\`: Your Twilio Auth Token (for signature validation).
- \`PUBLIC_BASE_URL\`: The public HTTPS URL of this service (e.g., \`https://tradeline-voice-server.up.railway.app\`).

## Endpoints

- \`GET /healthz\`: Health check (returns 200 OK).
- \`POST /voice-answer\`: TwiML webhook. Validates \`X-Twilio-Signature\`.
- \`WS /relay\`: WebSocket endpoint for ConversationRelay. Validates \`x-twilio-signature\`.

## Development

```bash
cd tradeline-voice-server
npm install
npm run dev
```

## Linting

```bash
npm run lint
```
