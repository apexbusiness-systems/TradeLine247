import React, { useState } from 'react';
import { Database, Settings } from 'lucide-react';
import { SettingsSection, ProviderGrid, FormSelectRow, FormField } from '@/components/integrations/IntegrationCard';
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
      <ProviderGrid
        providers={crmProviders}
        isConnecting={isConnecting}
        onConnect={handleConnect}
      />

      <SettingsSection
        icon={Settings}
        title="Integration Settings"
        description="Configure how your AI receptionist interacts with your CRM"
        saveLabel="Save Configuration"
      >
        <FormSelectRow
          selects={[
            { id: 'sync-frequency', label: 'Sync Frequency', options: ['Real-time', 'Every 5 minutes', 'Every 15 minutes', 'Hourly'] },
          ]}
        >
          <FormField id="lead-source" label="Default Lead Source" placeholder="AI Receptionist" defaultValue="TradeLine 24/7 AI" />
        </FormSelectRow>

        <FormField
          id="webhook-url"
          label="Webhook URL (Optional)"
          placeholder="https://your-crm.com/webhook"
          type="url"
          description="Receive real-time notifications when leads are created or updated"
        />

      </SettingsSection>
    </IntegrationPageLayout>
  );
};

export default CRMIntegration;
