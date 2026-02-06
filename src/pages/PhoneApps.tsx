import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, MessageSquare, Mail, User, Calendar, MapPin, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const phoneApps = [
  {
    id: 'dialer',
    title: 'Phone Dialer',
    description: 'Make calls directly from your device',
    icon: Phone,
    action: (number: string) => `tel:${number}`,
    defaultNumber: '+14319900222',
    color: 'text-success'
  },
  {
    id: 'sms',
    title: 'Messages',
    description: 'Send text messages',
    icon: MessageSquare,
    action: (number: string) => `sms:${number}`,
    defaultNumber: '+14319900222',
    color: 'text-info'
  },
  {
    id: 'email',
    title: 'Email',
    description: 'Compose an email',
    icon: Mail,
    action: (email: string) => `mailto:${email}`,
    defaultNumber: 'support@tradeline247.ai',
    color: 'text-neutral'
  },
  {
    id: 'contacts',
    title: 'Contacts',
    description: 'Download contact card',
    icon: User,
    action: () => '/api/vcard/download',
    color: 'text-brand-primary'
  },
  {
    id: 'calendar',
    title: 'Calendar',
    description: 'Add to calendar',
    icon: Calendar,
    action: () => '/api/calendar/event',
    color: 'text-info'
  },
  {
    id: 'maps',
    title: 'Maps',
    description: 'Get directions',
    icon: MapPin,
    action: (coords: string) => `geo:${coords}`,
    defaultNumber: '51.0447,-114.0719', // Calgary coordinates
    color: 'text-error'
  }
];

export default function PhoneApps() {
  const { toast } = useToast();

  const downloadVCard = () => {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:TradeLine 24/7',
      'ORG:TradeLine 24/7 AI',
      'TEL;TYPE=WORK,VOICE:+14319900222',
      'EMAIL:support@tradeline247.ai',
      'URL:https://tradeline247ai.com',
      'END:VCARD',
    ].join('\n');
    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'TradeLine247.vcf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const addCalendarEvent = () => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 30, 0, 0);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('TradeLine 24/7 Follow-up')}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent('Follow-up call with TradeLine 24/7 AI')}`;
    window.open(gcalUrl, '_blank');
  };

  const handleAppAction = (app: typeof phoneApps[0]) => {
    try {
      if (app.id === 'contacts') {
        downloadVCard();
        toast({ title: 'Contact Saved', description: 'TradeLine 24/7 contact card downloaded' });
        return;
      }

      if (app.id === 'calendar') {
        addCalendarEvent();
        toast({ title: 'Calendar', description: 'Opening calendar to create event...' });
        return;
      }

      const url = app.action(app.defaultNumber || '');
      window.location.href = url;

      toast({
        title: `Opening ${app.title}`,
        description: `Launching ${app.title} app...`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to open ${app.title}`,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container max-w-6xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Phone Apps</h1>
          <p className="text-muted-foreground mt-2">
            Quick access to native phone apps and integrations
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {phoneApps.map((app) => {
            const Icon = app.icon;
            return (
              <Card
                key={app.id}
                className="group cursor-pointer hover:shadow-lg transition-all duration-300"
                onClick={() => handleAppAction(app)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className={`p-3 bg-muted rounded-lg w-fit group-hover:scale-110 transition-transform ${app.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <CardTitle className="text-lg">{app.title}</CardTitle>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardDescription>{app.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {app.defaultNumber && (
                    <p className="text-sm text-muted-foreground font-mono">
                      {app.defaultNumber}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">About Phone Apps</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              These integrations use native device protocols to launch your phone's built-in apps.
              They work best on mobile devices and tablets.
            </p>
            <p>
              For desktop users, apps like Email and Maps will open in your default applications.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
