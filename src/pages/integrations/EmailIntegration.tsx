import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, ExternalLink, Settings, Smartphone } from 'lucide-react';
import { IntegrationCard, premiumCardStyle, type IntegrationProvider } from '@/components/integrations/IntegrationCard';
import { IntegrationPageLayout } from '@/components/integrations/IntegrationPageLayout';
import { useIntegrationConnect } from '@/components/integrations/useIntegrationConnect';

interface EmailProvider extends IntegrationProvider {
  platform: string;
}

const emailProviders: EmailProvider[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: "Google's email service",
    logo: '📮',
    status: 'available',
    features: ['Auto-compose emails', 'Template management', 'Contact sync', 'Calendar integration'],
    platform: 'Web/Mobile',
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    description: "Microsoft's email and calendar service",
    logo: '📧',
    status: 'available',
    features: ['Exchange integration', 'Calendar sync', 'Contact management', 'Teams integration'],
    platform: 'Web/Mobile',
  },
  {
    id: 'apple-mail',
    name: 'Apple Mail',
    description: 'Native iOS and macOS email client',
    logo: '✉️',
    status: 'available',
    features: ['Native iOS integration', 'iCloud sync', 'Handoff support', 'VIP lists'],
    platform: 'iOS/macOS',
  },
  {
    id: 'thunderbird',
    name: 'Mozilla Thunderbird',
    description: 'Open-source email client',
    logo: '🦅',
    status: 'available',
    features: ['Add-on support', 'Privacy focused', 'Multi-account', 'Calendar integration'],
    platform: 'Desktop',
  },
];

const EmailIntegration = () => {
  const { isConnecting, connect } = useIntegrationConnect();
  const [emailTemplate, setEmailTemplate] = useState(`Hi {customer_name},

Thank you for calling TradeLine 24/7!

Your inquiry about {inquiry_topic} has been received and will be processed within 24 hours.

Here's a summary of your call:
- Call Duration: {call_duration}
- Primary Interest: {primary_interest}
- Follow-up Required: {follow_up_needed}

We'll be in touch soon!

Best regards,
TradeLine 24/7 Team`);

  const handleConnect = async (provider: EmailProvider) => {
    await connect(provider.name, { provider: provider.id, category: 'email' });
  };

  return (
    <IntegrationPageLayout
      title="Email Integrations"
      description="Connect to email apps and automate follow-ups"
      icon={Mail}
      iconGradient="from-green-500/10 to-green-500/5"
      iconColor="text-[hsl(142,85%,25%)]"
    >
      <div className="grid gap-6 md:grid-cols-2">
        {emailProviders.map((provider) => (
          <IntegrationCard
            key={provider.id}
            provider={provider}
            extraBadge={
              <div className="flex items-center gap-2 mt-2">
                <Smartphone className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{provider.platform}</span>
              </div>
            }
            footer={
              <Button className="w-full" onClick={() => handleConnect(provider)} disabled={isConnecting}>
                {isConnecting ? 'Connecting...' : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect {provider.name}
                  </>
                )}
              </Button>
            }
          />
        ))}
      </div>

      {/* Email Template Configuration */}
      <Card className="relative overflow-hidden border-0 bg-card/60 backdrop-blur-sm" style={premiumCardStyle}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Email Templates
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Customize automated email responses sent after calls
          </p>
        </CardHeader>

        <CardContent className="relative z-10 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email-subject">Email Subject</Label>
            <Input
              id="email-subject"
              placeholder="Thank you for calling TradeLine 24/7"
              defaultValue="Thank you for calling TradeLine 24/7 - Follow-up"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-template">Email Template</Label>
            <Textarea
              id="email-template"
              className="min-h-[200px] font-mono text-sm"
              value={emailTemplate}
              onChange={(e) => setEmailTemplate(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">
              <p className="mb-1">Available variables:</p>
              <div className="grid grid-cols-2 gap-2">
                <span>• {'{customer_name}'}</span>
                <span>• {'{call_duration}'}</span>
                <span>• {'{inquiry_topic}'}</span>
                <span>• {'{primary_interest}'}</span>
                <span>• {'{follow_up_needed}'}</span>
                <span>• {'{call_date}'}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="auto-send">Auto-send emails</Label>
              <select id="auto-send" className="w-full p-2 rounded-md border border-input bg-background">
                <option>After every call</option>
                <option>Only for qualified leads</option>
                <option>Manual approval required</option>
                <option>Disabled</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-delay">Send delay</Label>
              <select id="send-delay" className="w-full p-2 rounded-md border border-input bg-background">
                <option>Immediate</option>
                <option>5 minutes</option>
                <option>15 minutes</option>
                <option>1 hour</option>
              </select>
            </div>
          </div>

          <Button className="w-full md:w-auto">Save Email Configuration</Button>
        </CardContent>
      </Card>
    </IntegrationPageLayout>
  );
};

export default EmailIntegration;
