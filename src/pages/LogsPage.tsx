import { useState, useEffect, useRef } from "react";
import { getSystemLogs, getServiceLogs } from "@/lib/ssh-api";
import { Loader2, AlertCircle, RefreshCw, Search } from "lucide-react";

export default function LogsPage() {
  const [logs, setLogs] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"system" | "service">("system");
  const [serviceName, setServiceName] = useState("backend");
  const [lines, setLines] = useState(200);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLPreElement>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === "system") {
        const data = await getSystemLogs(lines);
        setLogs(data.logs);
      } else {
        const data = await getServiceLogs(serviceName, lines);
        setLogs(data.logs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [mode, serviceName]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const filteredLines = search
    ? logs.split("\n").filter(l => l.toLowerCase().includes(search.toLowerCase())).join("\n")
    : logs;

  const quickServices = ["backend", "nginx", "ssh", "cron", "docker", "mysql", "postgresql"];

  return (
    <div className="space-y-3 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Logs</h1>
        <div className="flex items-center gap-2">
          <select
            value={lines}
            onChange={e => setLines(Number(e.target.value))}
            className="text-xs bg-card border border-border rounded px-2 py-1.5 text-foreground"
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={200}>200 lines</option>
            <option value={500}>500 lines</option>
          </select>
          <button onClick={fetchLogs} className="flex items-center gap-1 text-xs px-3 py-1.5 border border-border rounded hover:bg-secondary text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Mode tabs + service selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex border border-border rounded overflow-hidden text-xs">
          <button onClick={() => setMode("system")} className={`px-3 py-1.5 ${mode === "system" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            System
          </button>
          <button onClick={() => setMode("service")} className={`px-3 py-1.5 ${mode === "service" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            Service
          </button>
        </div>

        {mode === "service" && (
          <div className="flex items-center gap-1">
            {quickServices.map(s => (
              <button
                key={s}
                onClick={() => setServiceName(s)}
                className={`text-xs px-2 py-1 rounded ${serviceName === s ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary border border-border"}`}
              >
                {s}
              </button>
            ))}
            <input
              value={serviceName}
              onChange={e => setServiceName(e.target.value)}
              placeholder="custom..."
              className="text-xs bg-card border border-border rounded px-2 py-1 w-24 text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
        )}

        <div className="flex-1" />

        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter logs..."
            className="text-xs bg-card border border-border rounded pl-7 pr-2 py-1.5 w-48 text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-destructive">{error}</span>
        </div>
      )}

      {/* Log output */}
      <div className="flex-1 border border-border rounded overflow-hidden bg-card">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <pre ref={scrollRef} className="h-full overflow-auto p-3 text-xs font-mono text-foreground/80 terminal-scrollbar leading-5 whitespace-pre-wrap">
            {filteredLines || "No logs found."}
          </pre>
        )}
      </div>
    </div>
  );
}