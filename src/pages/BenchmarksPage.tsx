import { useState } from "react";
import { Zap, Loader2, Play, Cpu, HardDrive, Globe, Clock } from "lucide-react";
import { executeCommand } from "@/lib/ssh-api";
import { toast } from "sonner";

interface BenchmarkResult {
  type: string;
  output: string;
  duration: string;
}

export default function BenchmarksPage() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<BenchmarkResult[]>([]);

  const benchmarks = [
    {
      id: "cpu",
      name: "CPU Benchmark",
      desc: "Single-thread performance using sha256sum hashing",
      icon: Cpu,
      color: "text-primary",
      command: 'echo "=== CPU Benchmark ===" && START=$(date +%s%N) && dd if=/dev/zero bs=1M count=256 2>/dev/null | sha256sum > /dev/null && END=$(date +%s%N) && ELAPSED=$(( (END - START) / 1000000 )) && echo "256MB SHA256 hash: ${ELAPSED}ms" && echo "---" && echo "CPU Info:" && lscpu 2>/dev/null | grep -E "Model name|CPU|Thread|Core|MHz" || cat /proc/cpuinfo | head -20',
    },
    {
      id: "disk_write",
      name: "Disk I/O (Write)",
      desc: "Sequential write speed with dd",
      icon: HardDrive,
      color: "text-amber-400",
      command: 'echo "=== Disk Write Benchmark ===" && dd if=/dev/zero of=/tmp/zeevps_bench bs=1M count=512 conv=fdatasync 2>&1 && rm -f /tmp/zeevps_bench && echo "---" && echo "Disk Info:" && df -hT / 2>/dev/null | head -5',
    },
    {
      id: "disk_read",
      name: "Disk I/O (Read)",
      desc: "Sequential read speed with dd",
      icon: HardDrive,
      color: "text-emerald-400",
      command: 'echo "=== Disk Read Benchmark ===" && dd if=/dev/zero of=/tmp/zeevps_benchr bs=1M count=512 conv=fdatasync 2>/dev/null && echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null 2>&1; dd if=/tmp/zeevps_benchr of=/dev/null bs=1M 2>&1 && rm -f /tmp/zeevps_benchr',
    },
    {
      id: "network",
      name: "Network Speed",
      desc: "Download speed test via curl",
      icon: Globe,
      color: "text-sky-400",
      command: 'echo "=== Network Speed Test ===" && if command -v speedtest-cli &>/dev/null; then speedtest-cli --simple 2>&1; elif command -v curl &>/dev/null; then echo "Download test (100MB):" && curl -so /dev/null -w "Speed: %{speed_download} bytes/sec\\nTime: %{time_total}s\\n" http://speedtest.tele2.net/100MB.zip 2>&1; else echo "No speedtest or curl available"; fi',
    },
    {
      id: "memory",
      name: "Memory Benchmark",
      desc: "Memory allocation and access speed test",
      icon: Cpu,
      color: "text-violet-400",
      command: 'echo "=== Memory Benchmark ===" && dd if=/dev/zero of=/dev/null bs=1M count=2048 2>&1 && echo "---" && free -h 2>/dev/null',
    },
    {
      id: "system",
      name: "System Info",
      desc: "Complete hardware and system overview",
      icon: Clock,
      color: "text-teal-400",
      command: 'echo "=== System Overview ===" && uname -a && echo "---" && echo "CPU:" && lscpu 2>/dev/null | grep -E "Model name|CPU|Thread|Core|Cache|MHz" || echo "N/A" && echo "---" && echo "Memory:" && free -h && echo "---" && echo "Disk:" && df -hT / && echo "---" && echo "Uptime:" && uptime',
    },
  ];

  const runBenchmark = async (id: string, command: string) => {
    setRunning(id);
    const start = Date.now();
    try {
      const result = await executeCommand(command);
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      setResults(prev => [
        { type: id, output: result.output || result.stderr || "No output", duration: `${duration}s` },
        ...prev.filter(r => r.type !== id),
      ]);
      toast.success(`${id} benchmark completed`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRunning(null);
    }
  };

  const runAll = async () => {
    for (const b of benchmarks) {
      await runBenchmark(b.id, b.command);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">System Benchmarks</h1>
            <p className="text-xs text-muted-foreground">Test your server's CPU, disk, memory & network performance</p>
          </div>
        </div>
        <button
          onClick={runAll}
          disabled={!!running}
          className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-colors"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Run All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {benchmarks.map(b => {
          const result = results.find(r => r.type === b.id);
          return (
            <div key={b.id} className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm overflow-hidden shadow-sm">
              <div className="px-4 py-3 flex items-center justify-between bg-secondary/30 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <b.icon className={`h-3.5 w-3.5 ${b.color}`} />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground/60">{b.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {result && <span className="text-[10px] text-muted-foreground font-mono">{result.duration}</span>}
                  <button
                    onClick={() => runBenchmark(b.id, b.command)}
                    disabled={!!running}
                    className="text-[10px] px-2.5 py-1 rounded-md border border-border/60 hover:bg-secondary/60 text-muted-foreground disabled:opacity-50 transition-colors"
                  >
                    {running === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run"}
                  </button>
                </div>
              </div>
              {result && (
                <pre className="p-3 text-[11px] font-mono text-muted-foreground leading-relaxed max-h-48 overflow-auto terminal-scrollbar whitespace-pre-wrap">
                  {result.output}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
