import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Settings, Smartphone } from 'lucide-react';
import { SettingsSection, ProviderGrid, FormSelectRow } from '@/components/integrations/IntegrationCard';
import { IntegrationPageLayout } from '@/components/integrations/IntegrationPageLayout';
import { useIntegrationConnect } from '@/components/integrations/useIntegrationConnect';
import type { IntegrationProvider } from '@/components/integrations/IntegrationCard';

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

  return (
    <IntegrationPageLayout
      title="Email Integrations"
      description="Connect to email apps and automate follow-ups"
      icon={Mail}
      iconGradient="from-green-500/10 to-green-500/5"
      iconColor="text-[hsl(142,85%,25%)]"
    >
      <ProviderGrid
        providers={emailProviders}
        isConnecting={isConnecting}
        onConnect={(provider) => connect(provider.name, { provider: provider.id, category: 'email' })}
        renderExtraBadge={(provider) => (
          <div className="flex items-center gap-2 mt-2">
            <Smartphone className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{provider.platform}</span>
          </div>
        )}
      />

      <SettingsSection
        icon={Settings}
        title="Email Templates"
        description="Customize automated email responses sent after calls"
        saveLabel="Save Email Configuration"
      >
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

        <FormSelectRow
          selects={[
            { id: 'auto-send', label: 'Auto-send emails', options: ['After every call', 'Only for qualified leads', 'Manual approval required', 'Disabled'] },
            { id: 'send-delay', label: 'Send delay', options: ['Immediate', '5 minutes', '15 minutes', '1 hour'] },
          ]}
        />
      </SettingsSection>
    </IntegrationPageLayout>
  );
};

export default EmailIntegration;
