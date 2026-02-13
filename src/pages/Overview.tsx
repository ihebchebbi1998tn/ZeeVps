import { useEffect, useState, useCallback } from "react";
import { getSystemInfo, getServices, formatBytes, formatPercent, type SystemInfo, type ServiceInfo } from "@/lib/ssh-api";
import { AlertCircle, Loader2, Cpu, HardDrive, MemoryStick, Clock, Server, RefreshCw } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface HistoryPoint {
  time: string;
  cpu: number;
  mem: number;
  disk: number;
}

export default function Overview() {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [sys, svc] = await Promise.all([getSystemInfo(), getServices()]);
      setSysInfo(sys);
      setServices(svc.services.filter(s => s.name && !s.name.startsWith("●")));

      const now = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const memPct = sys.memTotal > 0 ? Math.round((sys.memUsed / sys.memTotal) * 100) : 0;
      const diskPct = sys.diskTotal > 0 ? Math.round((sys.diskUsed / sys.diskTotal) * 100) : 0;
      setHistory(prev => [...prev.slice(-29), { time: now, cpu: sys.cpuPercent || parseFloat(sys.loadAvg.split(" ")[0]) / sys.cpuCores * 100, mem: memPct, disk: diskPct }]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Connecting to server...</span>
      </div>
    );
  }

  if (error && !sysInfo) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <div>
          <p className="text-sm font-medium text-destructive">Connection Error</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
        <button onClick={fetchData} className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-border/60 hover:bg-secondary/60 transition-colors">Retry</button>
      </div>
    );
  }

  if (!sysInfo) return null;

  const memPct = sysInfo.memTotal > 0 ? Math.round((sysInfo.memUsed / sysInfo.memTotal) * 100) : 0;
  const diskPct = sysInfo.diskTotal > 0 ? Math.round((sysInfo.diskUsed / sysInfo.diskTotal) * 100) : 0;
  const cpuPct = Math.round(sysInfo.cpuPercent || (parseFloat(sysInfo.loadAvg.split(" ")[0]) / sysInfo.cpuCores) * 100);
  const runningServices = services.filter(s => s.sub === "running");
  const failedServices = services.filter(s => s.active === "failed");

  const StatCard = ({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color?: string }) => (
    <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 flex items-start gap-3 hover:bg-card/90 transition-colors shadow-sm">
      <div className="p-2 rounded-lg bg-secondary/60">
        <Icon className={`h-4 w-4 ${color || "text-primary"}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
        <p className="text-lg font-semibold text-foreground font-mono leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  const GaugeChart = ({ value, label, color }: { value: number; label: string; color: string }) => (
    <div className="flex flex-col items-center">
      <div className="w-20 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[{ value }, { value: 100 - value }]}
              cx="50%"
              cy="50%"
              innerRadius={25}
              outerRadius={35}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="hsl(var(--muted))" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <span className="text-lg font-mono font-bold text-foreground -mt-2">{value}%</span>
      <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-success/10 border border-success/20">
            <Server className="h-5 w-5 text-success" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">{sysInfo.hostname}</h1>
            <p className="text-xs font-mono text-muted-foreground/60">{sysInfo.os} — {sysInfo.kernel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-success">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" /> Online
          </span>
          <button onClick={fetchData} className="text-xs px-3 py-1.5 rounded-lg border border-border/60 hover:bg-secondary/60 text-muted-foreground flex items-center gap-1.5 transition-colors">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Cpu} label="CPU" value={`${cpuPct}%`} sub={`${sysInfo.cpuCores} cores • Load: ${sysInfo.loadAvg.split(" ")[0]}`} />
        <StatCard icon={MemoryStick} label="Memory" value={formatBytes(sysInfo.memUsed)} sub={`of ${formatBytes(sysInfo.memTotal)} (${memPct}%)`} color={memPct > 80 ? "text-destructive" : "text-success"} />
        <StatCard icon={HardDrive} label="Disk" value={formatBytes(sysInfo.diskUsed)} sub={`of ${formatBytes(sysInfo.diskTotal)} (${diskPct}%)`} color={diskPct > 80 ? "text-warning" : "text-success"} />
        <StatCard icon={Clock} label="Uptime" value={sysInfo.uptime.replace("up ", "")} sub={`↓${formatBytes(sysInfo.netRx)} ↑${formatBytes(sysInfo.netTx)}`} />
      </div>

      {/* Gauges + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 flex items-center justify-around shadow-sm">
          <GaugeChart value={cpuPct} label="CPU" color="hsl(var(--primary))" />
          <GaugeChart value={memPct} label="RAM" color={memPct > 80 ? "hsl(var(--destructive))" : "hsl(var(--success))"} />
          <GaugeChart value={diskPct} label="Disk" color={diskPct > 80 ? "hsl(var(--warning))" : "hsl(var(--success))"} />
        </div>

        <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 lg:col-span-2 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Resource History</span>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> CPU</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> RAM</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> Disk</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 11,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
              />
              <Area type="monotone" dataKey="cpu" stroke="hsl(var(--primary))" fill="url(#cpuGrad)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="mem" stroke="hsl(var(--success))" fill="url(#memGrad)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="disk" stroke="hsl(var(--warning))" fill="none" strokeWidth={1} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Services summary */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Services — {runningServices.length} running
            {failedServices.length > 0 && <span className="text-destructive ml-1">• {failedServices.length} failed</span>}
          </h2>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm overflow-hidden max-h-72 overflow-y-auto terminal-scrollbar shadow-sm">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-secondary/50 border-b border-border/40">
                <th className="px-3 py-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase w-8">●</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase text-left">Service</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase text-left">State</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase text-left">Sub</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase text-left">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {services.slice(0, 25).map((svc, i) => (
                <tr key={i} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${
                      svc.sub === "running" ? "bg-success" :
                      svc.active === "active" ? "bg-primary" :
                      svc.active === "failed" ? "bg-destructive" :
                      "bg-muted-foreground/40"
                    }`} />
                  </td>
                  <td className="px-3 py-2 font-mono text-foreground">{svc.name}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{svc.active}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{svc.sub}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-xs">{svc.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
