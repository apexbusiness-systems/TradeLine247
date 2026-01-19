# TradeLine 24/7 - Enterprise AI Receptionist Platform

**Transform Your Business Communications with 24/7 AI-Powered Receptionist Services**

TradeLine 24/7 revolutionizes business communications with an enterprise-grade AI receptionist platform. Never miss another opportunity with intelligent call answering, lead qualification, and seamless integration across all your business systems. Our advanced AI concierge provides empathetic, multilingual support while you focus on growing your business.

## 🌟 Why Choose TradeLine 24/7?

### 🤖 Advanced AI Receptionist
- **24/7 Intelligent Call Answering** - Professional AI receptionist handles calls around the clock
- **Smart Lead Qualification** - AI analyzes conversations and prioritizes high-value prospects
- **Multilingual Support** - Native fluency in English, French, Spanish, and Tagalog
- **Sentiment-Aware Responses** - Emotionally intelligent conversations with empathy injection
- **Voice Synthesis** - Natural-sounding speech powered by ElevenLabs neural voices

### 📊 Comprehensive Business Intelligence
- **Real-Time Analytics Dashboard** - Monitor call performance, conversion rates, and ROI
- **Automated Transcript Delivery** - Clean email summaries sent instantly after calls
- **Campaign Management** - Track marketing attribution and campaign effectiveness
- **Performance Metrics** - Detailed KPIs on response times, satisfaction scores, and lead quality

### 🔗 Enterprise Integration Suite
- **CRM Integration** - Seamless connection with Salesforce, HubSpot, and custom CRMs
- **Communication Channels** - Unified SMS, RCS, email, and voice messaging
- **API-First Architecture** - RESTful APIs for custom integrations and automation
- **Webhook Support** - Real-time notifications for all business events

### 🛡️ Enterprise-Grade Security & Compliance
- **GDPR Compliant** - Full data protection and privacy compliance
- **WCAG AA Accessibility** - Inclusive design for all users
- **Enterprise Security** - SOC 2 compliant with end-to-end encryption
- **Canadian Data Sovereignty** - All data stored in Canadian data centers

## 🚀 Live Production Platform

- **🌐 Production Application**: [tradeline247.vercel.app](https://tradeline247.vercel.app)
- **📱 iOS App**: Available on App Store (Certified for Enterprise Distribution)
- **🤖 Android App**: Available on Google Play (Internal Track Ready)
- **📊 API Documentation**: [Comprehensive API Reference](docs/)
- **🛠️ Developer Portal**: [GitHub Repository](https://github.com/Apex-Business-Apps/TradeLine247)

## 🏗️ Enterprise Technology Stack

### Frontend Architecture
- **React 18.3.1** - Modern component-based UI with concurrent features
- **TypeScript 5.8.3** - Type-safe development with strict compilation
- **Vite 5.4.19** - Lightning-fast build tool with HMR and optimization
- **shadcn/ui + Radix UI** - Accessible, customizable component library
- **Tailwind CSS 3.4.17** - Utility-first CSS framework for rapid styling

### State & Data Management
- **Zustand 4.5.7** - Lightweight, scalable state management
- **TanStack React Query 5.90.11** - Powerful data fetching and caching
- **Supabase 2.86.0** - PostgreSQL backend with real-time subscriptions
- **Edge Functions** - Serverless compute for AI processing and integrations

### Communication & AI Infrastructure
- **Twilio API** - Enterprise telephony with global coverage
- **ElevenLabs** - Neural voice synthesis with emotional intelligence
- **OpenAI Integration** - Advanced conversational AI and natural language processing
- **Sentiment Analysis** - Real-time emotion detection and response adaptation

### Mobile & Cross-Platform
- **Capacitor 7.4.4** - Native mobile apps from single codebase
- **iOS Native** - App Store compliant with advanced iOS features
- **Android Native** - Google Play optimized with Material Design
- **PWA Support** - Progressive Web App capabilities for all devices

### DevOps & Deployment
- **Vercel** - Global CDN with edge computing and analytics
- **GitHub Actions** - Automated CI/CD with comprehensive testing
- **Codemagic** - Mobile CI/CD with app store publishing
- **Docker** - Containerized deployments for consistency

## 📋 Prerequisites

- **Node.js**: 20.x (LTS)
- **npm**: ≥10.0.0
- **Git**: Latest version

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Apex-Business-Apps/TradeLine247.git
   cd TradeLine247
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy and configure your environment variables
   cp .env.example .env.local
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Run tests**
   ```bash
   npm run test:ci  # Full test suite
   npm run test:e2e:smoke  # Smoke tests only
   ```

## Windows: Fix EPERM unlink during npm install

- Close VS Code + stop node processes
- (Optional) Add Defender exclusion for the repo folder
- Delete node_modules using: `cmd /c "rd /s /q node_modules"`
- Run: `npm ci`
- Run: `npm run build`

`npm ci` is the recommended clean install for CI parity.

## 📁 Project Structure

```
TradeLine247/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── ui/           # shadcn/ui components
│   │   ├── layout/       # Layout components
│   │   ├── dashboard/    # Dashboard-specific components
│   │   └── sections/     # Landing page sections
│   ├── pages/            # Route components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   ├── stores/           # Zustand state stores
│   └── types/            # TypeScript type definitions
├── supabase/
│   ├── functions/        # Edge functions
│   └── migrations/       # Database migrations
├── tests/                # Test files
├── ios/                  # iOS Capacitor project
├── android/              # Android Capacitor project
├── scripts/              # Build and utility scripts
├── server.cjs            # Production Voice Server (Node.js)
└── .env.example          # Environment variables template
```

## 🎯 Key Features

### 🤖 AI Receptionist
- 24/7 automated call answering
- Intelligent lead qualification
- Clean email transcript delivery
- Customizable AI responses

### 📊 Dashboard & Analytics
- Real-time call monitoring
- Performance metrics and KPIs
- ROI calculator and reporting
- Service health monitoring

### 🔐 Security & Compliance
- Enterprise-grade security
- GDPR compliance ready
- WCAG AA accessibility
- CSP and security headers

### 📱 Multi-Platform Support
- Responsive web application
- iOS native app (Capacitor)
- Android native app (Capacitor)
- PWA capabilities

## 📞 Twilio Voice Integration

### Environment Variables Required
```bash
# Twilio Configuration
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_ACCOUNT_SID=your_account_sid

# Voice Testing (Optional - enables receptionist mode for test numbers)
VOICE_TEST_ALLOWLIST=+15551234567,+15559876543
```

### Twilio Console Configuration

#### 1. Voice Webhook (Inbound Calls)
- **URL**: `https://<your-railway-app-url>/voice-answer`
- **Method**: `POST`
- **Voice Settings**: Accept incoming calls

#### 2. Status Callbacks
- **URL**: `https://your-project.supabase.co/functions/v1/voice-status`
- **Method**: `POST`
- **Events**: `initiated`, `ringing`, `answered`, `completed`

#### 3. Recording Status Callbacks
- **URL**: `https://your-project.supabase.co/functions/v1/voice-recording-status`
- **Method**: `POST`
- **Events**: `in-progress`, `completed`, `failed`

### Testing & Monitoring

#### Local Testing
```bash
# Test webhook payloads without calling Twilio
npm run test:twilio-webhooks

# Test specific webhook types
node scripts/test-twilio-webhooks.mjs voice          # Test inbound call
node scripts/test-twilio-webhooks.mjs status CA123   # Test status callback
node scripts/test-twilio-webhooks.mjs recording CA123 # Test recording callback
node scripts/test-twilio-webhooks.mjs qa-view        # View call monitoring
node scripts/test-twilio-webhooks.mjs full-flow      # Complete call flow test
```

#### QA Monitoring
- **Endpoint**: `https://your-project.supabase.co/functions/v1/voice-qa-view`
- **Method**: `GET` (requires service key auth)
- **Returns**: Recent calls with status timelines and analytics

### Security Features
- ✅ Twilio signature validation on all webhooks
- ✅ Test number allowlist for receptionist mode
- ✅ Idempotent status/recording callbacks
- ✅ Comprehensive audit logging

## 🧪 Testing

### Unit Tests
```bash
npm run test:unit
```

### E2E Tests
```bash
npm run test:e2e          # Full E2E suite
npm run test:e2e:smoke    # Critical path tests
npm run test:a11y         # Accessibility tests
npm run test:security     # Security validation
```

### CI/CD Tests
```bash
npm run test:ci           # Full CI pipeline
npm run test:ci:coverage  # With coverage reporting
```

## 🚢 Deployment

### Web Deployment (Vercel)
```bash
npm run build:web
# Deploy via Vercel dashboard or GitHub integration
```

### Mobile Builds
```bash
# iOS
npm run build:ios

# Android
npm run build:android
```

### CI/CD
- **GitHub Actions**: Automated testing and deployment
- **Codemagic**: iOS/Android mobile builds
- **Vercel**: Web deployment with preview environments
- **Railway**: Node.js Voice Server deployment


## 🔧 Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test:unit` | Unit tests |
| `npm run test:e2e` | E2E tests |
| `npm run test:ci` | Full CI test suite |

## 📚 Documentation

- [Security Policy](SECURITY.md)
- [API Documentation](docs/)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software owned by Apex Business Systems.

## 📞 Support

For support or questions:
- **Email**: info@tradeline247ai.com
- **Phone**: 587-742-8885
- **Documentation**: [docs/](docs/)

---

**Built with ❤️ by Apex Business Systems**