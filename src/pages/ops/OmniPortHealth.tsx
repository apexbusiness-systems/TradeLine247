import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client.ts';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Shield,
  Inbox,
  Phone,
  MessageSquare,
  Webhook,
  Gauge,
  Clock,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface OmniPortMetrics {
  totalRequests: number;
  successRate: string;
  p95Latency: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  dlqDepth: number;
  bySource: {
    text: number;
    voice: number;
    webhook: number;
    api: number;
    rcs: number;
    whatsapp: number;
  };
  byLane: {
    GREEN: number;
    YELLOW: number;
    RED: number;
    BLOCKED: number;
  };
  circuitStates: Record<string, string>;
  uptime: number;
  lastReset: string;
  timeRange?: {
    start: string;
    end: string;
    range: string;
  };
}

interface DLQEntry {
  id: string;
  status: string;
  attempts: number;
  error_message: string;
  created_at: string;
}

interface RecentEvent {
  id: string;
  source: string;
  risk_lane: string;
  risk_score: number;
  created_at: string;
}

interface DetailedMetrics extends OmniPortMetrics {
  dlqEntries?: DLQEntry[];
  recentEvents?: RecentEvent[];
}

export default function OmniPortHealth() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<DetailedMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('1h');

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('omniport-metrics', {
        body: null,
        headers: {},
      });

      // Workaround: invoke with GET method parameters
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/omniport-metrics?range=${timeRange}&format=detailed`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setMetrics(result.data || result);

      toast({
        title: 'Metrics Updated',
        description: 'OmniPort metrics refreshed successfully',
      });
    } catch (error: unknown) {
      console.error('Metrics fetch error:', error);
      toast({
        title: 'Metrics Fetch Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500 text-white">Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500 text-black">Degraded</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive">Unhealthy</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-8 w-8 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-8 w-8 text-red-500" />;
      default:
        return <Activity className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const getLaneColor = (lane: string): string => {
    switch (lane) {
      case 'GREEN':
        return 'bg-green-500';
      case 'YELLOW':
        return 'bg-yellow-500';
      case 'RED':
        return 'bg-red-500';
      case 'BLOCKED':
        return 'bg-gray-800';
      default:
        return 'bg-gray-300';
    }
  };

  const getCircuitBadge = (state: string) => {
    switch (state) {
      case 'CLOSED':
        return <Badge className="bg-green-500 text-white">CLOSED</Badge>;
      case 'OPEN':
        return <Badge variant="destructive">OPEN</Badge>;
      case 'HALF_OPEN':
        return <Badge className="bg-yellow-500 text-black">HALF_OPEN</Badge>;
      default:
        return <Badge variant="secondary">{state}</Badge>;
    }
  };

  const formatUptime = (ms: number): string => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const totalBySource = metrics
    ? Object.values(metrics.bySource).reduce((a, b) => a + b, 0)
    : 0;

  const totalByLane = metrics
    ? Object.values(metrics.byLane).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            OmniPort Health
          </h1>
          <p className="text-muted-foreground">
            Universal Ingress Engine - Zero-Trust Gate, Metrics & Observability
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex border rounded-lg overflow-hidden">
            {(['1h', '24h', '7d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm ${
                  timeRange === range
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <Button onClick={fetchMetrics} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {metrics && (
        <>
          {/* Health Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="col-span-1">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Health Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getHealthIcon(metrics.healthStatus)}
                      <span className="text-2xl font-bold capitalize">
                        {metrics.healthStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Requests</p>
                    <p className="text-2xl font-bold">
                      {metrics.totalRequests.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold text-green-600">
                      {metrics.successRate}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">P95 Latency</p>
                    <p className="text-2xl font-bold">{metrics.p95Latency}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Source Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5" />
                Ingress by Source
              </CardTitle>
              <CardDescription>
                Request distribution across input channels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <MessageSquare className="h-6 w-6 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Text</p>
                    <p className="text-xl font-bold">
                      {metrics.bySource.text.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <Phone className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Voice</p>
                    <p className="text-xl font-bold">
                      {metrics.bySource.voice.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <Webhook className="h-6 w-6 text-purple-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Webhook</p>
                    <p className="text-xl font-bold">
                      {metrics.bySource.webhook.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <Activity className="h-6 w-6 text-orange-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">API</p>
                    <p className="text-xl font-bold">
                      {metrics.bySource.api.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <MessageSquare className="h-6 w-6 text-teal-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">RCS</p>
                    <p className="text-xl font-bold">
                      {metrics.bySource.rcs.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">WhatsApp</p>
                    <p className="text-xl font-bold">
                      {metrics.bySource.whatsapp.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Source Distribution Bar */}
              {totalBySource > 0 && (
                <div className="mt-4">
                  <div className="h-4 rounded-full overflow-hidden flex">
                    <div
                      className="bg-blue-500 transition-all"
                      style={{
                        width: `${(metrics.bySource.text / totalBySource) * 100}%`,
                      }}
                      title={`Text: ${metrics.bySource.text}`}
                    />
                    <div
                      className="bg-green-500 transition-all"
                      style={{
                        width: `${(metrics.bySource.voice / totalBySource) * 100}%`,
                      }}
                      title={`Voice: ${metrics.bySource.voice}`}
                    />
                    <div
                      className="bg-purple-500 transition-all"
                      style={{
                        width: `${(metrics.bySource.webhook / totalBySource) * 100}%`,
                      }}
                      title={`Webhook: ${metrics.bySource.webhook}`}
                    />
                    <div
                      className="bg-orange-500 transition-all"
                      style={{
                        width: `${(metrics.bySource.api / totalBySource) * 100}%`,
                      }}
                      title={`API: ${metrics.bySource.api}`}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>Text {((metrics.bySource.text / totalBySource) * 100).toFixed(1)}%</span>
                    <span>Voice {((metrics.bySource.voice / totalBySource) * 100).toFixed(1)}%</span>
                    <span>Webhook {((metrics.bySource.webhook / totalBySource) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Classification */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Risk Classification Lanes
              </CardTitle>
              <CardDescription>
                Security assessment distribution (GREEN → BLOCKED)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-3xl font-bold text-green-600">
                    {metrics.byLane.GREEN.toLocaleString()}
                  </div>
                  <div className="text-sm text-green-700 mt-1">GREEN</div>
                  <div className="text-xs text-muted-foreground">Execute Immediately</div>
                </div>

                <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                  <div className="text-3xl font-bold text-yellow-600">
                    {metrics.byLane.YELLOW.toLocaleString()}
                  </div>
                  <div className="text-sm text-yellow-700 mt-1">YELLOW</div>
                  <div className="text-xs text-muted-foreground">Execute + Monitor</div>
                </div>

                <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-3xl font-bold text-red-600">
                    {metrics.byLane.RED.toLocaleString()}
                  </div>
                  <div className="text-sm text-red-700 mt-1">RED</div>
                  <div className="text-xs text-muted-foreground">Escalate to MAN Mode</div>
                </div>

                <div className="text-center p-4 rounded-lg bg-gray-100 border border-gray-300">
                  <div className="text-3xl font-bold text-gray-700">
                    {metrics.byLane.BLOCKED.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-800 mt-1">BLOCKED</div>
                  <div className="text-xs text-muted-foreground">Security Review</div>
                </div>
              </div>

              {/* Risk Distribution Bar */}
              {totalByLane > 0 && (
                <div className="mt-4">
                  <div className="h-6 rounded-full overflow-hidden flex">
                    <div
                      className="bg-green-500 transition-all flex items-center justify-center text-white text-xs font-medium"
                      style={{
                        width: `${(metrics.byLane.GREEN / totalByLane) * 100}%`,
                      }}
                    >
                      {((metrics.byLane.GREEN / totalByLane) * 100).toFixed(0)}%
                    </div>
                    <div
                      className="bg-yellow-500 transition-all flex items-center justify-center text-black text-xs font-medium"
                      style={{
                        width: `${(metrics.byLane.YELLOW / totalByLane) * 100}%`,
                      }}
                    >
                      {metrics.byLane.YELLOW > 0 &&
                        `${((metrics.byLane.YELLOW / totalByLane) * 100).toFixed(0)}%`}
                    </div>
                    <div
                      className="bg-red-500 transition-all flex items-center justify-center text-white text-xs font-medium"
                      style={{
                        width: `${(metrics.byLane.RED / totalByLane) * 100}%`,
                      }}
                    >
                      {metrics.byLane.RED > 0 &&
                        `${((metrics.byLane.RED / totalByLane) * 100).toFixed(0)}%`}
                    </div>
                    <div
                      className="bg-gray-800 transition-all flex items-center justify-center text-white text-xs font-medium"
                      style={{
                        width: `${(metrics.byLane.BLOCKED / totalByLane) * 100}%`,
                      }}
                    >
                      {metrics.byLane.BLOCKED > 0 &&
                        `${((metrics.byLane.BLOCKED / totalByLane) * 100).toFixed(0)}%`}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* DLQ Status */}
          <Card className={metrics.dlqDepth > 10 ? 'border-red-200 bg-red-50' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Dead Letter Queue (DLQ)
                {metrics.dlqDepth > 0 && (
                  <Badge variant={metrics.dlqDepth > 10 ? 'destructive' : 'secondary'}>
                    {metrics.dlqDepth} pending
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Failed events awaiting retry with exponential backoff
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.dlqDepth === 0 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span>DLQ is empty - all events delivered successfully</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-3xl font-bold text-red-600">{metrics.dlqDepth}</p>
                      <p className="text-sm text-muted-foreground">Events in queue</p>
                    </div>
                    {metrics.dlqDepth > 10 && (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-medium">
                          High DLQ depth may indicate downstream issues
                        </span>
                      </div>
                    )}
                  </div>

                  {/* DLQ Entries Table */}
                  {metrics.dlqEntries && metrics.dlqEntries.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left">Event ID</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Attempts</th>
                            <th className="px-3 py-2 text-left">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.dlqEntries.slice(0, 5).map((entry) => (
                            <tr key={entry.id} className="border-t">
                              <td className="px-3 py-2 font-mono text-xs">
                                {entry.id.substring(0, 16)}...
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="secondary">{entry.status}</Badge>
                              </td>
                              <td className="px-3 py-2">{entry.attempts}</td>
                              <td className="px-3 py-2 text-muted-foreground truncate max-w-xs">
                                {entry.error_message}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Circuit Breaker States */}
          {Object.keys(metrics.circuitStates).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Circuit Breaker States
                </CardTitle>
                <CardDescription>Handler health and availability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(metrics.circuitStates).map(([handler, state]) => (
                    <div
                      key={handler}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted"
                    >
                      <span className="font-medium">{handler}</span>
                      {getCircuitBadge(state)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Events */}
          {metrics.recentEvents && metrics.recentEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Events</CardTitle>
                <CardDescription>Latest processed ingress events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">Event ID</th>
                        <th className="px-3 py-2 text-left">Source</th>
                        <th className="px-3 py-2 text-left">Lane</th>
                        <th className="px-3 py-2 text-left">Risk Score</th>
                        <th className="px-3 py-2 text-left">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.recentEvents.map((event) => (
                        <tr key={event.id} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">
                            {event.id.substring(0, 16)}...
                          </td>
                          <td className="px-3 py-2">{event.source}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getLaneColor(
                                event.risk_lane
                              )}`}
                            >
                              {event.risk_lane}
                            </span>
                          </td>
                          <td className="px-3 py-2">{event.risk_score}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {new Date(event.created_at).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Uptime</p>
                  <p className="font-mono font-medium">{formatUptime(metrics.uptime)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Reset</p>
                  <p className="font-mono font-medium">
                    {new Date(metrics.lastReset).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time Range</p>
                  <p className="font-mono font-medium">{timeRange}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Health Status</p>
                  {getHealthBadge(metrics.healthStatus)}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Loading State */}
      {!metrics && loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Loading OmniPort metrics...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
