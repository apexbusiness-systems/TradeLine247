import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client.ts";
import { paths } from "@/routes/paths";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle, Clock, Phone } from "lucide-react";

interface VoiceStreamLog {
  call_sid: string;
  started_at: string;
  connected_at: string | null;
  elapsed_ms: number | null;
  fell_back: boolean;
  error_message: string | null;
  created_at: string;
}

interface VoiceMetrics {
  avgLatency: number;
  errorRate: number;
  callsPerHour: number;
  p50Latency: number;
  p99Latency: number;
  timeoutCount: number;
}

const getStatusVariant = (errorRate: number) => {
  if (errorRate < 0.05) return "default";
  if (errorRate < 0.1) return "secondary";
  return "destructive";
};

export default function VoiceMonitoring() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<VoiceStreamLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(paths.auth);
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (authLoading || !user || !isAdmin()) return;

    let mounted = true;
    let intervalId: number | undefined;

    const fetchLogs = async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("voice_stream_logs")
        .select("*")
        .gte("created_at", oneHourAgo)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!mounted) return;

      if (error) {
        setLoadError(error.message);
        setLogs([]);
      } else {
        setLoadError(null);
        setLogs((data || []) as VoiceStreamLog[]);
      }
      setLoading(false);
    };

    fetchLogs();
    intervalId = window.setInterval(fetchLogs, 5000);

    return () => {
      mounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [authLoading, user, isAdmin]);

  const metrics = useMemo<VoiceMetrics>(() => {
    if (!logs.length) {
      return {
        avgLatency: 0,
        errorRate: 0,
        callsPerHour: 0,
        p50Latency: 0,
        p99Latency: 0,
        timeoutCount: 0,
      };
    }

    const latencies = logs
      .map((log) => log.elapsed_ms)
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => a - b);

    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
      : 0;
    const p50Latency = latencies.length
      ? latencies[Math.floor((latencies.length - 1) * 0.5)] ?? 0
      : 0;
    const p99Latency = latencies.length
      ? latencies[Math.floor((latencies.length - 1) * 0.99)] ?? 0
      : 0;
    const errorCount = logs.filter((log) => log.error_message || log.fell_back).length;
    const timeoutCount = logs.filter((log) =>
      (log.error_message || "").toLowerCase().includes("timeout")
    ).length;

    return {
      avgLatency,
      errorRate: logs.length ? errorCount / logs.length : 0,
      callsPerHour: logs.length,
      p50Latency,
      p99Latency,
      timeoutCount,
    };
  }, [logs]);

  if (authLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin()) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Access denied. Voice monitoring is available to administrators only.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse text-muted-foreground">Loading voice metrics...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Voice Stream Health Monitor</h1>
          <p className="text-muted-foreground">Real-time metrics from the last 60 minutes</p>
        </div>
        <Badge variant={getStatusVariant(metrics.errorRate)} className="w-fit text-sm px-4 py-2">
          {metrics.errorRate < 0.05 ? "HEALTHY" : metrics.errorRate < 0.1 ? "DEGRADED" : "UNHEALTHY"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          title="Avg Latency"
          value={`${metrics.avgLatency}ms`}
          icon={<Clock className="h-4 w-4" />}
          status={metrics.avgLatency < 200 ? "healthy" : metrics.avgLatency < 500 ? "warning" : "critical"}
          target="< 200ms"
        />
        <MetricCard
          title="P50 Latency"
          value={`${metrics.p50Latency}ms`}
          icon={<Clock className="h-4 w-4" />}
          status={metrics.p50Latency < 100 ? "healthy" : metrics.p50Latency < 200 ? "warning" : "critical"}
          target="< 100ms"
        />
        <MetricCard
          title="P99 Latency"
          value={`${metrics.p99Latency}ms`}
          icon={<Clock className="h-4 w-4" />}
          status={metrics.p99Latency < 500 ? "healthy" : metrics.p99Latency < 1000 ? "warning" : "critical"}
          target="< 500ms"
        />
        <MetricCard
          title="Error Rate"
          value={`${(metrics.errorRate * 100).toFixed(1)}%`}
          icon={metrics.errorRate < 0.05 ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          status={metrics.errorRate < 0.05 ? "healthy" : metrics.errorRate < 0.1 ? "warning" : "critical"}
          target="< 5%"
        />
        <MetricCard
          title="Calls/Hour"
          value={metrics.callsPerHour.toString()}
          icon={<Phone className="h-4 w-4" />}
          status="healthy"
        />
      </div>

      {metrics.timeoutCount > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {metrics.timeoutCount} timeout(s) detected in the last hour. Investigate OpenAI and network performance.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Live Log Stream</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-black text-green-400 p-4 font-mono text-sm max-h-96 overflow-y-auto space-y-1">
            {logs.length ? (
              logs.map((log) => (
                <div
                  key={log.call_sid}
                  className={`px-2 py-1 rounded hover:bg-gray-900 ${
                    log.error_message || log.fell_back ? "text-red-400" : "text-green-400"
                  }`}
                >
                  <span className="text-gray-500">
                    [{new Date(log.created_at).toLocaleTimeString()}]
                  </span>{" "}
                  <span className="text-blue-400">{log.call_sid.slice(-8)}</span>{" "}
                  <span className={log.elapsed_ms && log.elapsed_ms > 200 ? "text-yellow-400" : ""}>
                    {log.elapsed_ms ?? "—"}ms
                  </span>
                  {log.fell_back && <span className="ml-2 text-orange-400">FALLBACK</span>}
                  {log.error_message && <span className="ml-2 text-red-400">ERROR: {log.error_message}</span>}
                </div>
              ))
            ) : (
              <div className="text-gray-500">No recent calls in the last hour.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  status: "healthy" | "warning" | "critical";
  target?: string;
}

const MetricCard = ({ title, value, icon, status, target }: MetricCardProps) => {
  const statusClasses = {
    healthy: "border-green-500 bg-green-50",
    warning: "border-yellow-500 bg-yellow-50",
    critical: "border-red-500 bg-red-50",
  };

  return (
    <Card className={`${statusClasses[status]} border-2`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {target && <p className="text-xs text-muted-foreground mt-1">Target: {target}</p>}
      </CardContent>
    </Card>
  );
};
