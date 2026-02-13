import { useState, useEffect, useCallback } from "react";
import { getOpenPorts, getActiveConnections, getIptablesRules, addIptablesRule, deleteIptablesRule } from "@/lib/ssh-api";
import { Loader2, RefreshCw, Shield, Globe, Lock, Unlock, Plus, Trash2, Network, ArrowDownUp, Server, AlertTriangle, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParsedPort {
  protocol: string;
  localAddr: string;
  localPort: string;
  process: string;
  state: string;
}

interface ParsedConnection {
  protocol: string;
  localAddr: string;
  remoteAddr: string;
  state: string;
  process: string;
}

function parsePorts(raw: string): ParsedPort[] {
  const lines = raw.split("\n").filter(l => l.trim() && !l.startsWith("Netid") && !l.startsWith("State") && !l.startsWith("Proto"));
  return lines.map(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) return null;
    // ss format: Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port Process
    const proto = parts[0] || "tcp";
    const state = parts[1] || "LISTEN";
    const localFull = parts[4] || "";
    const lastColon = localFull.lastIndexOf(":");
    const localAddr = localFull.substring(0, lastColon) || "*";
    const localPort = localFull.substring(lastColon + 1) || "?";
    const process = parts.slice(6).join(" ").replace(/users:\(\("|"\)\)/g, "").split(",")[0] || "-";
    return { protocol: proto, localAddr, localPort, process, state };
  }).filter(Boolean) as ParsedPort[];
}

function parseConnections(raw: string): ParsedConnection[] {
  const lines = raw.split("\n").filter(l => l.trim() && !l.startsWith("Netid") && !l.startsWith("State") && !l.startsWith("Proto"));
  return lines.map(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 6) return null;
    return {
      protocol: parts[0] || "tcp",
      state: parts[1] || "ESTAB",
      localAddr: parts[4] || "-",
      remoteAddr: parts[5] || "-",
      process: parts.slice(6).join(" ").replace(/users:\(\("|"\)\)/g, "").split(",")[0] || "-",
    };
  }).filter(Boolean) as ParsedConnection[];
}

export default function NetworkPage() {
  const [tab, setTab] = useState<"ports" | "connections" | "firewall">("ports");
  const [ports, setPorts] = useState<ParsedPort[]>([]);
  const [connections, setConnections] = useState<ParsedConnection[]>([]);
  const [firewallRules, setFirewallRules] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleChain, setRuleChain] = useState("INPUT");
  const [ruleProtocol, setRuleProtocol] = useState("tcp");
  const [rulePort, setRulePort] = useState("");
  const [ruleAction, setRuleAction] = useState("ACCEPT");
  const [ruleSource, setRuleSource] = useState("");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "ports") {
        const r = await getOpenPorts();
        setPorts(parsePorts(r.output));
      } else if (tab === "connections") {
        const r = await getActiveConnections();
        setConnections(parseConnections(r.output));
      } else {
        const r = await getIptablesRules();
        setFirewallRules(r.output);
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAddRule = async () => {
    if (!rulePort) return;
    setAdding(true);
    try {
      const src = ruleSource ? `-s ${ruleSource}` : "";
      const cmd = `-A ${ruleChain} -p ${ruleProtocol} --dport ${rulePort} ${src} -j ${ruleAction}`;
      const r = await addIptablesRule(cmd);
      if (r.success) {
        toast({ title: "Rule added" });
        setShowAddRule(false);
        setRulePort("");
        setRuleSource("");
        refresh();
      } else {
        toast({ title: "Failed", description: r.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteRule = async (chain: string, lineNum: string) => {
    try {
      const r = await deleteIptablesRule(`-D ${chain} ${lineNum}`);
      if (r.success) {
        toast({ title: "Rule deleted" });
        refresh();
      } else {
        toast({ title: "Failed", description: r.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const tabs = [
    { id: "ports" as const, label: "Open Ports", icon: Server },
    { id: "connections" as const, label: "Active Connections", icon: ArrowDownUp },
    { id: "firewall" as const, label: "Firewall (iptables)", icon: Shield },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Network & Firewall</h1>
        </div>
        <button onClick={refresh} disabled={loading} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded hover:bg-secondary text-muted-foreground">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Open Ports */}
          {tab === "ports" && (
            <div className="border border-border rounded overflow-hidden">
              <div className="bg-secondary/60 px-3 py-2 flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase text-muted-foreground">Listening Ports ({ports.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Protocol</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Address</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Port</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">State</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Process</th>
                  </tr></thead>
                  <tbody>
                    {ports.map((p, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono">{p.protocol}</td>
                        <td className="px-3 py-2 font-mono">{p.localAddr}</td>
                        <td className="px-3 py-2"><span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">{p.localPort}</span></td>
                        <td className="px-3 py-2"><span className="text-success">{p.state}</span></td>
                        <td className="px-3 py-2 text-muted-foreground">{p.process}</td>
                      </tr>
                    ))}
                    {ports.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No listening ports found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Active Connections */}
          {tab === "connections" && (
            <div className="border border-border rounded overflow-hidden">
              <div className="bg-secondary/60 px-3 py-2 flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase text-muted-foreground">Active Connections ({connections.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Protocol</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Local</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Remote</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">State</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Process</th>
                  </tr></thead>
                  <tbody>
                    {connections.map((c, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono">{c.protocol}</td>
                        <td className="px-3 py-2 font-mono text-foreground">{c.localAddr}</td>
                        <td className="px-3 py-2 font-mono text-accent">{c.remoteAddr}</td>
                        <td className="px-3 py-2"><span className={c.state === "ESTAB" ? "text-success" : "text-muted-foreground"}>{c.state}</span></td>
                        <td className="px-3 py-2 text-muted-foreground">{c.process}</td>
                      </tr>
                    ))}
                    {connections.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No active connections</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Firewall */}
          {tab === "firewall" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAddRule(!showAddRule)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90">
                  <Plus className="h-3 w-3" /> Add Rule
                </button>
              </div>

              {showAddRule && (
                <div className="border border-primary/30 bg-primary/5 rounded p-3 space-y-3">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" /> New Firewall Rule
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground mb-1 block">Chain</label>
                      <select value={ruleChain} onChange={e => setRuleChain(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs">
                        <option>INPUT</option><option>OUTPUT</option><option>FORWARD</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground mb-1 block">Protocol</label>
                      <select value={ruleProtocol} onChange={e => setRuleProtocol(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs">
                        <option>tcp</option><option>udp</option><option>icmp</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground mb-1 block">Port</label>
                      <input value={rulePort} onChange={e => setRulePort(e.target.value)} placeholder="80" className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground mb-1 block">Source IP (opt)</label>
                      <input value={ruleSource} onChange={e => setRuleSource(e.target.value)} placeholder="0.0.0.0/0" className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-muted-foreground mb-1 block">Action</label>
                      <select value={ruleAction} onChange={e => setRuleAction(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs">
                        <option>ACCEPT</option><option>DROP</option><option>REJECT</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddRule} disabled={adding || !rulePort} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-success text-success-foreground rounded hover:bg-success/90 disabled:opacity-50">
                      {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />} Apply Rule
                    </button>
                    <button onClick={() => setShowAddRule(false)} className="text-xs px-3 py-1.5 border border-border rounded text-muted-foreground hover:bg-secondary">Cancel</button>
                  </div>
                  <p className="text-[10px] text-warning flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Firewall changes are immediate. Incorrect rules can lock you out.</p>
                </div>
              )}

              <div className="border border-border rounded overflow-hidden">
                <div className="bg-secondary/60 px-3 py-2 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">iptables Rules</span>
                </div>
                <pre className="p-3 text-xs font-mono overflow-auto max-h-[500px] terminal-scrollbar whitespace-pre text-foreground/80">
                  {firewallRules || "No rules found or insufficient permissions."}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}