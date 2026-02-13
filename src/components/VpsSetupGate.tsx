/**
 * ZeeVPS — Connection Gate
 * Displays the login form before granting access to the dashboard.
 * 
 * @author Iheb Chebbi
 */

import { useState, useEffect } from "react";
import { Loader2, Server, FolderOpen, TerminalSquare, ShieldCheck, Activity, Network, Box, Clock, Package, Database, ScrollText, HardDrive, Globe, Cpu, Lock, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { isVpsConfigured, setVpsConfig } from "@/lib/vps-config";
import { testConnection } from "@/lib/ssh-api";

const LOGO_URL = "https://storage.googleapis.com/gpt-engineer-file-uploads/rR0DyvKGIFZy0Uan8s996rt0Zt03/uploads/1770904637779-images.png";

const FEATURES = [
  {
    icon: Server,
    title: "Server Overview",
    desc: "Real-time CPU, RAM, disk & network monitoring with historical charts and resource gauges.",
    color: "text-primary",
  },
  {
    icon: FolderOpen,
    title: "File Manager",
    desc: "Browse, upload, download, edit, rename, chmod and manage files remotely with a full file browser.",
    color: "text-blue-400",
  },
  {
    icon: TerminalSquare,
    title: "Web Terminal",
    desc: "Execute commands directly on your server with a full interactive web-based terminal.",
    color: "text-emerald-400",
  },
  {
    icon: ShieldCheck,
    title: "Security Center",
    desc: "SSH hardening, Fail2Ban management, UFW firewall, IP whitelist/blacklist, security scans, attack map with geolocation.",
    color: "text-red-400",
  },
  {
    icon: Activity,
    title: "Process Manager",
    desc: "View all running processes with CPU/memory usage and kill processes directly.",
    color: "text-yellow-400",
  },
  {
    icon: Box,
    title: "Docker Management",
    desc: "Manage containers, images, networks, volumes. Start, stop, restart, inspect and pull images.",
    color: "text-cyan-400",
  },
  {
    icon: Database,
    title: "PostgreSQL Manager",
    desc: "Connect to PostgreSQL databases, browse tables, run SQL queries, create and drop databases.",
    color: "text-indigo-400",
  },
  {
    icon: Network,
    title: "Network Tools",
    desc: "Open ports, active connections, iptables rules, Nginx domain management with config editor.",
    color: "text-violet-400",
  },
  {
    icon: ScrollText,
    title: "Log Viewer",
    desc: "Stream service and system logs in real-time with filtering and search capabilities.",
    color: "text-orange-400",
  },
  {
    icon: Clock,
    title: "Cron Jobs",
    desc: "View, add, edit and delete cron jobs. Full crontab editor with syntax validation.",
    color: "text-teal-400",
  },
  {
    icon: Package,
    title: "App Store (120+ Apps)",
    desc: "One-click install/uninstall for 120+ packages across 21 categories — databases, runtimes, security tools, and more.",
    color: "text-pink-400",
  },
  {
    icon: HardDrive,
    title: "Backup Manager",
    desc: "Create, schedule, and restore server backups with tar compression and archive management.",
    color: "text-amber-400",
  },
  {
    icon: Zap,
    title: "System Benchmarks",
    desc: "Run CPU, disk I/O, memory, and network speed tests to benchmark your server performance.",
    color: "text-lime-400",
  },
  {
    icon: Globe,
    title: "DNS & SSL",
    desc: "Manage DNS records, generate and renew Let's Encrypt SSL certificates for your domains.",
    color: "text-sky-400",
  },
  {
    icon: Lock,
    title: "SSH Key Manager",
    desc: "Manage authorized SSH keys, generate new key pairs, and control access to your server.",
    color: "text-rose-400",
  },
  {
    icon: Cpu,
    title: "Git Deployment",
    desc: "Clone and deploy apps from GitHub in one click — Node.js, Python, Docker, .NET, Go, PHP, Ruby.",
    color: "text-fuchsia-400",
  },
];

export function VpsSetupGate({ children }: { children: React.ReactNode }) {
  const [configured, setConfigured] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [showFeatures, setShowFeatures] = useState(false);

  useEffect(() => {
    if (isVpsConfigured()) setConfigured(true);
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedHost = host.trim();
    const trimmedUser = username.trim();
    const portNum = parseInt(port) || 22;

    if (!trimmedHost || !trimmedUser || !password) {
      setError("All fields are required");
      return;
    }

    setConnecting(true);
    try {
      setVpsConfig({ host: trimmedHost, port: portNum, username: trimmedUser, password });
      const result = await testConnection();
      if (result.success) {
        setConfigured(true);
      } else {
        setError(result.error || "Connection failed. Verify your credentials.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  if (configured) return <>{children}</>;

  const inputClass = "w-full h-9 px-3 text-sm rounded-lg border border-border/60 bg-background/50 text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-background">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-48 h-48 bg-gradient-to-br from-primary/8 to-transparent rounded-br-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-tl from-primary/8 to-transparent rounded-tl-full pointer-events-none" />

      <div className="relative w-full max-w-lg z-10 space-y-4">
        {/* Main card */}
        <div className="border border-border/60 rounded-2xl bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-7 pb-4 text-center">
            <div className="mx-auto w-14 h-14 rounded-xl bg-secondary/80 border border-border/50 flex items-center justify-center mb-3 shadow-lg">
              <img src={LOGO_URL} alt="ZeeVps" className="h-8 w-8 rounded-md" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">ZeeVps</h1>
            <p className="text-xs text-muted-foreground mt-1">Complete server management from your browser</p>
          </div>

          {/* Feature highlights */}
          <div className="mx-6 mb-4 grid grid-cols-3 gap-2">
            <div className="text-center py-2 px-2 rounded-lg bg-secondary/30 border border-border/30">
              <p className="text-sm font-bold text-foreground font-mono">120+</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Apps</p>
            </div>
            <div className="text-center py-2 px-2 rounded-lg bg-secondary/30 border border-border/30">
              <p className="text-sm font-bold text-foreground font-mono">16</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Modules</p>
            </div>
            <div className="text-center py-2 px-2 rounded-lg bg-secondary/30 border border-border/30">
              <p className="text-sm font-bold text-foreground font-mono">1-Click</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Deploy</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleConnect} className="px-6 pb-4 space-y-3">
            <div className="grid grid-cols-[1fr_72px] gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Host / IP</label>
                <input type="text" value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.100" autoFocus className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Port</label>
                <input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="22" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root" className={inputClass} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
            </div>

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={connecting}
              className="w-full h-10 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-md shadow-primary/20"
            >
              {connecting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</>
              ) : (
                "Connect to Server"
              )}
            </button>

            <p className="text-[10px] text-muted-foreground/50 text-center">
              Credentials stored locally — never leaves your browser.
            </p>
          </form>

          {/* Features toggle */}
          <button
            onClick={() => setShowFeatures(!showFeatures)}
            className="w-full border-t border-border/40 px-6 py-2.5 bg-secondary/20 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showFeatures ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showFeatures ? "Hide features" : "Explore all features"}
          </button>

          {/* Features grid */}
          {showFeatures && (
            <div className="border-t border-border/30 px-5 py-4 bg-secondary/10 max-h-[400px] overflow-y-auto terminal-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FEATURES.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-secondary/40 transition-colors group">
                    <div className="p-1.5 rounded-md bg-secondary/60 border border-border/30 shrink-0 group-hover:border-primary/20 transition-colors">
                      <f.icon className={`h-3.5 w-3.5 ${f.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-tight">{f.title}</p>
                      <p className="text-[10px] text-muted-foreground/70 leading-snug mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border/40 px-6 py-2.5 bg-secondary/20 flex items-center justify-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/60">© {new Date().getFullYear()} ZeeVPS — Developed by</span>
            <a
              href="https://www.linkedin.com/in/iheb-chebbi-899462237/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium text-primary/80 hover:text-primary hover:underline transition-colors"
            >
              Iheb Chebbi
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
