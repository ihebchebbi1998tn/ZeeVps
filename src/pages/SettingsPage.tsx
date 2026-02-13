import { useState, useEffect } from "react";
import { testConnection } from "@/lib/ssh-api";
import { getVpsConfig, setVpsConfig, clearVpsConfig, VpsConfig } from "@/lib/vps-config";
import { Loader2, CheckCircle, XCircle, Pencil, LogOut, Settings } from "lucide-react";

export default function SettingsPage() {
  const [config, setConfig] = useState<VpsConfig | null>(null);
  const [editing, setEditing] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; hostname?: string; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = getVpsConfig();
    setConfig(c);
    if (c) {
      setHost(c.host);
      setPort(String(c.port));
      setUsername(c.username);
      setPassword(c.password);
    }
  }, []);

  const runTest = async () => {
    setTesting(true);
    try {
      const result = await testConnection();
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : "Failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const newConfig: VpsConfig = {
      host: host.trim(),
      port: parseInt(port) || 22,
      username: username.trim(),
      password,
    };
    setVpsConfig(newConfig);
    setConfig(newConfig);

    try {
      const result = await testConnection();
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : "Failed" });
    }
    setSaving(false);
    setEditing(false);
  };

  const handleDisconnect = () => {
    clearVpsConfig();
    window.location.reload();
  };

  const inputClass = "w-full h-9 px-3 text-sm rounded-lg border border-border/60 bg-background/50 text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <Settings className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Settings</h1>
          <p className="text-xs text-muted-foreground">Manage your SSH connection and preferences</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm overflow-hidden shadow-lg shadow-black/10">
        <div className="bg-secondary/40 px-4 py-3 flex items-center justify-between border-b border-border/40">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SSH Connection</span>
          <div className="flex items-center gap-1.5">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 flex items-center gap-1.5 transition-colors"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
            <button
              onClick={handleDisconnect}
              className="text-xs px-3 py-1.5 rounded-lg text-destructive/80 hover:text-destructive hover:bg-destructive/10 flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="h-3 w-3" /> Disconnect
            </button>
          </div>
        </div>

        {editing ? (
          <div className="p-4 space-y-3.5">
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Host / IP</label>
                <input type="text" value={host} onChange={(e) => setHost(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Port</label>
                <input type="number" value={port} onChange={(e) => setPort(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-colors shadow-md shadow-primary/20"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Save & Test
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-xs px-4 py-2 rounded-lg border border-border/60 text-muted-foreground hover:bg-secondary/60 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {[
              { label: "Host", value: config?.host || "—" },
              { label: "Port", value: String(config?.port || 22) },
              { label: "Username", value: config?.username || "—" },
              { label: "Password", value: "••••••••" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-mono text-foreground">{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-2.5">
                {testResult && (
                  <span className={`flex items-center gap-1.5 text-xs ${testResult.success ? "text-success" : "text-destructive"}`}>
                    {testResult.success ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {testResult.success ? testResult.hostname?.split("\n")[0] : testResult.error}
                  </span>
                )}
                <button
                  onClick={runTest}
                  disabled={testing}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border/60 hover:bg-secondary/60 text-muted-foreground disabled:opacity-50 transition-colors"
                >
                  {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Test"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
        Credentials are stored locally in your browser session. Use "Disconnect" to clear and connect to a different server.
      </p>
    </div>
  );
}
