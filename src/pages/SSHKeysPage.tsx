import { useState, useEffect } from "react";
import { Lock, Loader2, Plus, Trash2, RefreshCw, Key, Copy, Check } from "lucide-react";
import { executeCommand } from "@/lib/ssh-api";
import { toast } from "sonner";

interface SSHKey {
  type: string;
  key: string;
  comment: string;
  fingerprint: string;
}

export default function SSHKeysPage() {
  const [keys, setKeys] = useState<SSHKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<{ pub: string; priv: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const result = await executeCommand("cat ~/.ssh/authorized_keys 2>/dev/null || echo ''");
      const lines = result.output.trim().split("\n").filter(l => l.trim() && !l.startsWith("#"));
      const parsed: SSHKey[] = [];
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const fpResult = await executeCommand(`echo "${line}" | ssh-keygen -lf /dev/stdin 2>/dev/null || echo "unknown"`);
          parsed.push({
            type: parts[0],
            key: parts[1].substring(0, 40) + "...",
            comment: parts.slice(2).join(" ") || "no comment",
            fingerprint: fpResult.output.trim().split(/\s+/)[1] || "unknown",
          });
        }
      }
      setKeys(parsed);
    } catch { toast.error("Failed to load SSH keys"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadKeys(); }, []);

  const addKey = async () => {
    if (!newKey.trim()) return;
    setAdding(true);
    try {
      await executeCommand(`mkdir -p ~/.ssh && chmod 700 ~/.ssh`);
      const escaped = newKey.trim().replace(/'/g, "'\\''");
      const result = await executeCommand(`echo '${escaped}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo "KEY_ADDED"`);
      if (result.output.includes("KEY_ADDED")) {
        toast.success("SSH key added");
        setNewKey("");
        setShowAdd(false);
        loadKeys();
      } else {
        toast.error("Failed to add key");
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setAdding(false); }
  };

  const deleteKey = async (index: number) => {
    if (!confirm("Remove this SSH key? The user won't be able to authenticate with it anymore.")) return;
    setDeleting(index);
    try {
      const result = await executeCommand(`sed -i '${index + 1}d' ~/.ssh/authorized_keys 2>&1 && echo "KEY_DELETED"`);
      if (result.output.includes("KEY_DELETED")) {
        toast.success("Key removed");
        loadKeys();
      } else toast.error("Failed to remove key");
    } catch (err: any) { toast.error(err.message); }
    finally { setDeleting(null); }
  };

  const generateKeyPair = async () => {
    setGenerating(true);
    try {
      const result = await executeCommand(
        `rm -f /tmp/zeevps_key /tmp/zeevps_key.pub && ssh-keygen -t ed25519 -f /tmp/zeevps_key -N "" -C "zeevps-generated" 2>&1 && echo "---PUB---" && cat /tmp/zeevps_key.pub && echo "---PRIV---" && cat /tmp/zeevps_key && rm -f /tmp/zeevps_key /tmp/zeevps_key.pub`
      );
      const pubMatch = result.output.match(/---PUB---\n([\s\S]*?)---PRIV---/);
      const privMatch = result.output.match(/---PRIV---\n([\s\S]*?)$/);
      if (pubMatch && privMatch) {
        setGeneratedKey({ pub: pubMatch[1].trim(), priv: privMatch[1].trim() });
        toast.success("Key pair generated");
      } else {
        toast.error("Key generation failed");
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const inputClass = "w-full px-3 py-2 text-sm rounded-lg border border-border/60 bg-background/50 text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <Key className="h-4 w-4 text-rose-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">SSH Key Manager</h1>
            <p className="text-xs text-muted-foreground">Manage authorized keys and generate new key pairs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadKeys} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg border border-border/60 hover:bg-secondary/60 text-muted-foreground flex items-center gap-1.5 transition-colors">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={generateKeyPair} disabled={generating} className="text-xs px-3 py-1.5 rounded-lg border border-border/60 hover:bg-secondary/60 text-muted-foreground flex items-center gap-1.5 transition-colors">
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />} Generate Pair
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 font-medium transition-colors">
            <Plus className="h-3 w-3" /> Add Key
          </button>
        </div>
      </div>

      {generatedKey && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 shadow-sm">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Generated Key Pair</h3>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">Public Key</span>
              <button onClick={() => copyText(generatedKey.pub, "pub")} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                {copied === "pub" ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />} Copy
              </button>
            </div>
            <pre className="text-[10px] font-mono p-2 rounded bg-background/50 border border-border/40 overflow-x-auto">{generatedKey.pub}</pre>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">Private Key (save securely!)</span>
              <button onClick={() => copyText(generatedKey.priv, "priv")} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                {copied === "priv" ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />} Copy
              </button>
            </div>
            <pre className="text-[10px] font-mono p-2 rounded bg-background/50 border border-border/40 overflow-x-auto max-h-32">{generatedKey.priv}</pre>
          </div>
          <button onClick={() => setGeneratedKey(null)} className="text-[10px] text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}

      {showAdd && (
        <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 space-y-3 shadow-sm">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add Authorized Key</h3>
          <textarea
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            placeholder="ssh-ed25519 AAAA... user@host"
            rows={3}
            className={inputClass + " resize-none"}
          />
          <div className="flex gap-2">
            <button onClick={addKey} disabled={adding} className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 font-medium">
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
            </button>
            <button onClick={() => setShowAdd(false)} className="text-xs px-4 py-2 rounded-lg border border-border/60 text-muted-foreground hover:bg-secondary/60">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-8 text-center shadow-sm">
          <Lock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No authorized SSH keys</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Add public keys to enable key-based authentication</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-3 flex items-center justify-between hover:bg-card/90 transition-colors shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-1.5 rounded-md bg-secondary/60 border border-border/30">
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{k.comment}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{k.type} • {k.fingerprint}</p>
                </div>
              </div>
              <button
                onClick={() => deleteKey(i)}
                disabled={deleting === i}
                className="text-xs px-2.5 py-1 rounded-md border border-destructive/30 text-destructive/70 hover:bg-destructive/10 transition-colors shrink-0"
              >
                {deleting === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
