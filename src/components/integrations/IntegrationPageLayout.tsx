import React from 'react';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { paths } from '@/routes/paths';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

interface IntegrationPageLayoutProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconGradient: string;
  iconColor: string;
  children: React.ReactNode;
}

export function IntegrationPageLayout({
  title,
  description,
  icon: Icon,
  iconGradient,
  iconColor,
  children,
}: IntegrationPageLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 container py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(paths.dashboard)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${iconGradient}`}>
              <Icon className={`h-6 w-6 ${iconColor}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>

        {children}
      </div>

      <Footer />
    </div>
  );
}
