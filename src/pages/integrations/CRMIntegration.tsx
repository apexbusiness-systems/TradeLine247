import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Database, ExternalLink, Settings } from 'lucide-react';
import { IntegrationCard, premiumCardStyle } from '@/components/integrations/IntegrationCard';
import { IntegrationPageLayout } from '@/components/integrations/IntegrationPageLayout';
import { useIntegrationConnect } from '@/components/integrations/useIntegrationConnect';

const crmProviders = [
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: "World's #1 CRM platform",
    logo: '🌩️',
    status: 'available' as const,
    features: ['Lead Management', 'Contact Sync', 'Opportunity Tracking', 'Custom Fields'],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Inbound marketing and sales platform',
    logo: '🧡',
    status: 'available' as const,
    features: ['Contact Management', 'Deal Pipeline', 'Email Tracking', 'Analytics'],
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    description: 'Sales-focused CRM for growing teams',
    logo: '🔵',
    status: 'available' as const,
    features: ['Pipeline Management', 'Activity Tracking', 'Email Integration', 'Reports'],
  },
  {
    id: 'zoho',
    name: 'Zoho CRM',
    description: 'Complete business suite CRM',
    logo: '📊',
    status: 'available' as const,
    features: ['Lead Scoring', 'Workflow Automation', 'Social CRM', 'Mobile Access'],
  },
];

const CRMIntegration = () => {
  const [apiKey, setApiKey] = useState('');
  const { isConnecting, connect } = useIntegrationConnect();

  const handleConnect = async (provider: (typeof crmProviders)[number]) => {
    const ok = await connect(provider.name, {
      provider: provider.id,
      category: 'crm',
      apiKey: apiKey || undefined,
    });
    if (ok) setApiKey('');
  };

  return (
    <IntegrationPageLayout
      title="CRM Integrations"
      description="Connect your AI receptionist to your CRM"
      icon={Database}
      iconGradient="from-blue-500/10 to-blue-500/5"
      iconColor="text-info"
    >
      <div className="grid gap-6 md:grid-cols-2">
        {crmProviders.map((provider) => (
          <IntegrationCard
            key={provider.id}
            provider={provider}
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

      {/* Configuration Section */}
      <Card className="relative overflow-hidden border-0 bg-card/60 backdrop-blur-sm" style={premiumCardStyle}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Integration Settings
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure how your AI receptionist interacts with your CRM
          </p>
        </CardHeader>

        <CardContent className="relative z-10 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sync-frequency">Sync Frequency</Label>
              <select id="sync-frequency" className="w-full p-2 rounded-md border border-input bg-background">
                <option>Real-time</option>
                <option>Every 5 minutes</option>
                <option>Every 15 minutes</option>
                <option>Hourly</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead-source">Default Lead Source</Label>
              <Input id="lead-source" placeholder="AI Receptionist" defaultValue="TradeLine 24/7 AI" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL (Optional)</Label>
            <Input id="webhook-url" placeholder="https://your-crm.com/webhook" type="url" />
            <p className="text-xs text-muted-foreground">
              Receive real-time notifications when leads are created or updated
            </p>
          </div>

          <Button className="w-full md:w-auto">Save Configuration</Button>
        </CardContent>
      </Card>
    </IntegrationPageLayout>
  );
};

export default CRMIntegration;
