import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Zap, ExternalLink, Settings, Play, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { IntegrationCard, premiumCardStyle, type IntegrationProvider } from '@/components/integrations/IntegrationCard';
import { IntegrationPageLayout } from '@/components/integrations/IntegrationPageLayout';
import { useIntegrationConnect } from '@/components/integrations/useIntegrationConnect';

interface AutomationProvider extends IntegrationProvider {
  pricing: string;
  color: string;
}

const automationProviders: AutomationProvider[] = [
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect 6,000+ apps with automated workflows',
    logo: '⚡',
    status: 'available',
    features: ['Trigger workflows', 'Multi-step zaps', 'Conditional logic', 'Error handling'],
    pricing: 'Free + Premium',
    color: 'bg-orange-500/10 text-brand-primary border-brand-primary',
  },
  {
    id: 'ifttt',
    name: 'IFTTT',
    description: 'If This Then That - Simple automation',
    logo: '🔗',
    status: 'available',
    features: ['Simple triggers', 'Applet creation', 'Location-based', 'IoT integration'],
    pricing: 'Free + Pro',
    color: 'bg-blue-500/10 text-info border-info',
  },
  {
    id: 'power-automate',
    name: 'Microsoft Power Automate',
    description: 'Enterprise automation for Microsoft ecosystem',
    logo: '🔄',
    status: 'available',
    features: ['Microsoft 365', 'AI Builder', 'Desktop flows', 'Approval workflows'],
    pricing: 'Subscription',
    color: 'bg-indigo-500/10 text-info border-indigo-500/20',
  },
  {
    id: 'make',
    name: 'Make (formerly Integromat)',
    description: 'Visual automation platform',
    logo: '🎯',
    status: 'coming-soon',
    features: ['Visual builder', 'Complex scenarios', 'Data transformation', 'Real-time sync'],
    pricing: 'Free + Premium',
    color: 'bg-purple-500/10 text-neutral border-neutral',
  },
];

const automationTemplates = [
  {
    id: 'crm-lead',
    title: 'CRM Lead Creation',
    description: 'Automatically create leads in your CRM when calls are completed',
    trigger: 'Call Completed',
    action: 'Create CRM Lead',
    apps: ['Salesforce', 'HubSpot', 'Pipedrive'],
    difficulty: 'Easy',
  },
  {
    id: 'email-followup',
    title: 'Email Follow-up',
    description: 'Send follow-up emails to callers based on call outcome',
    trigger: 'Call Tagged',
    action: 'Send Email',
    apps: ['Gmail', 'Outlook', 'SendGrid'],
    difficulty: 'Easy',
  },
  {
    id: 'calendar-booking',
    title: 'Calendar Booking',
    description: 'Schedule appointments in calendar when requested during calls',
    trigger: 'Appointment Requested',
    action: 'Create Calendar Event',
    apps: ['Google Calendar', 'Outlook Calendar', 'Calendly'],
    difficulty: 'Medium',
  },
  {
    id: 'slack-notification',
    title: 'Team Notifications',
    description: 'Notify team members in Slack for urgent or high-priority calls',
    trigger: 'High Priority Call',
    action: 'Send Slack Message',
    apps: ['Slack', 'Microsoft Teams', 'Discord'],
    difficulty: 'Easy',
  },
];

const AutomationIntegration = () => {
  const { isConnecting, connect } = useIntegrationConnect();
  const [webhookUrl, setWebhookUrl] = useState('');

  const handleConnect = async (provider: AutomationProvider) => {
    await connect(provider.name, { provider: provider.id, category: 'automation' });
  };

  const handleTemplateSetup = async (template: (typeof automationTemplates)[number]) => {
    try {
      if (!supabase) throw new Error('Service unavailable');

      const { data, error } = await supabase.functions.invoke('integration-connect', {
        body: { provider: template.id, category: 'automation-template', webhookUrl: webhookUrl || undefined },
      });

      if (error) throw error;
      toast.success(data?.message ?? `"${template.title}" automation configured!`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to set up "${template.title}": ${msg}`);
    }
  };

  const testWebhook = async () => {
    if (!webhookUrl) {
      toast.error('Please enter a webhook URL');
      return;
    }

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors',
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          event: 'webhook_test',
          data: { message: 'Test webhook from TradeLine 24/7' },
        }),
      });
      toast.success('Test webhook sent successfully!');
    } catch {
      toast.error('Failed to send test webhook');
    }
  };

  return (
    <IntegrationPageLayout
      title="Automation Integrations"
      description="Connect to automation platforms and create workflows"
      icon={Zap}
      iconGradient="from-amber-600/10 to-amber-600/5"
      iconColor="text-amber-800"
    >
      {/* Automation Providers */}
      <div className="grid gap-6 md:grid-cols-2">
        {automationProviders.map((provider) => (
          <IntegrationCard
            key={provider.id}
            provider={provider}
            dimmed={provider.status === 'coming-soon'}
            extraBadge={<Badge className={`mt-2 ${provider.color}`}>{provider.pricing}</Badge>}
            footer={
              <Button
                variant="default"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => handleConnect(provider)}
                disabled={isConnecting || provider.status === 'coming-soon'}
              >
                {provider.status === 'coming-soon' ? 'Coming Soon' : isConnecting ? 'Connecting...' : (
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

      {/* Webhook Configuration */}
      <Card className="relative overflow-hidden border-0 bg-card/60 backdrop-blur-sm" style={premiumCardStyle}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Webhook Configuration
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Set up webhooks to trigger external automations
          </p>
        </CardHeader>

        <CardContent className="relative z-10 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={testWebhook} variant="outline">
                <Play className="h-4 w-4 mr-2" />
                Test
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copy your webhook URL from Zapier, IFTTT, or other automation platforms
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="events">Trigger Events</Label>
              <select id="events" className="w-full p-2 rounded-md border border-input bg-background">
                <option>All events</option>
                <option>Call completed</option>
                <option>Call missed</option>
                <option>Lead qualified</option>
                <option>Appointment requested</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="format">Data Format</Label>
              <select id="format" className="w-full p-2 rounded-md border border-input bg-background">
                <option>JSON</option>
                <option>Form data</option>
                <option>XML</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automation Templates */}
      <Card className="relative overflow-hidden border-0 bg-card/60 backdrop-blur-sm" style={premiumCardStyle}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Automation Templates
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pre-built automation workflows you can set up instantly
          </p>
        </CardHeader>

        <CardContent className="relative z-10">
          <div className="grid gap-4 md:grid-cols-2">
            {automationTemplates.map((template, index) => (
              <div
                key={template.id}
                className="p-4 rounded-2xl bg-gradient-to-r from-muted/10 to-muted/5 border border-transparent hover:border-primary/20 transition-all duration-300 hover:shadow-[var(--premium-shadow-subtle)] animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-foreground">{template.title}</h3>
                    <Badge
                      className={`text-xs ${
                        template.difficulty === 'Easy'
                          ? 'bg-[hsl(142,85%,95%)] text-[hsl(142,85%,25%)] border-[hsl(142,85%,70%)]'
                          : 'bg-amber-600/10 text-amber-800 border-amber-600/20'
                      }`}
                    >
                      {template.difficulty}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground">{template.description}</p>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 bg-blue-500/10 text-info rounded">{template.trigger}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="px-2 py-1 bg-green-500/10 text-[hsl(142,85%,25%)] rounded">{template.action}</span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {template.apps.map((app) => (
                      <span key={app} className="text-xs px-2 py-1 bg-muted/30 rounded">
                        {app}
                      </span>
                    ))}
                  </div>

                  <Button size="sm" className="w-full" onClick={() => handleTemplateSetup(template)}>
                    <Play className="h-3 w-3 mr-2" />
                    Set Up Automation
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </IntegrationPageLayout>
  );
};

export default AutomationIntegration;
