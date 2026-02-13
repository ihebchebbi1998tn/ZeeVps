import { useState, useEffect } from "react";
import { getProcesses, killProcess, type ProcessInfo } from "@/lib/ssh-api";
import { Loader2, AlertCircle, RefreshCw, Skull, Search, Activity } from "lucide-react";
import { toast } from "sonner";

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [killConfirm, setKillConfirm] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"cpu" | "mem" | "pid">("mem");

  const fetchProcesses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProcesses();
      setProcesses(data.processes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProcesses(); }, []);

  const handleKill = async (pid: string) => {
    try {
      const res = await killProcess(pid);
      if (res.success) {
        toast.success(`Process ${pid} killed`);
        setKillConfirm(null);
        fetchProcesses();
      } else {
        toast.error(res.error || "Kill failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const filtered = processes.filter(p =>
    !search || p.command.toLowerCase().includes(search.toLowerCase()) || p.user.includes(search) || p.pid.includes(search)
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "cpu") return b.cpu - a.cpu;
    if (sortBy === "mem") return b.mem - a.mem;
    return parseInt(a.pid) - parseInt(b.pid);
  });

  return (
    <div className="space-y-3 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Processes</h1>
          {!loading && <span className="text-xs text-muted-foreground">({processes.length} total)</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="text-xs bg-card border border-border rounded pl-7 pr-2 py-1.5 w-40 text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <button onClick={fetchProcesses} className="flex items-center gap-1 text-xs px-3 py-1.5 border border-border rounded hover:bg-secondary text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-destructive">{error}</span>
        </div>
      )}

      <div className="flex-1 border border-border rounded overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-auto h-full terminal-scrollbar">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-secondary text-left">
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase w-16 cursor-pointer hover:text-foreground" onClick={() => setSortBy("pid")}>PID</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase w-20">User</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase w-20 cursor-pointer hover:text-foreground" onClick={() => setSortBy("cpu")}>
                    CPU% {sortBy === "cpu" && "▾"}
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase w-20 cursor-pointer hover:text-foreground" onClick={() => setSortBy("mem")}>
                    MEM% {sortBy === "mem" && "▾"}
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase w-16">Stat</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase w-20">Time</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Command</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((p, i) => (
                  <tr key={i} className="hover:bg-secondary/50 group">
                    <td className="px-3 py-1.5 font-mono text-xs text-foreground">{p.pid}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{p.user}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-2 bg-muted rounded-sm overflow-hidden">
                          <div className={`h-full ${p.cpu > 50 ? "bg-destructive" : p.cpu > 10 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(p.cpu, 100)}%` }} />
                        </div>
                        <span className="text-foreground">{p.cpu}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-2 bg-muted rounded-sm overflow-hidden">
                          <div className={`h-full ${p.mem > 50 ? "bg-destructive" : p.mem > 10 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(p.mem, 100)}%` }} />
                        </div>
                        <span className="text-foreground">{p.mem}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{p.stat}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{p.time}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-foreground truncate max-w-xs" title={p.command}>{p.command}</td>
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => setKillConfirm(p.pid)}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded transition-opacity"
                        title="Kill process"
                      >
                        <Skull className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Kill confirmation */}
      {killConfirm && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50" onClick={() => setKillConfirm(null)}>
          <div className="bg-card border border-border rounded-lg p-4 max-w-sm w-full mx-4 shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground mb-2">Kill Process</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Are you sure you want to kill PID <span className="font-mono text-destructive">{killConfirm}</span>? This sends SIGKILL (-9).
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setKillConfirm(null)} className="text-xs px-3 py-1.5 border border-border rounded hover:bg-secondary">Cancel</button>
              <button onClick={() => handleKill(killConfirm)} className="text-xs px-3 py-1.5 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90">Kill</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}