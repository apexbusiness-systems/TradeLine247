import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, ExternalLink, type LucideIcon } from 'lucide-react';

/** Shared inline style for premium glass-morphism cards used across integration pages. */
export const premiumCardStyle: React.CSSProperties = {
  boxShadow: 'var(--premium-shadow-subtle)',
  background: 'linear-gradient(135deg, hsl(var(--card) / 0.8) 0%, hsl(var(--card) / 0.6) 100%)',
  border: '1px solid hsl(var(--premium-border))',
};

const PREMIUM_CARD_CLASS =
  'relative overflow-hidden border-0 bg-card/60 backdrop-blur-sm group hover:shadow-[var(--premium-shadow-medium)] transition-all duration-300';

export interface IntegrationProvider {
  id: string;
  name: string;
  description: string;
  logo: string;
  status: 'available' | 'coming-soon';
  features: string[];
}

interface IntegrationCardProps {
  provider: IntegrationProvider;
  /** Optional extra content rendered between features and the action button. */
  children?: React.ReactNode;
  /** Content rendered in the card footer (buttons, etc.) */
  footer: React.ReactNode;
  /** Extra badge shown next to the provider name (e.g. platform badge). */
  extraBadge?: React.ReactNode;
  /** When true the card is dimmed (used for coming-soon items). */
  dimmed?: boolean;
}

export function IntegrationCard({ provider, children, footer, extraBadge, dimmed }: IntegrationCardProps) {
  return (
    <Card
      className={`${PREMIUM_CARD_CLASS}${dimmed ? ' opacity-75' : ''}`}
      style={premiumCardStyle}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      <CardHeader className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{provider.logo}</div>
            <div>
              <CardTitle className="text-lg font-bold">{provider.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{provider.description}</p>
              {extraBadge}
            </div>
          </div>
          <StatusBadge status={provider.status} />
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-4">
        <FeatureList features={provider.features} />
        {children}
        <div className="pt-4 border-t border-muted/20">{footer}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: 'available' | 'coming-soon' }) {
  return (
    <Badge
      className={
        status === 'available'
          ? 'bg-[hsl(142,85%,95%)] text-[hsl(142,85%,25%)] border-[hsl(142,85%,70%)]'
          : 'bg-gray-500/10 text-gray-600 border-gray-500/20'
      }
    >
      {status === 'available' ? 'Available' : 'Coming Soon'}
    </Badge>
  );
}

export function FeatureList({ features, columns = 1 }: { features: string[]; columns?: 1 | 2 }) {
  return (
    <div>
      <h3 className="font-semibold text-sm mb-2">Features:</h3>
      <div className={columns === 2 ? 'grid grid-cols-2 gap-1' : 'space-y-1'}>
        {features.map((feature) => (
          <div key={feature} className="flex items-center gap-2 text-xs">
            <CheckCircle className="h-3 w-3 text-[hsl(142,85%,25%)]" />
            <span className="text-muted-foreground">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Premium glass-morphism settings section used across integration pages.
 * Wraps Card + gradient overlay + CardHeader + CardContent boilerplate.
 */
interface SettingsSectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  /** Extra className on CardContent (e.g. "space-y-6" vs "space-y-4") */
  contentClassName?: string;
  /** Extra className on outermost Card */
  className?: string;
}

export function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  contentClassName = 'space-y-6',
  className = '',
}: SettingsSectionProps) {
  return (
    <Card
      className={`relative overflow-hidden border-0 bg-card/60 backdrop-blur-sm ${className}`}
      style={premiumCardStyle}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <CardHeader className="relative z-10">
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className={`relative z-10 ${contentClassName}`}>{children}</CardContent>
    </Card>
  );
}

/**
 * Standardised connect button used by most integration pages.
 */
interface ConnectButtonProps {
  providerName: string;
  isConnecting: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** Label shown when status is coming-soon */
  comingSoon?: boolean;
  /** Override the button icon (defaults to ExternalLink) */
  icon?: LucideIcon;
  /** Override the verb (defaults to "Connect") */
  verb?: string;
  /** Override the loading label (defaults to "Connecting...") */
  loadingLabel?: string;
  className?: string;
}

export function ConnectButton({
  providerName,
  isConnecting,
  onClick,
  disabled,
  comingSoon,
  icon: BtnIcon = ExternalLink,
  verb = 'Connect',
  loadingLabel = 'Connecting...',
  className = 'w-full',
}: ConnectButtonProps) {
  return (
    <Button
      className={className}
      onClick={onClick}
      disabled={disabled ?? (isConnecting || comingSoon)}
    >
      {comingSoon ? 'Coming Soon' : isConnecting ? loadingLabel : (
        <>
          <BtnIcon className="h-4 w-4 mr-2" />
          {verb} {providerName}
        </>
      )}
    </Button>
  );
}
