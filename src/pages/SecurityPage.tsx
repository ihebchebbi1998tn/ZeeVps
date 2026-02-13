import { useState, useEffect, useCallback, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getSecurityAudit, SecurityAudit, installPackage, enableUfw, ufwRule, geoLookup, GeoInfo,
  manageNginxDomain, deleteNginxDomain, readNginxConfig, getUfwStatusParsed,
  readSshdConfig, writeSshdConfig, sshdHarden,
  f2bStatus, f2bJailStatus, f2bBanIp, f2bUnbanIp, f2bReadJailConfig, f2bWriteJailConfig,
  securityToolsCheck, SecurityToolsStatus, runLynis, runRkhunter, runClamscan,
  readSecurityFile, writeSecurityFile, applySysctl,
  getWhitelist, WhitelistData, addWhitelistIp, removeWhitelistIp, addBlacklistIp, removeBlacklistIp,
} from "@/lib/ssh-api";
import {
  Loader2, RefreshCw, ShieldCheck, ShieldAlert, ShieldX, Users, KeyRound, Clock, AlertTriangle,
  Eye, Bug, FileWarning, Globe, MapPin, Download, Plus, Trash2, Edit, Save, X, Server,
  ExternalLink, Monitor, FileText, Lock, Unlock, Package, Play, Settings, Ban, CheckCircle2,
  XCircle, Wrench, Search, Shield
} from "lucide-react";
import { toast } from "sonner";

// ==================== TYPES ====================
interface CheckResult { label: string; value: string; status: "good" | "warn" | "bad" | "info"; icon: typeof ShieldCheck; }
interface FailedLogin { date: string; time: string; user: string; ip: string; method: string; }
interface DomainInfo { file: string; serverName: string; listen: string; root: string; proxyPass: string; }
interface UfwRule { num: string; action: string; to: string; from: string; comment: string; }

// ==================== PARSERS ====================
function parseFailedLogins(raw: string): FailedLogin[] {
  if (!raw || raw === "no auth log") return [];
  return raw.split("\n").filter(l => l.includes("Failed password")).map(line => {
    const dateMatch = line.match(/^(\w+\s+\d+)\s+(\d+:\d+:\d+)/);
    const userMatch = line.match(/for (?:invalid user )?(\S+)/);
    const ipMatch = line.match(/from\s+(\d+\.\d+\.\d+\.\d+)/);
    return { date: dateMatch?.[1] || "", time: dateMatch?.[2] || "", user: userMatch?.[1] || "unknown", ip: ipMatch?.[1] || "unknown", method: "ssh2" };
  }).filter(l => l.ip !== "unknown");
}

function parseDomains(nginxRaw: string, apacheRaw: string): DomainInfo[] {
  const domains: DomainInfo[] = [];
  if (nginxRaw && !nginxRaw.includes("no nginx")) {
    const vhostPart = nginxRaw.split("---VHOST_SEP---")[1] || "";
    vhostPart.split(/===FILE:/).filter(Boolean).forEach(block => {
      const file = block.match(/^(.+?)===/)?.[1] || "";
      const serverName = block.match(/server_name\s+(.+?);/)?.[1] || "";
      const listen = block.match(/listen\s+(.+?);/)?.[1] || "";
      const root = block.match(/root\s+(.+?);/)?.[1] || "";
      const proxyPass = block.match(/proxy_pass\s+(.+?);/)?.[1] || "";
      if (serverName || file) domains.push({ file, serverName: serverName || file.split("/").pop() || "", listen, root, proxyPass });
    });
  }
  if (apacheRaw && !apacheRaw.includes("no apache")) {
    const vhostPart = apacheRaw.split("---VHOST_SEP---")[1] || "";
    vhostPart.split(/===FILE:/).filter(Boolean).forEach(block => {
      const file = block.match(/^(.+?)===/)?.[1] || "";
      const serverName = block.match(/ServerName\s+(.+)/)?.[1] || "";
      const root = block.match(/DocumentRoot\s+(.+)/)?.[1] || "";
      const proxyPass = block.match(/ProxyPass\s+(.+)/)?.[1] || "";
      if (serverName || file) domains.push({ file, serverName: serverName || file.split("/").pop() || "", listen: "80", root, proxyPass });
    });
  }
  return domains;
}

function parseSshChecks(sshConfig: string): CheckResult[] {
  const map: Record<string, string> = {};
  sshConfig.split("\n").filter(l => l.trim()).forEach(l => { const [key, ...rest] = l.trim().split(/\s+/); if (key) map[key.toLowerCase()] = rest.join(" "); });
  const checks: CheckResult[] = [];
  const rl = map["permitrootlogin"] || "unknown";
  checks.push({ label: "Root Login", value: rl, status: rl === "no" ? "good" : rl === "prohibit-password" ? "warn" : "bad", icon: rl === "no" ? ShieldCheck : ShieldAlert });
  const pa = map["passwordauthentication"] || "unknown";
  checks.push({ label: "Password Auth", value: pa, status: pa === "no" ? "good" : "warn", icon: KeyRound });
  const pk = map["pubkeyauthentication"] || "unknown";
  checks.push({ label: "Public Key Auth", value: pk, status: pk === "yes" ? "good" : "warn", icon: KeyRound });
  const ep = map["permitemptypasswords"] || "no";
  checks.push({ label: "Empty Passwords", value: ep, status: ep === "no" ? "good" : "bad", icon: ep === "no" ? ShieldCheck : ShieldX });
  const x11 = map["x11forwarding"] || "unknown";
  checks.push({ label: "X11 Forwarding", value: x11, status: x11 === "no" ? "good" : "warn", icon: Eye });
  const ma = map["maxauthtries"] || "unknown";
  checks.push({ label: "Max Auth Tries", value: ma, status: parseInt(ma) <= 3 ? "good" : parseInt(ma) <= 6 ? "warn" : "bad", icon: AlertTriangle });
  return checks;
}

function parseUfwRules(raw: string): UfwRule[] {
  const lines = raw.split("\n").filter(l => l.match(/^\[\s*\d+\]/));
  return lines.map(l => {
    const numMatch = l.match(/^\[\s*(\d+)\]/);
    const num = numMatch?.[1] || "";
    const rest = l.replace(/^\[\s*\d+\]\s*/, "").trim();
    const parts = rest.split(/\s{2,}/);
    return { num, to: parts[0] || "", action: parts[1] || "", from: parts[2] || "Anywhere", comment: parts[3] || "" };
  });
}

const statusColor = { good: "text-success bg-success/10 border-success/20", warn: "text-warning bg-warning/10 border-warning/20", bad: "text-destructive bg-destructive/10 border-destructive/20", info: "text-primary bg-primary/10 border-primary/20" };
const statusLabel = { good: "SECURE", warn: "WARNING", bad: "CRITICAL", info: "INFO" };

// ==================== LEAFLET ATTACK MAP ====================
function WorldMap({ points }: { points: { lat: number; lon: number; ip: string; count: number; city?: string; country?: string }[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current, {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 10,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(leafletMap.current);
      markersRef.current = L.layerGroup().addTo(leafletMap.current);
    }
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
        markersRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!markersRef.current || !leafletMap.current) return;
    markersRef.current.clearLayers();
    const maxCount = Math.max(...points.map(p => p.count), 1);

    points.forEach(p => {
      const intensity = p.count / maxCount;
      const radius = 6 + intensity * 18;

      const pulseIcon = L.divIcon({
        className: "",
        html: `
          <div style="position:relative;width:${radius * 3}px;height:${radius * 3}px;">
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(239,68,68,0.15);animation:pulse-ring 2s infinite;"></div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${radius * 2}px;height:${radius * 2}px;border-radius:50%;background:rgba(239,68,68,${0.3 + intensity * 0.4});border:2px solid rgba(239,68,68,0.8);"></div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:6px;height:6px;border-radius:50%;background:white;opacity:0.9;"></div>
          </div>`,
        iconSize: [radius * 3, radius * 3],
        iconAnchor: [radius * 1.5, radius * 1.5],
      });

      L.marker([p.lat, p.lon], { icon: pulseIcon })
        .bindPopup(
          `<div style="font-family:monospace;font-size:12px;line-height:1.6;">
            <strong>${p.ip}</strong><br/>
            📍 ${p.city || "Unknown"}, ${p.country || "Unknown"}<br/>
            ⚠️ <strong>${p.count}</strong> attack${p.count > 1 ? "s" : ""}
          </div>`,
          { className: "attack-popup" }
        )
        .addTo(markersRef.current!);
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lon] as [number, number]));
      leafletMap.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
    }
  }, [points]);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="bg-secondary/60 px-3 py-2 flex items-center gap-2">
        <Globe className="h-3.5 w-3.5 text-destructive" />
        <span className="text-xs font-semibold uppercase text-muted-foreground">Attack Origins Map</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{points.length > 0 ? `${points.length} unique locations` : "No attacks detected"}</span>
      </div>
      <div ref={mapRef} style={{ height: 340, width: "100%" }} />
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .leaflet-container { background: hsl(var(--background)) !important; }
        .attack-popup .leaflet-popup-content-wrapper {
          background: hsl(var(--popover));
          color: hsl(var(--popover-foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .attack-popup .leaflet-popup-tip { background: hsl(var(--popover)); }
      `}</style>
    </div>
  );
}

const SECURITY_TOOLS = [
  { key: "fail2ban", name: "Fail2Ban", desc: "Intrusion prevention — bans IPs after failed login attempts", pkg: "fail2ban", icon: Ban },
  { key: "ufw", name: "UFW Firewall", desc: "Uncomplicated firewall for managing iptables rules", pkg: "ufw", icon: ShieldAlert },
  { key: "clamav", name: "ClamAV", desc: "Open-source antivirus engine for detecting trojans, viruses, malware", pkg: "clamav,clamav-daemon", icon: Search },
  { key: "rkhunter", name: "Rootkit Hunter", desc: "Scans for rootkits, backdoors and local exploits", pkg: "rkhunter", icon: Bug },
  { key: "lynis", name: "Lynis", desc: "Security auditing tool for Unix-based systems", pkg: "lynis", icon: Shield },
  { key: "auditd", name: "Audit Daemon", desc: "Linux audit framework for tracking security-relevant events", pkg: "auditd", icon: Eye },
  { key: "apparmor", name: "AppArmor", desc: "Mandatory access control for restricting program capabilities", pkg: "apparmor,apparmor-utils", icon: Lock },
  { key: "unattended_upgrades", name: "Auto Updates", desc: "Automatic installation of security updates", pkg: "unattended-upgrades", icon: RefreshCw },
] as const;

// ==================== CONFIG FILES ====================
const SECURITY_CONFIG_FILES = [
  { path: "/etc/ssh/sshd_config", name: "SSH Server Config", icon: KeyRound },
  { path: "/etc/fail2ban/jail.local", name: "Fail2Ban Jail Config", icon: Ban },
  { path: "/etc/sysctl.conf", name: "Kernel Parameters", icon: Settings },
  { path: "/etc/security/limits.conf", name: "Security Limits", icon: Lock },
  { path: "/etc/hosts.allow", name: "TCP Wrappers (Allow)", icon: CheckCircle2 },
  { path: "/etc/hosts.deny", name: "TCP Wrappers (Deny)", icon: XCircle },
  { path: "/etc/pam.d/sshd", name: "PAM SSH Config", icon: KeyRound },
  { path: "/etc/login.defs", name: "Login Definitions", icon: Users },
];

// ==================== SSH HARDENING PRESETS ====================
const SSH_HARDENING = [
  { key: "PermitRootLogin", value: "no", label: "Disable Root Login", desc: "Prevents direct root SSH access" },
  { key: "PasswordAuthentication", value: "no", label: "Disable Password Auth", desc: "Forces SSH key authentication only", dangerous: true },
  { key: "PermitEmptyPasswords", value: "no", label: "Disable Empty Passwords", desc: "Prevents login with empty passwords" },
  { key: "X11Forwarding", value: "no", label: "Disable X11 Forwarding", desc: "Removes unnecessary X11 attack surface" },
  { key: "MaxAuthTries", value: "3", label: "Limit Auth Tries to 3", desc: "Reduces brute-force window" },
  { key: "ClientAliveInterval", value: "300", label: "Idle Timeout (5min)", desc: "Disconnects idle sessions after 5 minutes" },
  { key: "ClientAliveCountMax", value: "2", label: "Max Alive Count: 2", desc: "Closes dead connections faster" },
  { key: "Protocol", value: "2", label: "Force SSH Protocol 2", desc: "Disables insecure SSHv1" },
  { key: "AllowAgentForwarding", value: "no", label: "Disable Agent Forwarding", desc: "Prevents SSH agent hijacking" },
];

export default function SecurityPage() {
  const [audit, setAudit] = useState<SecurityAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview"|"ssh"|"logins"|"fail2ban"|"ufw"|"whitelist"|"domains"|"tools"|"configs"|"scans">("overview");
  const [installing, setInstalling] = useState<string | null>(null);
  const [geoCache, setGeoCache] = useState<Record<string, GeoInfo & { lat?: number; lon?: number }>>({});
  const [geoLoading, setGeoLoading] = useState(false);

  // UFW state
  const [ufwRules, setUfwRules] = useState<UfwRule[]>([]);
  const [ufwRaw, setUfwRaw] = useState("");
  const [showAddRule, setShowAddRule] = useState(false);
  const [rulePort, setRulePort] = useState("");
  const [ruleProto, setRuleProto] = useState("tcp");
  const [ruleAction, setRuleAction] = useState("allow");
  const [ruleFrom, setRuleFrom] = useState("");
  const [ruleLoading, setRuleLoading] = useState(false);

  // Domain editor
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [domainConfig, setDomainConfig] = useState("");
  const [newDomainOpen, setNewDomainOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState("");
  const [newDomainConfig, setNewDomainConfig] = useState(`server {\n    listen 80;\n    server_name example.com;\n    \n    location / {\n        proxy_pass http://localhost:3000;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n    }\n}`);
  const [savingDomain, setSavingDomain] = useState(false);

  // SSH Config editor
  const [sshdContent, setSshdContent] = useState("");
  const [sshdLoading, setSshdLoading] = useState(false);
  const [sshdEditing, setSshdEditing] = useState(false);
  const [hardeningLoading, setHardeningLoading] = useState<string | null>(null);

  // Fail2Ban
  const [f2bOutput, setF2bOutput] = useState("");
  const [f2bJails, setF2bJails] = useState<string[]>([]);
  const [f2bSelectedJail, setF2bSelectedJail] = useState("");
  const [f2bJailOutput, setF2bJailOutput] = useState("");
  const [f2bConfigContent, setF2bConfigContent] = useState("");
  const [f2bEditingConfig, setF2bEditingConfig] = useState(false);
  const [f2bBanIpVal, setF2bBanIpVal] = useState("");
  const [f2bLoading, setF2bLoading] = useState(false);

  // Security Tools
  const [toolsStatus, setToolsStatus] = useState<SecurityToolsStatus | null>(null);
  const [toolsLoading, setToolsLoading] = useState(false);

  // Config File Editor
  const [configFile, setConfigFile] = useState<string | null>(null);
  const [configContent, setConfigContent] = useState("");
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // Security Scans
  const [scanOutput, setScanOutput] = useState("");
  const [scanRunning, setScanRunning] = useState<string | null>(null);
  const [scanPath, setScanPath] = useState("/home");

  // Whitelist
  const [wlData, setWlData] = useState<WhitelistData | null>(null);
  const [wlLoading, setWlLoading] = useState(false);
  const [wlNewIp, setWlNewIp] = useState("");
  const [wlBlackIp, setWlBlackIp] = useState("");
  const [wlAction, setWlAction] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setAudit(await getSecurityAudit()); } catch { toast.error("Failed to load security audit"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const failedLogins = audit ? parseFailedLogins(audit.failedLogins) : [];
  const domains = audit ? parseDomains(audit.nginxDomains || "", audit.apacheDomains || "") : [];
  const sshChecks = audit ? parseSshChecks(audit.sshConfig) : [];
  const overallScore = sshChecks.length > 0 ? Math.round((sshChecks.filter(c => c.status === "good").length / sshChecks.length) * 100) : 0;
  const activeUserLines = audit?.activeUsers?.split("\n").filter(l => l.trim()) || [];
  const activeUserCount = activeUserLines.length > 1 ? activeUserLines.length - 1 : 0;

  // Geo
  const loadGeo = useCallback(async () => {
    const uniqueIps = [...new Set(failedLogins.map(l => l.ip))].filter(ip => !geoCache[ip]);
    if (uniqueIps.length === 0) return;
    setGeoLoading(true);
    try {
      const { geoData } = await geoLookup(uniqueIps);
      const newCache = { ...geoCache };
      geoData.forEach((g: any) => { if (g.query) newCache[g.query] = { ...g, lat: g.lat, lon: g.lon }; });
      setGeoCache(newCache);
    } catch {} finally { setGeoLoading(false); }
  }, [failedLogins, geoCache]);

  useEffect(() => { if ((tab === "logins" || tab === "overview") && failedLogins.length > 0) loadGeo(); }, [tab, failedLogins.length]);

  // UFW
  useEffect(() => {
    if (tab === "ufw" && audit && !audit.ufw.includes("not installed")) {
      getUfwStatusParsed().then(r => { setUfwRaw(r.output); setUfwRules(parseUfwRules(r.output)); }).catch(() => {});
    }
  }, [tab, audit]);

  // SSH Config tab
  useEffect(() => {
    if (tab === "ssh" && !sshdContent) {
      setSshdLoading(true);
      readSshdConfig().then(r => setSshdContent(r.content)).catch(() => {}).finally(() => setSshdLoading(false));
    }
  }, [tab]);

  // Fail2Ban tab
  useEffect(() => {
    if (tab === "fail2ban" && audit && !audit.fail2ban.includes("not installed")) {
      setF2bLoading(true);
      f2bStatus().then(r => {
        setF2bOutput(r.output);
        const jailMatch = r.output.match(/Jail list:\s*(.+)/);
        if (jailMatch) {
          const jails = jailMatch[1].split(",").map(j => j.trim()).filter(Boolean);
          setF2bJails(jails);
          if (jails.length > 0 && !f2bSelectedJail) setF2bSelectedJail(jails[0]);
        }
      }).catch(() => {}).finally(() => setF2bLoading(false));
    }
  }, [tab, audit]);

  // Load jail details
  useEffect(() => {
    if (f2bSelectedJail && tab === "fail2ban") {
      f2bJailStatus(f2bSelectedJail).then(r => setF2bJailOutput(r.output)).catch(() => {});
    }
  }, [f2bSelectedJail, tab]);

  // Security Tools tab
  useEffect(() => {
    if (tab === "tools" && !toolsStatus) {
      setToolsLoading(true);
      securityToolsCheck().then(setToolsStatus).catch(() => {}).finally(() => setToolsLoading(false));
    }
  }, [tab]);

  const handleInstall = async (pkg: string) => {
    setInstalling(pkg);
    try {
      const r = await installPackage(pkg);
      if (r.success) {
        toast.success(`${pkg} installed successfully`);
        if (pkg === "ufw") { const u = await enableUfw(); if (u.success) toast.success("UFW enabled"); }
        refresh();
        if (toolsStatus) { setToolsStatus(null); securityToolsCheck().then(setToolsStatus).catch(() => {}); }
      } else toast.error(`Failed: ${r.error}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setInstalling(null); }
  };

  const handleAddUfwRule = async () => {
    if (!rulePort.trim()) return;
    setRuleLoading(true);
    try {
      const portSpec = rulePort.match(/^\d+$/) ? `${rulePort}/${ruleProto}` : rulePort;
      const fromPart = ruleFrom.trim() ? `from ${ruleFrom.trim()} to any port ${rulePort}` : portSpec;
      const r = await ufwRule(`${ruleAction} ${fromPart}`);
      if (r.success) { toast.success("Rule added"); setShowAddRule(false); setRulePort(""); setRuleFrom(""); }
      else toast.error(r.output || r.error || "Failed");
      const u = await getUfwStatusParsed(); setUfwRaw(u.output); setUfwRules(parseUfwRules(u.output));
      refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setRuleLoading(false); }
  };

  const handleDeleteUfwRule = async (ruleNum: string) => {
    if (!confirm(`Delete UFW rule #${ruleNum}?`)) return;
    setRuleLoading(true);
    try {
      await ufwRule(`delete ${ruleNum}`);
      toast.success("Rule deleted");
      const u = await getUfwStatusParsed(); setUfwRaw(u.output); setUfwRules(parseUfwRules(u.output));
      refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setRuleLoading(false); }
  };

  const handleSaveDomain = async (domain: string, config: string) => {
    setSavingDomain(true);
    try {
      const r = await manageNginxDomain(domain, config);
      if (r.success) { toast.success(`Domain ${domain} saved`); setEditingDomain(null); setNewDomainOpen(false); refresh(); }
      else toast.error("Nginx error: " + r.error);
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingDomain(false); }
  };

  const handleDeleteDomain = async (domain: string) => {
    if (!confirm(`Delete domain config for ${domain}?`)) return;
    try {
      const r = await deleteNginxDomain(domain);
      if (r.success) { toast.success("Removed"); refresh(); } else toast.error(r.error || "Failed");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleEditDomain = async (filePath: string) => {
    try { const r = await readNginxConfig(filePath); setDomainConfig(r.content); setEditingDomain(filePath); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleSshdSave = async () => {
    setSshdLoading(true);
    try {
      const r = await writeSshdConfig(sshdContent);
      if (r.success) { toast.success("SSH config saved & service restarted"); setSshdEditing(false); refresh(); }
      else toast.error(r.error || "Failed to save config");
    } catch (e: any) { toast.error(e.message); }
    finally { setSshdLoading(false); }
  };

  const handleHarden = async (key: string, value: string) => {
    if (key === "PasswordAuthentication" && value === "no") {
      if (!confirm("⚠️ This will disable password login. Make sure you have SSH key access or you may get locked out!")) return;
    }
    setHardeningLoading(key);
    try {
      const r = await sshdHarden(`${key}=${value}`);
      if (r.success) { toast.success(`Applied: ${key}=${value}`); refresh(); readSshdConfig().then(r => setSshdContent(r.content)).catch(() => {}); }
      else toast.error(r.error || "Failed");
    } catch (e: any) { toast.error(e.message); }
    finally { setHardeningLoading(null); }
  };

  const handleF2bBan = async () => {
    if (!f2bBanIpVal.trim() || !f2bSelectedJail) return;
    setF2bLoading(true);
    try {
      const r = await f2bBanIp(f2bSelectedJail, f2bBanIpVal.trim());
      if (r.success) { toast.success(`Banned ${f2bBanIpVal}`); setF2bBanIpVal(""); }
      else toast.error(r.error || "Failed");
      f2bJailStatus(f2bSelectedJail).then(r => setF2bJailOutput(r.output)).catch(() => {});
    } catch (e: any) { toast.error(e.message); }
    finally { setF2bLoading(false); }
  };

  const handleF2bUnban = async (ip: string) => {
    if (!f2bSelectedJail) return;
    setF2bLoading(true);
    try {
      await f2bUnbanIp(f2bSelectedJail, ip);
      toast.success(`Unbanned ${ip}`);
      f2bJailStatus(f2bSelectedJail).then(r => setF2bJailOutput(r.output)).catch(() => {});
    } catch (e: any) { toast.error(e.message); }
    finally { setF2bLoading(false); }
  };

  const handleLoadF2bConfig = async () => {
    setF2bLoading(true);
    try { const r = await f2bReadJailConfig(); setF2bConfigContent(r.content); setF2bEditingConfig(true); }
    catch (e: any) { toast.error(e.message); }
    finally { setF2bLoading(false); }
  };

  const handleSaveF2bConfig = async () => {
    setF2bLoading(true);
    try {
      const r = await f2bWriteJailConfig(f2bConfigContent);
      if (r.success) { toast.success("Fail2Ban config saved & restarted"); setF2bEditingConfig(false); }
      else toast.error(r.error || "Failed");
    } catch (e: any) { toast.error(e.message); }
    finally { setF2bLoading(false); }
  };

  const handleLoadConfigFile = async (path: string) => {
    setConfigLoading(true);
    setConfigFile(path);
    try { const r = await readSecurityFile(path); setConfigContent(r.content); }
    catch (e: any) { toast.error(e.message); setConfigFile(null); }
    finally { setConfigLoading(false); }
  };

  const handleSaveConfigFile = async () => {
    if (!configFile) return;
    setConfigSaving(true);
    try {
      const r = await writeSecurityFile(configFile, configContent);
      if (r.success) {
        toast.success("Config saved");
        if (configFile === "/etc/sysctl.conf") {
          const sr = await applySysctl();
          if (sr.success) toast.success("sysctl applied");
          else toast.error("sysctl apply failed: " + sr.error);
        }
        if (configFile === "/etc/ssh/sshd_config") {
          refresh();
        }
      } else toast.error(r.error || "Failed");
    } catch (e: any) { toast.error(e.message); }
    finally { setConfigSaving(false); }
  };

  const handleRunScan = async (type: "lynis" | "rkhunter" | "clamscan") => {
    setScanRunning(type);
    setScanOutput("");
    try {
      let r;
      if (type === "lynis") r = await runLynis();
      else if (type === "rkhunter") r = await runRkhunter();
      else r = await runClamscan(scanPath);
      setScanOutput(r.output || r.error || "No output");
    } catch (e: any) { setScanOutput("Error: " + e.message); }
    finally { setScanRunning(null); }
  };

  // Map points
  const mapPoints = (() => {
    const ipCounts: Record<string, number> = {};
    failedLogins.forEach(l => { ipCounts[l.ip] = (ipCounts[l.ip] || 0) + 1; });
    return Object.entries(ipCounts).map(([ip, count]) => {
      const geo = geoCache[ip];
      if (!geo || !geo.lat || !geo.lon) return null;
      return { lat: geo.lat, lon: geo.lon, ip, count, city: geo.city, country: geo.country };
    }).filter(Boolean) as { lat: number; lon: number; ip: string; count: number; city?: string; country?: string }[];
  })();

  // Extract banned IPs from jail output
  const bannedIps = f2bJailOutput.match(/Banned IP list:\s*(.+)/)?.[1]?.split(/\s+/).filter(Boolean) || [];

  // Whitelist tab
  useEffect(() => {
    if (tab === "whitelist" && !wlData) {
      setWlLoading(true);
      getWhitelist().then(setWlData).catch(() => {}).finally(() => setWlLoading(false));
    }
  }, [tab]);

  const handleAddWhitelist = async () => {
    if (!wlNewIp.trim()) return;
    setWlAction(true);
    try {
      const r = await addWhitelistIp(wlNewIp.trim());
      if (r.success) { toast.success(`${wlNewIp} whitelisted`); setWlNewIp(""); setWlData(null); getWhitelist().then(setWlData).catch(() => {}); }
      else toast.error(r.error || "Failed");
    } catch (e: any) { toast.error(e.message); }
    finally { setWlAction(false); }
  };

  const handleRemoveWhitelist = async (ip: string) => {
    setWlAction(true);
    try {
      await removeWhitelistIp(ip);
      toast.success(`${ip} removed from whitelist`);
      setWlData(null); getWhitelist().then(setWlData).catch(() => {});
    } catch (e: any) { toast.error(e.message); }
    finally { setWlAction(false); }
  };

  const handleAddBlacklist = async () => {
    if (!wlBlackIp.trim()) return;
    setWlAction(true);
    try {
      const r = await addBlacklistIp(wlBlackIp.trim());
      if (r.success) { toast.success(`${wlBlackIp} blacklisted`); setWlBlackIp(""); setWlData(null); getWhitelist().then(setWlData).catch(() => {}); }
      else toast.error(r.error || "Failed");
    } catch (e: any) { toast.error(e.message); }
    finally { setWlAction(false); }
  };

  const handleRemoveBlacklist = async (ip: string) => {
    setWlAction(true);
    try {
      await removeBlacklistIp(ip);
      toast.success(`${ip} removed from blacklist`);
      setWlData(null); getWhitelist().then(setWlData).catch(() => {});
    } catch (e: any) { toast.error(e.message); }
    finally { setWlAction(false); }
  };

  // Parse whitelist IPs
  const whitelistedIps = wlData?.hostsAllow?.split("\n").filter(l => l.trim() && !l.startsWith("#")).map(l => {
    const match = l.match(/ALL:\s*(.+)/);
    return match?.[1]?.trim() || "";
  }).filter(Boolean) || [];

  const blacklistedIps = wlData?.hostsDeny?.split("\n").filter(l => l.trim() && !l.startsWith("#")).map(l => {
    const match = l.match(/ALL:\s*(.+)/);
    return match?.[1]?.trim() || "";
  }).filter(Boolean) || [];

  const f2bIgnoreIps = wlData?.f2bIgnoreIp?.match(/ignoreip\s*=\s*(.+)/)?.[1]?.split(/\s+/).filter(ip => ip && ip !== "127.0.0.1/8" && ip !== "::1") || [];

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: ShieldCheck },
    { id: "ssh" as const, label: "SSH", icon: KeyRound },
    { id: "logins" as const, label: "Logins", icon: Users },
    { id: "fail2ban" as const, label: "Fail2Ban", icon: Ban },
    { id: "ufw" as const, label: "UFW", icon: ShieldAlert },
    { id: "whitelist" as const, label: "Whitelist", icon: CheckCircle2 },
    { id: "tools" as const, label: "Modules", icon: Package },
    { id: "configs" as const, label: "Configs", icon: FileText },
    { id: "scans" as const, label: "Scans", icon: Search },
    { id: "domains" as const, label: "Domains", icon: Globe },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Security Center</h1>
        </div>
        <button onClick={refresh} disabled={loading} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded hover:bg-secondary text-muted-foreground">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Scan
        </button>
      </div>

      <div className="flex gap-1 bg-secondary/50 p-1 rounded flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !audit ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Failed to load security audit</div>
      ) : (
        <>
          {/* ==================== OVERVIEW ==================== */}
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className={`border rounded p-3 ${overallScore >= 80 ? "border-success/30 bg-success/5" : overallScore >= 50 ? "border-warning/30 bg-warning/5" : "border-destructive/30 bg-destructive/5"}`}>
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">Security Score</div>
                  <div className={`text-2xl font-bold ${overallScore >= 80 ? "text-success" : overallScore >= 50 ? "text-warning" : "text-destructive"}`}>{overallScore}%</div>
                  <div className="text-[10px] text-muted-foreground">{sshChecks.filter(c => c.status === "good").length}/{sshChecks.length} checks passed</div>
                </div>
                <div className="border border-border rounded p-3">
                  <div className="text-[10px] uppercase text-muted-foreground mb-1 flex items-center gap-1"><Users className="h-3 w-3" /> Active Users</div>
                  <div className="text-2xl font-bold text-foreground">{activeUserCount}</div>
                </div>
                <div className={`border rounded p-3 ${failedLogins.length > 10 ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                  <div className="text-[10px] uppercase text-muted-foreground mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Failed Logins</div>
                  <div className={`text-2xl font-bold ${failedLogins.length > 10 ? "text-destructive" : "text-foreground"}`}>{failedLogins.length}</div>
                </div>
                <div className="border border-border rounded p-3">
                  <div className="text-[10px] uppercase text-muted-foreground mb-1 flex items-center gap-1"><Bug className="h-3 w-3" /> Fail2Ban</div>
                  <div className="text-sm font-medium text-foreground mt-1">{audit.fail2ban.includes("not installed") ? "Not Installed" : "Active"}</div>
                  {audit.fail2ban.includes("not installed") && (
                    <button onClick={() => handleInstall("fail2ban")} disabled={!!installing} className="text-primary hover:underline flex items-center gap-1 text-[10px] mt-1">
                      <Download className="h-3 w-3" /> {installing === "fail2ban" ? "Installing..." : "Install"}
                    </button>
                  )}
                </div>
              </div>

              <WorldMap points={mapPoints} />
              {geoLoading && mapPoints.length === 0 && (
                <div className="border border-border rounded-lg p-6 flex items-center justify-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading geo data...
                </div>
              )}

              <div className="border border-border rounded overflow-hidden">
                <div className="bg-secondary/60 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">SSH Security Checks</div>
                <div className="divide-y divide-border/50">
                  {sshChecks.map((check, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <check.icon className={`h-3.5 w-3.5 ${check.status === "good" ? "text-success" : check.status === "warn" ? "text-warning" : "text-destructive"}`} />
                        <span className="text-xs text-foreground">{check.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{check.value}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusColor[check.status]}`}>{statusLabel[check.status]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-border rounded overflow-hidden">
                <div className="bg-secondary/60 px-3 py-2 flex items-center gap-2"><Monitor className="h-3.5 w-3.5 text-primary" /><span className="text-xs font-semibold uppercase text-muted-foreground">Active Sessions</span></div>
                <pre className="p-3 text-xs font-mono text-foreground/80 overflow-auto terminal-scrollbar">{audit.activeUsers || "No active sessions"}</pre>
              </div>

              {failedLogins.length > 0 && (
                <div className="border border-border rounded overflow-hidden">
                  <div className="bg-destructive/10 px-3 py-2 flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-xs font-semibold uppercase text-destructive">Top Attack Origins</span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {(() => {
                      const ipCounts: Record<string, number> = {};
                      failedLogins.forEach(l => { ipCounts[l.ip] = (ipCounts[l.ip] || 0) + 1; });
                      return Object.entries(ipCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([ip, count]) => {
                        const geo = geoCache[ip];
                        return (
                          <div key={ip} className="flex items-center justify-between px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Globe className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-mono">{ip}</span>
                              {geo && geo.status === "success" && <span className="text-[10px] text-muted-foreground">{geo.city}, {geo.country}</span>}
                            </div>
                            <span className="text-xs font-bold text-destructive">{count}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== SSH (with editor & hardening) ==================== */}
          {tab === "ssh" && (
            <div className="space-y-3">
              {/* Quick Hardening */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-secondary/60 px-3 py-2 flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">One-Click Hardening</span>
                </div>
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {SSH_HARDENING.map(h => {
                    const currentCheck = sshChecks.find(c => c.label.toLowerCase().includes(h.key.toLowerCase().replace(/([A-Z])/g, ' $1').trim().split(' ')[0].toLowerCase()));
                    const isApplied = currentCheck?.status === "good";
                    return (
                      <div key={h.key} className={`border rounded p-2 ${isApplied ? "border-success/30 bg-success/5" : "border-border"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">{h.label}</span>
                          {isApplied ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border text-success bg-success/10 border-success/20">APPLIED</span>
                          ) : (
                            <button onClick={() => handleHarden(h.key, h.value)} disabled={!!hardeningLoading}
                              className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                              {hardeningLoading === h.key ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{h.desc}</p>
                        {h.dangerous && <p className="text-[10px] text-destructive mt-0.5">⚠️ Ensure SSH key access first</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SSH Checks */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-secondary/60 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Current SSH Configuration</div>
                <div className="divide-y divide-border/50">
                  {sshChecks.map((check, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <check.icon className={`h-4 w-4 ${check.status === "good" ? "text-success" : check.status === "warn" ? "text-warning" : "text-destructive"}`} />
                        <span className="text-xs font-medium">{check.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono">{check.value}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusColor[check.status]}`}>{statusLabel[check.status]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Full sshd_config editor */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-secondary/60 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-primary" /><span className="text-xs font-semibold uppercase text-muted-foreground">sshd_config Editor</span></div>
                  <div className="flex items-center gap-2">
                    {sshdEditing ? (
                      <>
                        <button onClick={() => setSshdEditing(false)} className="text-xs px-2 py-1 border border-border rounded hover:bg-secondary text-muted-foreground"><X className="h-3 w-3" /></button>
                        <button onClick={handleSshdSave} disabled={sshdLoading} className="flex items-center gap-1 text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                          {sshdLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save & Restart SSH
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setSshdEditing(true)} className="flex items-center gap-1 text-xs px-3 py-1 border border-border rounded hover:bg-secondary text-muted-foreground">
                        <Edit className="h-3 w-3" /> Edit
                      </button>
                    )}
                  </div>
                </div>
                {sshdLoading && !sshdContent ? (
                  <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : sshdEditing ? (
                  <textarea value={sshdContent} onChange={e => setSshdContent(e.target.value)} rows={20}
                    className="w-full p-3 text-xs font-mono bg-background text-foreground border-0 outline-none resize-y terminal-scrollbar" />
                ) : (
                  <pre className="p-3 text-xs font-mono text-foreground/80 overflow-auto max-h-80 terminal-scrollbar">{sshdContent || audit.sshConfig}</pre>
                )}
              </div>
            </div>
          )}

          {/* ==================== LOGINS ==================== */}
          {tab === "logins" && (
            <div className="space-y-3">
              <WorldMap points={mapPoints} />
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-destructive/10 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2"><FileWarning className="h-3.5 w-3.5 text-destructive" /><span className="text-xs font-semibold uppercase text-destructive">Failed Logins ({failedLogins.length})</span></div>
                  {geoLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                {failedLogins.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">No failed logins</div>
                ) : (
                  <div className="overflow-auto max-h-[400px] terminal-scrollbar">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/40 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Date/Time</th>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">User</th>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">IP</th>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Location</th>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">ISP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {failedLogins.map((l, i) => {
                          const geo = geoCache[l.ip];
                          return (
                            <tr key={i} className="hover:bg-secondary/30">
                              <td className="px-3 py-1.5 font-mono text-muted-foreground whitespace-nowrap"><Clock className="h-3 w-3 inline mr-1" />{l.date} {l.time}</td>
                              <td className="px-3 py-1.5 font-mono">{l.user}</td>
                              <td className="px-3 py-1.5 font-mono">{l.ip}</td>
                              <td className="px-3 py-1.5">{geo?.status === "success" ? <span className="text-muted-foreground">{geo.city}, {geo.country}</span> : "—"}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{geo?.isp || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-secondary/60 px-3 py-2 flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-primary" /><span className="text-xs font-semibold uppercase text-muted-foreground">Recent Logins</span></div>
                <pre className="p-3 text-xs font-mono text-foreground/80 overflow-auto max-h-64 terminal-scrollbar">{audit.loginHistory || "No login history"}</pre>
              </div>
            </div>
          )}

          {/* ==================== FAIL2BAN (enhanced) ==================== */}
          {tab === "fail2ban" && (
            <div className="space-y-3">
              {audit.fail2ban.includes("not installed") ? (
                <div className="border border-border rounded p-6 text-center">
                  <Ban className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-30" />
                  <p className="text-sm text-muted-foreground mb-3">Fail2Ban is not installed</p>
                  <button onClick={() => handleInstall("fail2ban")} disabled={!!installing}
                    className="flex items-center gap-1.5 text-xs px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 mx-auto disabled:opacity-50">
                    {installing === "fail2ban" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Install Fail2Ban
                  </button>
                </div>
              ) : (
                <>
                  {/* Jail selector */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Jails:</span>
                    {f2bJails.map(j => (
                      <button key={j} onClick={() => setF2bSelectedJail(j)}
                        className={`text-xs px-3 py-1 rounded border ${f2bSelectedJail === j ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary text-muted-foreground"}`}>
                        {j}
                      </button>
                    ))}
                    <button onClick={handleLoadF2bConfig} className="text-xs px-3 py-1 rounded border border-border hover:bg-secondary text-muted-foreground flex items-center gap-1 ml-auto">
                      <Settings className="h-3 w-3" /> Edit Config
                    </button>
                  </div>

                  {/* Jail details */}
                  {f2bJailOutput && (
                    <div className="border border-border rounded overflow-hidden">
                      <div className="bg-secondary/60 px-3 py-2 flex items-center gap-2">
                        <Ban className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold uppercase text-muted-foreground">Jail: {f2bSelectedJail}</span>
                      </div>
                      <pre className="p-3 text-xs font-mono text-foreground/80 overflow-auto max-h-48 terminal-scrollbar">{f2bJailOutput}</pre>
                    </div>
                  )}

                  {/* Ban/Unban IP */}
                  <div className="border border-border rounded p-3 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">Ban / Unban IP</div>
                    <div className="flex items-center gap-2">
                      <input value={f2bBanIpVal} onChange={e => setF2bBanIpVal(e.target.value)} placeholder="IP address"
                        className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-background font-mono" />
                      <button onClick={handleF2bBan} disabled={f2bLoading || !f2bBanIpVal.trim()}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50">
                        <Ban className="h-3 w-3" /> Ban
                      </button>
                    </div>
                    {bannedIps.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-muted-foreground uppercase">Currently Banned:</div>
                        <div className="flex flex-wrap gap-1">
                          {bannedIps.map(ip => (
                            <span key={ip} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-destructive/10 text-destructive border border-destructive/20 rounded font-mono">
                              {ip}
                              <button onClick={() => handleF2bUnban(ip)} className="hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Config Editor */}
                  {f2bEditingConfig && (
                    <div className="border border-primary/30 rounded overflow-hidden">
                      <div className="bg-primary/5 px-3 py-2 flex items-center justify-between">
                        <span className="text-xs font-semibold">jail.local</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setF2bEditingConfig(false)} className="text-xs px-2 py-1 border border-border rounded hover:bg-secondary"><X className="h-3 w-3" /></button>
                          <button onClick={handleSaveF2bConfig} disabled={f2bLoading}
                            className="flex items-center gap-1 text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                            {f2bLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save & Restart
                          </button>
                        </div>
                      </div>
                      <textarea value={f2bConfigContent} onChange={e => setF2bConfigContent(e.target.value)} rows={18}
                        className="w-full p-3 text-xs font-mono bg-background text-foreground border-0 outline-none resize-y terminal-scrollbar" />
                    </div>
                  )}

                  {/* Raw output */}
                  <details className="border border-border rounded">
                    <summary className="px-3 py-2 text-[10px] text-muted-foreground cursor-pointer hover:bg-secondary/30">Raw Fail2Ban Output</summary>
                    <pre className="p-3 text-xs font-mono text-foreground/70 overflow-auto max-h-48 terminal-scrollbar">{f2bOutput || audit.fail2ban}</pre>
                  </details>
                </>
              )}
            </div>
          )}

          {/* ==================== UFW ==================== */}
          {tab === "ufw" && (
            <div className="space-y-3">
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-secondary/60 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2"><ShieldAlert className="h-3.5 w-3.5 text-primary" /><span className="text-xs font-semibold uppercase text-muted-foreground">UFW Firewall</span></div>
                  <div className="flex items-center gap-2">
                    {audit.ufw.includes("not installed") ? (
                      <button onClick={() => handleInstall("ufw")} disabled={!!installing} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                        {installing === "ufw" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Install & Enable
                      </button>
                    ) : (
                      <button onClick={() => setShowAddRule(true)} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90">
                        <Plus className="h-3 w-3" /> Add Rule
                      </button>
                    )}
                  </div>
                </div>

                {showAddRule && (
                  <div className="p-3 border-b border-border bg-primary/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">New Firewall Rule</span>
                      <button onClick={() => setShowAddRule(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Port</label>
                        <input value={rulePort} onChange={e => setRulePort(e.target.value)} placeholder="80"
                          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Protocol</label>
                        <select value={ruleProto} onChange={e => setRuleProto(e.target.value)} className="w-full px-2 py-1 text-xs border border-border rounded bg-background">
                          <option value="tcp">TCP</option><option value="udp">UDP</option><option value="any">Any</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Action</label>
                        <select value={ruleAction} onChange={e => setRuleAction(e.target.value)} className="w-full px-2 py-1 text-xs border border-border rounded bg-background">
                          <option value="allow">Allow</option><option value="deny">Deny</option><option value="reject">Reject</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">From IP</label>
                        <input value={ruleFrom} onChange={e => setRuleFrom(e.target.value)} placeholder="Any"
                          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
                      </div>
                    </div>
                    <button onClick={handleAddUfwRule} disabled={ruleLoading || !rulePort.trim()}
                      className="flex items-center gap-1.5 text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                      {ruleLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add Rule
                    </button>
                  </div>
                )}

                {!audit.ufw.includes("not installed") && ufwRules.length > 0 ? (
                  <div className="overflow-auto terminal-scrollbar">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/40">
                        <tr>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium w-10">#</th>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">To</th>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Action</th>
                          <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">From</th>
                          <th className="text-right px-3 py-1.5 text-muted-foreground font-medium w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {ufwRules.map((r, i) => (
                          <tr key={i} className="hover:bg-secondary/20">
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.num}</td>
                            <td className="px-3 py-1.5 font-mono">{r.to}</td>
                            <td className="px-3 py-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${r.action.includes("ALLOW") ? "text-success bg-success/10 border-success/20" : "text-destructive bg-destructive/10 border-destructive/20"}`}>
                                {r.action}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.from}</td>
                            <td className="px-3 py-1.5 text-right">
                              <button onClick={() => handleDeleteUfwRule(r.num)} disabled={ruleLoading} className="p-0.5 hover:bg-destructive/10 rounded disabled:opacity-50">
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : !audit.ufw.includes("not installed") ? (
                  <div className="p-3 text-xs text-muted-foreground">No rules found.</div>
                ) : null}

                {!audit.ufw.includes("not installed") && (
                  <details className="border-t border-border">
                    <summary className="px-3 py-2 text-[10px] text-muted-foreground cursor-pointer hover:bg-secondary/30">Raw Output</summary>
                    <pre className="p-3 text-xs font-mono text-foreground/70 overflow-auto max-h-48 terminal-scrollbar">{ufwRaw || audit.ufw}</pre>
                  </details>
                )}
              </div>

              {!audit.ufw.includes("not installed") && (
                <div className="border border-border rounded p-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Quick Add</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "HTTP (80)", port: "80/tcp" },
                      { label: "HTTPS (443)", port: "443/tcp" },
                      { label: "MySQL (3306)", port: "3306/tcp" },
                      { label: "PostgreSQL (5432)", port: "5432/tcp" },
                      { label: "Redis (6379)", port: "6379/tcp" },
                      { label: "Node (3000)", port: "3000/tcp" },
                      { label: "Alt HTTP (8080)", port: "8080/tcp" },
                    ].map(p => (
                      <button key={p.port} onClick={async () => {
                        setRuleLoading(true);
                        try {
                          const r = await ufwRule(`allow ${p.port}`);
                          if (r.success) toast.success(`Allowed ${p.label}`);
                          const u = await getUfwStatusParsed(); setUfwRaw(u.output); setUfwRules(parseUfwRules(u.output));
                        } catch (e: any) { toast.error(e.message); }
                        finally { setRuleLoading(false); }
                      }} disabled={ruleLoading}
                        className="text-[10px] px-2 py-1 border border-border rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-50">
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== WHITELIST / BLACKLIST ==================== */}
          {tab === "whitelist" && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">Manage trusted and blocked IPs across hosts.allow/deny, Fail2Ban ignoreip, and UFW rules.</div>

              {wlLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {/* Whitelist Section */}
                  <div className="border border-success/30 rounded overflow-hidden bg-success/5">
                    <div className="bg-success/10 px-3 py-2 flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      <span className="text-xs font-semibold uppercase text-success">Trusted IPs (Whitelist)</span>
                    </div>
                    <div className="p-3 space-y-3">
                      <p className="text-[10px] text-muted-foreground">These IPs are allowed through hosts.allow, Fail2Ban ignoreip, and UFW allow rules.</p>
                      <div className="flex items-center gap-2">
                        <input value={wlNewIp} onChange={e => setWlNewIp(e.target.value)} placeholder="192.168.1.100 or CIDR (10.0.0.0/8)"
                          className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-background font-mono" />
                        <button onClick={handleAddWhitelist} disabled={wlAction || !wlNewIp.trim()}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                          {wlAction ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
                        </button>
                      </div>
                      {whitelistedIps.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {whitelistedIps.map(ip => (
                            <span key={ip} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-success/10 text-success border border-success/20 rounded font-mono">
                              {ip}
                              <button onClick={() => handleRemoveWhitelist(ip)} disabled={wlAction} className="hover:text-foreground disabled:opacity-50"><X className="h-3 w-3" /></button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground">No whitelisted IPs</div>
                      )}
                      {f2bIgnoreIps.length > 0 && (
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">Fail2Ban Ignored IPs:</div>
                          <div className="flex flex-wrap gap-1">
                            {f2bIgnoreIps.map(ip => (
                              <span key={ip} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded font-mono">{ip}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Blacklist Section */}
                  <div className="border border-destructive/30 rounded overflow-hidden bg-destructive/5">
                    <div className="bg-destructive/10 px-3 py-2 flex items-center gap-2">
                      <Ban className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-xs font-semibold uppercase text-destructive">Blocked IPs (Blacklist)</span>
                    </div>
                    <div className="p-3 space-y-3">
                      <p className="text-[10px] text-muted-foreground">These IPs are blocked via hosts.deny and UFW deny rules.</p>
                      <div className="flex items-center gap-2">
                        <input value={wlBlackIp} onChange={e => setWlBlackIp(e.target.value)} placeholder="IP to block"
                          className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-background font-mono" />
                        <button onClick={handleAddBlacklist} disabled={wlAction || !wlBlackIp.trim()}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50">
                          {wlAction ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />} Block
                        </button>
                      </div>
                      {blacklistedIps.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {blacklistedIps.map(ip => (
                            <span key={ip} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-destructive/10 text-destructive border border-destructive/20 rounded font-mono">
                              {ip}
                              <button onClick={() => handleRemoveBlacklist(ip)} disabled={wlAction} className="hover:text-foreground disabled:opacity-50"><X className="h-3 w-3" /></button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground">No blacklisted IPs</div>
                      )}
                    </div>
                  </div>

                  {/* Raw Data */}
                  <details className="border border-border rounded">
                    <summary className="px-3 py-2 text-[10px] text-muted-foreground cursor-pointer hover:bg-secondary/30">Raw hosts.allow</summary>
                    <pre className="p-3 text-xs font-mono text-foreground/70 overflow-auto max-h-48 terminal-scrollbar">{wlData?.hostsAllow || "Empty"}</pre>
                  </details>
                  <details className="border border-border rounded">
                    <summary className="px-3 py-2 text-[10px] text-muted-foreground cursor-pointer hover:bg-secondary/30">Raw hosts.deny</summary>
                    <pre className="p-3 text-xs font-mono text-foreground/70 overflow-auto max-h-48 terminal-scrollbar">{wlData?.hostsDeny || "Empty"}</pre>
                  </details>
                </>
              )}
            </div>
          )}

          {/* ==================== SECURITY MODULES ==================== */}
          {tab === "tools" && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">Install and manage security modules on your server.</div>
              {toolsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SECURITY_TOOLS.map(tool => {
                    const installed = toolsStatus?.[tool.key as keyof SecurityToolsStatus] ?? false;
                    return (
                      <div key={tool.key} className={`border rounded p-3 ${installed ? "border-success/30 bg-success/5" : "border-border"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <tool.icon className={`h-4 w-4 ${installed ? "text-success" : "text-muted-foreground"}`} />
                            <span className="text-sm font-semibold">{tool.name}</span>
                          </div>
                          {installed ? (
                            <span className="text-[10px] px-2 py-0.5 rounded border text-success bg-success/10 border-success/20 font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Installed
                            </span>
                          ) : (
                            <button onClick={() => handleInstall(tool.pkg)} disabled={!!installing}
                              className="flex items-center gap-1 text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                              {installing === tool.pkg ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                              {installing === tool.pkg ? "Installing..." : "Install"}
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{tool.desc}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== CONFIG FILE EDITOR ==================== */}
          {tab === "configs" && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">Edit security configuration files directly. Changes are backed up automatically.</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {SECURITY_CONFIG_FILES.map(f => (
                  <button key={f.path} onClick={() => handleLoadConfigFile(f.path)}
                    className={`border rounded p-2.5 text-left hover:bg-secondary/50 transition-colors ${configFile === f.path ? "border-primary bg-primary/5" : "border-border"}`}>
                    <f.icon className="h-4 w-4 text-primary mb-1" />
                    <div className="text-xs font-medium">{f.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">{f.path}</div>
                  </button>
                ))}
              </div>

              {configFile && (
                <div className="border border-primary/30 rounded overflow-hidden">
                  <div className="bg-primary/5 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold font-mono">{configFile}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setConfigFile(null); setConfigContent(""); }} className="text-xs px-2 py-1 border border-border rounded hover:bg-secondary"><X className="h-3 w-3" /></button>
                      <button onClick={handleSaveConfigFile} disabled={configSaving || configLoading}
                        className="flex items-center gap-1 text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                        {configSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                        {configFile === "/etc/sysctl.conf" && " & Apply"}
                      </button>
                    </div>
                  </div>
                  {configLoading ? (
                    <div className="p-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <textarea value={configContent} onChange={e => setConfigContent(e.target.value)} rows={22}
                      className="w-full p-3 text-xs font-mono bg-background text-foreground border-0 outline-none resize-y terminal-scrollbar" />
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==================== SECURITY SCANS ==================== */}
          {tab === "scans" && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">Run security scans on your server. Results appear below.</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-border rounded p-3">
                  <div className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Lynis Audit</span></div>
                  <p className="text-[10px] text-muted-foreground mb-2">Comprehensive security audit and hardening suggestions</p>
                  <button onClick={() => handleRunScan("lynis")} disabled={!!scanRunning}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 w-full justify-center">
                    {scanRunning === "lynis" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {scanRunning === "lynis" ? "Running..." : "Run Scan"}
                  </button>
                </div>
                <div className="border border-border rounded p-3">
                  <div className="flex items-center gap-2 mb-2"><Bug className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Rootkit Hunter</span></div>
                  <p className="text-[10px] text-muted-foreground mb-2">Scan for rootkits, backdoors, and local exploits</p>
                  <button onClick={() => handleRunScan("rkhunter")} disabled={!!scanRunning}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 w-full justify-center">
                    {scanRunning === "rkhunter" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {scanRunning === "rkhunter" ? "Running..." : "Run Scan"}
                  </button>
                </div>
                <div className="border border-border rounded p-3">
                  <div className="flex items-center gap-2 mb-2"><Search className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">ClamAV Scan</span></div>
                  <p className="text-[10px] text-muted-foreground mb-1">Antivirus scan for malware detection</p>
                  <input value={scanPath} onChange={e => setScanPath(e.target.value)} placeholder="/home"
                    className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono mb-2" />
                  <button onClick={() => handleRunScan("clamscan")} disabled={!!scanRunning}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 w-full justify-center">
                    {scanRunning === "clamscan" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {scanRunning === "clamscan" ? "Scanning..." : "Run Scan"}
                  </button>
                </div>
              </div>

              {scanOutput && (
                <div className="border border-border rounded overflow-hidden">
                  <div className="bg-secondary/60 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Scan Results</div>
                  <pre className="p-3 text-xs font-mono text-foreground/80 overflow-auto max-h-[500px] terminal-scrollbar whitespace-pre-wrap">{scanOutput}</pre>
                </div>
              )}
            </div>
          )}

          {/* ==================== DOMAINS ==================== */}
          {tab === "domains" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Linked Domains</span></div>
                <button onClick={() => setNewDomainOpen(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90">
                  <Plus className="h-3 w-3" /> Add Domain
                </button>
              </div>
              {newDomainOpen && (
                <div className="border border-primary/30 rounded p-3 space-y-2 bg-primary/5">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold">New Nginx Config</span><button onClick={() => setNewDomainOpen(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button></div>
                  <input value={newDomainName} onChange={e => setNewDomainName(e.target.value)} placeholder="domain.com" className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background font-mono" />
                  <textarea value={newDomainConfig} onChange={e => setNewDomainConfig(e.target.value)} rows={10} className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background font-mono terminal-scrollbar" />
                  <button onClick={() => handleSaveDomain(newDomainName, newDomainConfig)} disabled={!newDomainName || savingDomain}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                    {savingDomain ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save & Reload
                  </button>
                </div>
              )}
              {editingDomain && (
                <div className="border border-primary/30 rounded p-3 space-y-2 bg-primary/5">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold font-mono">{editingDomain}</span><button onClick={() => setEditingDomain(null)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button></div>
                  <textarea value={domainConfig} onChange={e => setDomainConfig(e.target.value)} rows={12} className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background font-mono terminal-scrollbar" />
                  <button onClick={() => { const name = editingDomain.split("/").pop() || ""; handleSaveDomain(name, domainConfig); }} disabled={savingDomain}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                    {savingDomain ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save & Reload
                  </button>
                </div>
              )}
              {domains.length === 0 && !newDomainOpen ? (
                <div className="border border-border rounded p-6 text-center text-muted-foreground text-xs"><Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />No domains found.</div>
              ) : (
                <div className="space-y-2">
                  {domains.map((d, i) => (
                    <div key={i} className="border border-border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Server className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm font-semibold">{d.serverName}</span>
                          <a href={`http://${d.serverName}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="h-3 w-3" /></a>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEditDomain(d.file)} className="p-1 hover:bg-secondary rounded"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></button>
                          <button onClick={() => handleDeleteDomain(d.serverName)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div><span className="text-muted-foreground">Listen:</span> <span className="font-mono">{d.listen || "—"}</span></div>
                        <div><span className="text-muted-foreground">Root:</span> <span className="font-mono">{d.root || "—"}</span></div>
                        <div><span className="text-muted-foreground">Proxy:</span> <span className="font-mono">{d.proxyPass || "—"}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
