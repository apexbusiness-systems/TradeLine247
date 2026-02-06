import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, ExternalLink, Settings, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsSection, ProviderGrid, FormSelect } from '@/components/integrations/IntegrationCard';
import { IntegrationPageLayout } from '@/components/integrations/IntegrationPageLayout';
import { useIntegrationConnect } from '@/components/integrations/useIntegrationConnect';
import type { IntegrationProvider } from '@/components/integrations/IntegrationCard';

interface MessagingApp extends IntegrationProvider {
  setupType: string;
  color: string;
}

const messagingApps: MessagingApp[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: "World's most popular messaging app",
    logo: '💚',
    status: 'available',
    features: ['Business API', 'Auto-replies', 'Rich media support', 'Broadcast lists'],
    setupType: 'oauth',
    color: 'bg-[hsl(142,85%,95%)] text-[hsl(142,85%,25%)] border-[hsl(142,85%,70%)]',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Fast and secure messaging',
    logo: '✈️',
    status: 'available',
    features: ['Bot API', 'Inline queries', 'File sharing', 'Channel broadcasts'],
    setupType: 'bot-token',
    color: 'bg-blue-500/10 text-info border-info',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Business communication platform',
    logo: '💼',
    status: 'available',
    features: ['Slack app', 'Workflow automation', 'Custom commands', 'Thread replies'],
    setupType: 'oauth',
    color: 'bg-purple-500/10 text-neutral border-neutral',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Enterprise communication hub',
    logo: '👥',
    status: 'available',
    features: ['Teams bot', 'Meeting integration', 'File collaboration', 'Power Automate'],
    setupType: 'oauth',
    color: 'bg-indigo-500/10 text-info border-indigo-500/20',
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Community chat platform',
    logo: '🎮',
    status: 'coming-soon',
    features: ['Discord bot', 'Server integration', 'Voice channels', 'Rich embeds'],
    setupType: 'bot-token',
    color: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  },
  {
    id: 'facebook',
    name: 'Facebook Messenger',
    description: "Meta's messaging platform",
    logo: '📘',
    status: 'coming-soon',
    features: ['Messenger API', 'Rich cards', 'Quick replies', 'Persistent menu'],
    setupType: 'oauth',
    color: 'bg-blue-500/10 text-info border-info',
  },
];

const MessagingIntegration = () => {
  const { isConnecting, connect } = useIntegrationConnect();
  const [telegramBotToken, setTelegramBotToken] = useState('');

  const handleConnect = async (app: MessagingApp) => {
    if (app.setupType === 'bot-token' && app.id === 'telegram' && !telegramBotToken) {
      toast.error('Please enter your Telegram bot token');
      return;
    }

    const ok = await connect(app.name, {
      provider: app.id,
      category: 'messaging',
      credentials: app.id === 'telegram' ? { botToken: telegramBotToken } : undefined,
    });
    if (ok && app.id === 'telegram') setTelegramBotToken('');
  };

  return (
    <IntegrationPageLayout
      title="Messaging App Integrations"
      description="Connect to popular messaging platforms"
      icon={MessageSquare}
      iconGradient="from-orange-500/10 to-orange-500/5"
      iconColor="text-brand-primary"
    >
      <ProviderGrid
        providers={messagingApps}
        isConnecting={isConnecting}
        onConnect={handleConnect}
        columns={3}
        connectIcon={(app) => (app as MessagingApp).setupType === 'oauth' ? ExternalLink : Settings}
        renderChildren={(app) =>
          app.id === 'telegram' && app.status === 'available' ? (
            <div className="space-y-2 pt-4 border-t border-muted/20">
              <Label htmlFor="telegram-token">Bot Token</Label>
              <Input
                id="telegram-token"
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your bot token from @BotFather on Telegram
              </p>
            </div>
          ) : null
        }
      />

      <SettingsSection
        icon={Zap}
        title="Auto-Response Settings"
        description="Configure automated responses across all messaging platforms"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormSelect
            id="response-delay"
            label="Response Delay"
            options={['Immediate', '30 seconds', '1 minute', '2 minutes']}
          />
          <FormSelect
            id="business-hours"
            label="Business Hours Only"
            options={['Yes', 'No', 'Custom schedule']}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="auto-message">Default Auto-Reply Message</Label>
          <Input
            id="auto-message"
            placeholder="Thanks for your message! We'll get back to you soon."
            defaultValue="Hi! Thanks for reaching out to TradeLine 24/7. We've received your message and will respond within 24 hours during business hours."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="keywords">Keyword Triggers (comma-separated)</Label>
          <Input
            id="keywords"
            placeholder="urgent, help, pricing, demo"
            defaultValue="urgent, help, support, pricing, demo, info"
          />
          <p className="text-xs text-muted-foreground">
            Messages containing these keywords will trigger immediate notifications
          </p>
        </div>

        <Button className="w-full md:w-auto">Save Auto-Response Settings</Button>
      </SettingsSection>
    </IntegrationPageLayout>
  );
};

export default MessagingIntegration;
