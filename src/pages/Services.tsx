import { useEffect, useState } from "react";
import { getServices, executeCommand, type ServiceInfo } from "@/lib/ssh-api";
import {
  Loader2, AlertCircle, Play, Square, RotateCcw, RefreshCw,
  Server, Shield, Wifi, Database, HardDrive, Cog, Monitor,
  CheckCircle2, XCircle, MinusCircle, Search
} from "lucide-react";
import { toast } from "sonner";

function getServiceIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("nginx") || n.includes("apache") || n.includes("http")) return <Wifi className="h-4 w-4" />;
  if (n.includes("ssh") || n.includes("firewall") || n.includes("ufw") || n.includes("fail2ban")) return <Shield className="h-4 w-4" />;
  if (n.includes("mysql") || n.includes("postgres") || n.includes("mongo") || n.includes("redis") || n.includes("mariadb")) return <Database className="h-4 w-4" />;
  if (n.includes("docker") || n.includes("containerd")) return <HardDrive className="h-4 w-4" />;
  if (n.includes("systemd") || n.includes("cron") || n.includes("timer")) return <Cog className="h-4 w-4" />;
  if (n.includes("backend") || n.includes("dotnet") || n.includes("node") || n.includes("pm2")) return <Monitor className="h-4 w-4" />;
  return <Server className="h-4 w-4" />;
}

function getStatusIcon(svc: ServiceInfo) {
  if (svc.sub === "running") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (svc.active === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  if (svc.active === "active") return <CheckCircle2 className="h-4 w-4 text-primary" />;
  return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
}

export default function Services() {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "running" | "active" | "failed">("all");
  const [search, setSearch] = useState("");

  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getServices();
      setServices(data.services.filter(s => s.name && !s.name.startsWith("●")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServices(); }, []);

  const serviceAction = async (name: string, action: "start" | "stop" | "restart") => {
    setActionLoading(`${name}-${action}`);
    try {
      await executeCommand(`systemctl ${action} ${name} 2>&1`);
      toast.success(`Service ${name} ${action}ed`);
      await fetchServices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = services.filter(s => {
    if (filter === "running") return s.sub === "running";
    if (filter === "active") return s.active === "active";
    if (filter === "failed") return s.active === "failed";
    return true;
  }).filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()));

  const stats = {
    running: services.filter(s => s.sub === "running").length,
    active: services.filter(s => s.active === "active").length,
    failed: services.filter(s => s.active === "failed").length,
    total: services.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading services...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Services Manager</h1>
            <p className="text-xs text-muted-foreground">Manage systemd services on your server</p>
          </div>
        </div>
        <button onClick={fetchServices} className="flex items-center gap-1.5 text-xs px-3 py-2 border border-border rounded-md hover:bg-secondary text-muted-foreground transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Running", value: stats.running, color: "text-success", bg: "bg-success/10", icon: <CheckCircle2 className="h-4 w-4" /> },
          { label: "Active", value: stats.active, color: "text-primary", bg: "bg-primary/10", icon: <CheckCircle2 className="h-4 w-4" /> },
          { label: "Failed", value: stats.failed, color: "text-destructive", bg: "bg-destructive/10", icon: <XCircle className="h-4 w-4" /> },
          { label: "Total", value: stats.total, color: "text-foreground", bg: "bg-secondary", icon: <Server className="h-4 w-4" /> },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.bg} ${s.color}`}>{s.icon}</div>
            <div>
              <div className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex items-center gap-3">
        <div className="flex border border-border rounded-lg overflow-hidden text-xs">
          {(["all", "running", "active", "failed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 capitalize transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1 flex items-center gap-2 border border-border rounded-lg px-3 py-1.5 bg-card">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search services..."
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-destructive">{error}</span>
        </div>
      )}

      {/* Service cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {filtered.map((svc, i) => (
          <div
            key={i}
            className={`bg-card border rounded-lg p-3 flex items-start gap-3 transition-all hover:shadow-md ${
              svc.sub === "running" ? "border-success/30" :
              svc.active === "failed" ? "border-destructive/30" :
              "border-border"
            }`}
          >
            <div className={`p-2 rounded-lg flex-shrink-0 ${
              svc.sub === "running" ? "bg-success/10 text-success" :
              svc.active === "failed" ? "bg-destructive/10 text-destructive" :
              "bg-secondary text-muted-foreground"
            }`}>
              {getServiceIcon(svc.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-foreground truncate">{svc.name}</span>
                {getStatusIcon(svc)}
              </div>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={svc.description}>{svc.description || "No description"}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  svc.sub === "running" ? "bg-success/10 text-success" :
                  svc.active === "failed" ? "bg-destructive/10 text-destructive" :
                  svc.active === "active" ? "bg-primary/10 text-primary" :
                  "bg-secondary text-muted-foreground"
                }`}>{svc.sub || svc.active}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0">
              {svc.sub !== "running" ? (
                <button
                  onClick={() => serviceAction(svc.name, "start")}
                  disabled={!!actionLoading}
                  className="p-1.5 text-success hover:bg-success/10 rounded-md disabled:opacity-50 transition-colors"
                  title="Start"
                >
                  {actionLoading === `${svc.name}-start` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                </button>
              ) : (
                <button
                  onClick={() => serviceAction(svc.name, "stop")}
                  disabled={!!actionLoading}
                  className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md disabled:opacity-50 transition-colors"
                  title="Stop"
                >
                  {actionLoading === `${svc.name}-stop` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                </button>
              )}
              <button
                onClick={() => serviceAction(svc.name, "restart")}
                disabled={!!actionLoading}
                className="p-1.5 text-primary hover:bg-primary/10 rounded-md disabled:opacity-50 transition-colors"
                title="Restart"
              >
                {actionLoading === `${svc.name}-restart` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} of {services.length} services shown</p>
    </div>
  );
}
