import { useState, useRef, useEffect, useCallback } from "react";
import { executeCommand, testConnection } from "@/lib/ssh-api";
import { Loader2 } from "lucide-react";

interface TerminalLine {
  type: "input" | "output" | "error" | "system";
  content: string;
}

export default function TerminalPage() {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  // Test connection on mount
  useEffect(() => {
    testConnection().then(res => {
      setConnected(res.success);
      setLines([{
        type: "system",
        content: res.success
          ? `Connected to ${res.hostname?.split("\n")[0] || "server"}`
          : `Connection failed: ${res.error}`
      }]);
    }).catch(err => {
      setLines([{ type: "system", content: `Error: ${err.message}` }]);
    });
  }, []);

  const exec = useCallback(async () => {
    if (!command.trim() || running) return;

    const cmd = command.trim();
    setCommand("");
    setHistory(prev => [cmd, ...prev]);
    setHistIdx(-1);

    if (cmd === "clear") {
      setLines([]);
      return;
    }

    setLines(prev => [...prev, { type: "input", content: `$ ${cmd}` }]);
    setRunning(true);

    try {
      const result = await executeCommand(cmd);
      const output = result.output.trimEnd();
      const stderr = result.stderr.trimEnd();

      if (output) {
        setLines(prev => [...prev, ...output.split("\n").map(l => ({ type: "output" as const, content: l }))]);
      }
      if (stderr) {
        setLines(prev => [...prev, ...stderr.split("\n").map(l => ({ type: "error" as const, content: l }))]);
      }
      if (result.exitCode !== 0 && !output && !stderr) {
        setLines(prev => [...prev, { type: "error", content: `Exit code: ${result.exitCode}` }]);
      }
    } catch (err) {
      setLines(prev => [...prev, { type: "error", content: err instanceof Error ? err.message : "Command failed" }]);
    } finally {
      setRunning(false);
    }
  }, [command, running]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") exec();
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      if (history[idx]) setCommand(history[idx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setCommand(idx === -1 ? "" : history[idx]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Terminal</h1>
          <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-destructive"}`} />
        </div>
        <button onClick={() => setLines([])} className="text-xs px-3 py-1.5 border border-border rounded hover:bg-secondary text-muted-foreground">
          Clear
        </button>
      </div>

      <div className="border border-border rounded overflow-hidden flex flex-col" style={{ height: "calc(100vh - 180px)" }}>
        {/* Output */}
        <div ref={scrollRef} className="flex-1 overflow-auto p-3 font-mono text-xs terminal-scrollbar bg-card">
          {lines.map((line, i) => (
            <div key={i} className="py-px leading-5">
              {line.type === "system" ? (
                <span className="text-primary"># {line.content}</span>
              ) : line.type === "input" ? (
                <span className="text-success">{line.content}</span>
              ) : line.type === "error" ? (
                <span className="text-destructive">{line.content}</span>
              ) : (
                <span className="text-foreground/80">{line.content}</span>
              )}
            </div>
          ))}
          {running && (
            <div className="py-px">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground inline" />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 border-t border-border bg-secondary px-3 py-2">
          <span className="text-xs font-mono text-success">$</span>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            placeholder="Type command..."
            className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
