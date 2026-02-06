import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Phone, Smartphone, MessageSquare, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FeatureList, ProviderGrid, premiumCardStyle } from '@/components/integrations/IntegrationCard';
import { IntegrationPageLayout } from '@/components/integrations/IntegrationPageLayout';
import { useIntegrationConnect } from '@/components/integrations/useIntegrationConnect';
import type { IntegrationProvider } from '@/components/integrations/IntegrationCard';

interface PhoneProvider extends IntegrationProvider {
  platform: string;
  color: string;
}

const phoneIntegrations: PhoneProvider[] = [
  {
    id: 'ios-phone',
    name: 'iOS Phone App',
    description: 'Native iPhone calling integration',
    logo: '📱',
    status: 'available',
    platform: 'iOS',
    features: ['Call forwarding', 'Voicemail transcription', 'Contact sync', 'Call history'],
    color: 'bg-blue-500/10 text-info border-info',
  },
  {
    id: 'android-phone',
    name: 'Android Phone',
    description: 'Native Android calling integration',
    logo: '🤖',
    status: 'available',
    platform: 'Android',
    features: ['Call screening', 'Smart replies', 'Contact integration', 'Call recording'],
    color: 'bg-[hsl(142,85%,95%)] text-[hsl(142,85%,25%)] border-[hsl(142,85%,70%)]',
  },
  {
    id: 'imessage',
    name: 'iMessage',
    description: "Apple's messaging service",
    logo: '💙',
    status: 'available',
    platform: 'iOS',
    features: ['Auto-reply', 'Business chat', 'Rich messages', 'Read receipts'],
    color: 'bg-blue-500/10 text-info border-info',
  },
  {
    id: 'android-messages',
    name: 'Android Messages',
    description: "Google's messaging app",
    logo: '💬',
    status: 'available',
    platform: 'Android',
    features: ['RCS support', 'Smart compose', 'Spam detection', 'Web sync'],
    color: 'bg-[hsl(142,85%,95%)] text-[hsl(142,85%,25%)] border-[hsl(142,85%,70%)]',
  },
];

const smsProviders = [
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'Cloud communications platform',
    features: ['Global SMS', 'Voice calls', 'WhatsApp API', 'Programmable messaging'],
  },
  {
    id: 'vonage',
    name: 'Vonage',
    description: 'Business communications API',
    features: ['SMS API', 'Voice API', 'Verify API', 'Number insight'],
  },
];

const PhoneIntegration = () => {
  const { isConnecting, connect } = useIntegrationConnect();
  const [providerConnecting, setProviderConnecting] = useState(false);
  const [twilioCredentials, setTwilioCredentials] = useState({
    accountSid: '',
    authToken: '',
    phoneNumber: '',
  });

  const handleProviderSetup = async (provider: (typeof smsProviders)[number]) => {
    if (provider.id === 'twilio' && (!twilioCredentials.accountSid || !twilioCredentials.authToken)) {
      toast.error('Please fill in your Twilio credentials');
      return;
    }

    setProviderConnecting(true);
    try {
      if (!supabase) throw new Error('Service unavailable');

      const { data, error } = await supabase.functions.invoke('integration-connect', {
        body: {
          provider: provider.id,
          category: 'sms-provider',
          credentials:
            provider.id === 'twilio'
              ? {
                  accountSid: twilioCredentials.accountSid,
                  authToken: twilioCredentials.authToken,
                  phoneNumber: twilioCredentials.phoneNumber,
                }
              : undefined,
        },
      });

      if (error) throw error;
      toast.success(data?.message ?? `Successfully configured ${provider.name}!`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to configure ${provider.name}: ${msg}`);
    } finally {
      setProviderConnecting(false);
    }
  };

  return (
    <IntegrationPageLayout
      title="Phone & SMS Integration"
      description="Connect to native phone and messaging apps"
      icon={Phone}
      iconGradient="from-purple-500/10 to-purple-500/5"
      iconColor="text-neutral"
    >
      {/* Native Phone Integrations */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Native Mobile Integrations
        </h2>

        <ProviderGrid
          providers={phoneIntegrations}
          isConnecting={isConnecting}
          onConnect={(integration) =>
            connect(integration.name, { provider: integration.id, category: 'phone', platform: integration.platform })
          }
          connectVerb="Configure"
          connectIcon={Settings}
          connectLoadingLabel="Setting up..."
          renderExtraBadge={(p) => <Badge className={`mt-2 ${p.color}`}>{p.platform}</Badge>}
        />
      </div>

      {/* SMS Provider Configuration */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          SMS Providers
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          {smsProviders.map((provider) => (
            <Card
              key={provider.id}
              className="relative overflow-hidden border-0 bg-card/60 backdrop-blur-sm"
              style={premiumCardStyle}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

              <CardHeader className="relative z-10">
                <CardTitle className="text-lg font-bold">{provider.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{provider.description}</p>
              </CardHeader>

              <CardContent className="relative z-10 space-y-4">
                <FeatureList features={provider.features} columns={2} />

                {provider.id === 'twilio' && (
                  <div className="space-y-3 pt-4 border-t border-muted/20">
                    <div className="space-y-2">
                      <Label htmlFor="account-sid">Account SID</Label>
                      <Input
                        id="account-sid"
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={twilioCredentials.accountSid}
                        onChange={(e) => setTwilioCredentials((prev) => ({ ...prev, accountSid: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="auth-token">Auth Token</Label>
                      <Input
                        id="auth-token"
                        type="password"
                        placeholder="Your Twilio Auth Token"
                        value={twilioCredentials.authToken}
                        onChange={(e) => setTwilioCredentials((prev) => ({ ...prev, authToken: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone-number">Twilio Phone Number</Label>
                      <Input
                        id="phone-number"
                        placeholder="+1234567890"
                        value={twilioCredentials.phoneNumber}
                        onChange={(e) => setTwilioCredentials((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-muted/20">
                  <Button className="w-full" onClick={() => handleProviderSetup(provider)} disabled={providerConnecting}>
                    {providerConnecting ? 'Configuring...' : `Configure ${provider.name}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </IntegrationPageLayout>
  );
};

export default PhoneIntegration;
