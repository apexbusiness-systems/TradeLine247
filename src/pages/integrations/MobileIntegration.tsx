import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Download, Settings, ExternalLink, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { premiumCardStyle, SettingsSection } from '@/components/integrations/IntegrationCard';
import { IntegrationPageLayout } from '@/components/integrations/IntegrationPageLayout';

const mobileFeatures = [
  { id: 'push-notifications', title: 'Push Notifications', description: 'Instant alerts for new calls and messages', icon: '🔔', platforms: ['iOS', 'Android'] },
  { id: 'call-forwarding', title: 'Call Forwarding', description: 'Forward calls directly to your mobile device', icon: '📞', platforms: ['iOS', 'Android'] },
  { id: 'voice-commands', title: 'Voice Commands', description: 'Control your AI receptionist with voice', icon: '🎤', platforms: ['iOS', 'Android'] },
  { id: 'quick-responses', title: 'Quick Responses', description: 'Pre-configured responses for common scenarios', icon: '⚡', platforms: ['iOS', 'Android'] },
  { id: 'analytics-mobile', title: 'Mobile Analytics', description: 'View performance metrics on the go', icon: '📊', platforms: ['iOS', 'Android'] },
  { id: 'offline-mode', title: 'Offline Mode', description: 'Access cached data without internet', icon: '📱', platforms: ['iOS', 'Android'] },
];

const appStores = [
  { platform: 'iOS', name: 'App Store', url: 'https://apps.apple.com/app/tradeline247', icon: '🍎', version: '2.1.0', rating: '4.8', downloads: '10K+' },
  { platform: 'Android', name: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.tradeline247', icon: '🤖', version: '2.1.0', rating: '4.7', downloads: '25K+' },
];

const MobileIntegration = () => {
  const [showQRCode, setShowQRCode] = useState(false);

  const handleDownload = (store: (typeof appStores)[number]) => {
    toast.success(`Redirecting to ${store.name}...`);
    window.open(store.url, '_blank');
  };

  return (
    <IntegrationPageLayout
      title="Mobile App Integration"
      description="Native iOS and Android apps for TradeLine 24/7"
      icon={Smartphone}
      iconGradient="from-indigo-500/10 to-indigo-500/5"
      iconColor="text-info"
    >
      {/* App Download Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {appStores.map((store) => (
          <Card
            key={store.platform}
            className="relative overflow-hidden border-0 bg-card/60 backdrop-blur-sm group hover:shadow-[var(--premium-shadow-medium)] transition-all duration-300"
            style={premiumCardStyle}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

            <CardHeader className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{store.icon}</div>
                  <div>
                    <CardTitle className="text-xl font-bold">{store.platform} App</CardTitle>
                    <p className="text-sm text-muted-foreground">Download from {store.name}</p>
                  </div>
                </div>
                <Badge className="bg-[hsl(142,85%,95%)] text-[hsl(142,85%,25%)] border-[hsl(142,85%,70%)]">Available</Badge>
              </div>
            </CardHeader>

            <CardContent className="relative z-10 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-foreground">{store.version}</div>
                  <div className="text-xs text-muted-foreground">Version</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground">{store.rating}</div>
                  <div className="text-xs text-muted-foreground">Rating</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground">{store.downloads}</div>
                  <div className="text-xs text-muted-foreground">Downloads</div>
                </div>
              </div>

              <div className="space-y-2">
                <Button className="w-full" onClick={() => handleDownload(store)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download for {store.platform}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => { setShowQRCode(true); toast.success('QR Code generated! Scan with your mobile device.'); }}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Show QR Code
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* QR Code Display */}
      {showQRCode && (
        <Card className="relative overflow-hidden border-0 bg-card/60 backdrop-blur-sm text-center" style={premiumCardStyle}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <CardContent className="relative z-10 py-8">
            <div className="inline-block p-8 bg-white rounded-2xl shadow-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent('https://tradeline247ai.com/download')}`}
                alt="Download TradeLine 24/7 app"
                width={192}
                height={192}
                className="rounded-lg"
              />
            </div>
            <p className="mt-4 text-muted-foreground">
              Scan this QR code with your mobile device to download the app
            </p>
          </CardContent>
        </Card>
      )}

      {/* Mobile Features */}
      <SettingsSection
        icon={Settings}
        title="Mobile App Features"
        description="Powerful features available in our native mobile apps"
        contentClassName=""
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mobileFeatures.map((feature, index) => (
            <div
              key={feature.id}
              className="p-4 rounded-2xl bg-gradient-to-r from-muted/10 to-muted/5 border border-transparent hover:border-primary/20 transition-all duration-300 hover:shadow-[var(--premium-shadow-subtle)] animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{feature.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{feature.description}</p>
                  <div className="flex gap-2">
                    {feature.platforms.map((platform) => (
                      <Badge key={platform} className="bg-blue-500/10 text-info border-info text-xs">
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Setup Instructions */}
      <SettingsSection
        icon={ExternalLink}
        title="Getting Started"
        description="Follow these steps to set up the mobile app"
        contentClassName="space-y-4"
      >
        <div className="space-y-3">
          {[
            { step: 1, title: 'Download the App', desc: "Get the TradeLine 24/7 app from your device's app store" },
            { step: 2, title: 'Sign In', desc: 'Use your TradeLine 24/7 account credentials to sign in' },
            { step: 3, title: 'Enable Notifications', desc: 'Allow push notifications to stay updated on calls and messages' },
            { step: 4, title: 'Configure Settings', desc: 'Customize your preferences and sync with your dashboard settings' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                {step}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>
    </IntegrationPageLayout>
  );
};

export default MobileIntegration;
