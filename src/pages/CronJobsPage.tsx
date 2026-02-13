import { useState, useEffect, useCallback } from "react";
import { getCronJobs, saveCrontab, deleteCronJob } from "@/lib/ssh-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, Plus, Trash2, Save, RefreshCw, Calendar,
  Play, AlertTriangle, FileText, Timer, X, Globe, Link, ArrowUpDown
} from "lucide-react";

interface CronEntry {
  raw: string;
  minute: string;
  hour: string;
  day: string;
  month: string;
  weekday: string;
  command: string;
  isComment: boolean;
  isVariable: boolean;
}

function parseCrontab(text: string): CronEntry[] {
  return text.split("\n").filter(l => l.trim()).map(raw => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("#")) return { raw, minute: "", hour: "", day: "", month: "", weekday: "", command: trimmed, isComment: true, isVariable: false };
    if (trimmed.includes("=") && !trimmed.match(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+/)) return { raw, minute: "", hour: "", day: "", month: "", weekday: "", command: trimmed, isComment: false, isVariable: true };
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 6) {
      return { raw, minute: parts[0], hour: parts[1], day: parts[2], month: parts[3], weekday: parts[4], command: parts.slice(5).join(" "), isComment: false, isVariable: false };
    }
    return { raw, minute: "", hour: "", day: "", month: "", weekday: "", command: trimmed, isComment: true, isVariable: false };
  });
}

function describeSchedule(m: string, h: string, d: string, mo: string, w: string): string {
  if (m === "*" && h === "*" && d === "*" && mo === "*" && w === "*") return "Every minute";
  if (m === "0" && h === "*" && d === "*" && mo === "*" && w === "*") return "Every hour";
  if (m === "0" && h === "0" && d === "*" && mo === "*" && w === "*") return "Daily at midnight";
  if (m === "0" && h === "0" && d === "*" && mo === "*" && w === "0") return "Weekly on Sunday";
  if (m === "0" && h === "0" && d === "1" && mo === "*" && w === "*") return "Monthly on the 1st";
  if (m.startsWith("*/")) return `Every ${m.slice(2)} minutes`;
  if (h.startsWith("*/")) return `Every ${h.slice(2)} hours`;
  let desc = "";
  if (h !== "*" && m !== "*") desc = `At ${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  else if (m !== "*") desc = `At minute ${m}`;
  if (w !== "*") desc += ` on ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parseInt(w)] || w}`;
  if (d !== "*") desc += ` on day ${d}`;
  return desc || `${m} ${h} ${d} ${mo} ${w}`;
}

function detectJobType(command: string): "http" | "script" {
  if (command.includes("curl ") || command.includes("wget ") || command.includes("http://") || command.includes("https://")) return "http";
  return "script";
}

function parseHttpDetails(command: string): { method: string; url: string; headers: string; body: string } {
  let method = "GET";
  let url = "";
  let headers = "";
  let body = "";
  
  const urlMatch = command.match(/(https?:\/\/[^\s'"]+)/);
  if (urlMatch) url = urlMatch[1];
  
  const methodMatch = command.match(/-X\s+(\w+)/);
  if (methodMatch) method = methodMatch[1].toUpperCase();
  else if (command.includes("-d ") || command.includes("--data")) method = "POST";
  
  const headerMatches = command.matchAll(/-H\s+['"]([^'"]+)['"]/g);
  for (const m of headerMatches) headers += (headers ? "\n" : "") + m[1];
  
  const bodyMatch = command.match(/-d\s+['"]([^'"]*)['"]/);
  if (bodyMatch) body = bodyMatch[1];
  
  return { method, url, headers, body };
}

const PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 3 AM", value: "0 3 * * *" },
  { label: "Weekly Sunday", value: "0 0 * * 0" },
  { label: "Monthly 1st", value: "0 0 1 * *" },
  { label: "On reboot", value: "@reboot" },
];

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  PUT: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  PATCH: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/20",
  HEAD: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  OPTIONS: "bg-gray-500/15 text-gray-400 border-gray-500/20",
};

export default function CronJobsPage() {
  const [userCron, setUserCron] = useState("");
  const [systemCron, setSystemCron] = useState("");
  const [entries, setEntries] = useState<CronEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newMinute, setNewMinute] = useState("*");
  const [newHour, setNewHour] = useState("*");
  const [newDay, setNewDay] = useState("*");
  const [newMonth, setNewMonth] = useState("*");
  const [newWeekday, setNewWeekday] = useState("*");
  const [newCommand, setNewCommand] = useState("");
  // HTTP cron job fields
  const [jobType, setJobType] = useState<"script" | "http">("script");
  const [httpMethod, setHttpMethod] = useState("GET");
  const [httpUrl, setHttpUrl] = useState("");
  const [httpHeaders, setHttpHeaders] = useState("");
  const [httpBody, setHttpBody] = useState("");
  const [httpContentType, setHttpContentType] = useState("application/json");
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCronJobs();
      setUserCron(data.userCron);
      setSystemCron(data.systemCron);
      setEntries(parseCrontab(data.userCron));
      setRawText(data.userCron);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const buildCurlCommand = (): string => {
    if (!httpUrl.trim()) return "";
    let cmd = `curl -s -o /dev/null -w '\\%{http_code}'`;
    if (httpMethod !== "GET") cmd += ` -X ${httpMethod}`;
    if (httpContentType) cmd += ` -H 'Content-Type: ${httpContentType}'`;
    if (httpHeaders.trim()) {
      httpHeaders.split("\n").filter(h => h.trim()).forEach(h => {
        cmd += ` -H '${h.trim()}'`;
      });
    }
    if (httpBody.trim() && ["POST", "PUT", "PATCH"].includes(httpMethod)) {
      cmd += ` -d '${httpBody.trim()}'`;
    }
    cmd += ` '${httpUrl.trim()}'`;
    return cmd;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const content = rawMode ? rawText : entries.map(e => e.raw).join("\n");
      const res = await saveCrontab(content);
      if (res.success) {
        toast({ title: "Saved", description: "Crontab updated successfully" });
        load();
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: CronEntry) => {
    try {
      const res = await deleteCronJob(entry.raw);
      if (res.success) {
        toast({ title: "Deleted", description: "Cron job removed" });
        load();
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAdd = async () => {
    let command = "";
    if (jobType === "http") {
      command = buildCurlCommand();
      if (!command) return;
    } else {
      command = newCommand.trim();
      if (!command) return;
    }
    const schedule = `${newMinute} ${newHour} ${newDay} ${newMonth} ${newWeekday}`;
    const newLine = `${schedule} ${command}`;
    const updated = userCron.trim() ? `${userCron.trim()}\n${newLine}` : newLine;
    setSaving(true);
    try {
      const res = await saveCrontab(updated);
      if (res.success) {
        toast({ title: "Added", description: "New cron job created" });
        setShowAdd(false);
        setNewCommand("");
        setHttpUrl("");
        setHttpBody("");
        setHttpHeaders("");
        load();
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (val: string) => {
    if (val === "@reboot") {
      setNewMinute("@reboot");
      setNewHour(""); setNewDay(""); setNewMonth(""); setNewWeekday("");
      return;
    }
    const p = val.split(" ");
    setNewMinute(p[0]); setNewHour(p[1]); setNewDay(p[2]); setNewMonth(p[3]); setNewWeekday(p[4]);
  };

  const activeJobs = entries.filter(e => !e.isComment && !e.isVariable);
  const variables = entries.filter(e => e.isVariable);

  const canAdd = jobType === "http" ? !!httpUrl.trim() : !!newCommand.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Cron Jobs</h1>
          <Badge variant="outline" className="text-xs">{activeJobs.length} active</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRawMode(!rawMode)}>
            {rawMode ? <Calendar className="h-3.5 w-3.5 mr-1.5" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
            {rawMode ? "Visual" : "Raw"}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
            {showAdd ? "Cancel" : "Add Job"}
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4" />New Cron Job</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Job Type Toggle */}
            <div className="flex items-center gap-1 p-0.5 bg-secondary/60 rounded w-fit">
              <button onClick={() => setJobType("script")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${jobType === "script" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <FileText className="h-3 w-3" /> Script / Command
              </button>
              <button onClick={() => setJobType("http")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${jobType === "http" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Globe className="h-3 w-3" /> HTTP Request
              </button>
            </div>

            {/* Schedule Preset */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Preset Schedule</label>
              <Select onValueChange={applyPreset}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose a preset..." /></SelectTrigger>
                <SelectContent>
                  {PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label} ({p.value})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Schedule Fields */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "Minute", val: newMinute, set: setNewMinute, hint: "0-59, */n, *" },
                { label: "Hour", val: newHour, set: setNewHour, hint: "0-23, */n, *" },
                { label: "Day", val: newDay, set: setNewDay, hint: "1-31, */n, *" },
                { label: "Month", val: newMonth, set: setNewMonth, hint: "1-12, */n, *" },
                { label: "Weekday", val: newWeekday, set: setNewWeekday, hint: "0-6 (Sun=0)" },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">{f.label}</label>
                  <Input className="h-8 text-xs font-mono" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.hint} />
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Timer className="h-3 w-3" />
              {describeSchedule(newMinute, newHour, newDay, newMonth, newWeekday)}
            </div>

            {/* Command or HTTP */}
            {jobType === "script" ? (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Command</label>
                <Input className="h-8 text-xs font-mono" value={newCommand} onChange={e => setNewCommand(e.target.value)} placeholder="/path/to/script.sh" />
              </div>
            ) : (
              <div className="space-y-3 border border-border rounded p-3 bg-background/50">
                {/* Method + URL */}
                <div className="flex gap-2">
                  <div className="w-32">
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Method</label>
                    <Select value={httpMethod} onValueChange={setHttpMethod}>
                      <SelectTrigger className="h-8 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HTTP_METHODS.map(m => (
                          <SelectItem key={m} value={m}>
                            <span className="font-mono font-semibold">{m}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground block mb-0.5">URL</label>
                    <Input className="h-8 text-xs font-mono" value={httpUrl} onChange={e => setHttpUrl(e.target.value)} placeholder="https://api.example.com/webhook" />
                  </div>
                </div>

                {/* Content Type */}
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Content-Type</label>
                  <Select value={httpContentType} onValueChange={setHttpContentType}>
                    <SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="application/json">application/json</SelectItem>
                      <SelectItem value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</SelectItem>
                      <SelectItem value="text/plain">text/plain</SelectItem>
                      <SelectItem value="text/xml">text/xml</SelectItem>
                      <SelectItem value="">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Headers */}
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Custom Headers <span className="opacity-50">(one per line: Key: Value)</span></label>
                  <Textarea className="min-h-[50px] text-xs font-mono bg-background" value={httpHeaders} onChange={e => setHttpHeaders(e.target.value)}
                    placeholder={"Authorization: Bearer token123\nX-Custom-Header: value"} />
                </div>

                {/* Body (only for POST, PUT, PATCH) */}
                {["POST", "PUT", "PATCH"].includes(httpMethod) && (
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Request Body</label>
                    <Textarea className="min-h-[60px] text-xs font-mono bg-background" value={httpBody} onChange={e => setHttpBody(e.target.value)}
                      placeholder={'{"key": "value"}'} />
                  </div>
                )}

                {/* Generated curl preview */}
                {httpUrl.trim() && (
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Generated Command</label>
                    <pre className="text-[10px] font-mono text-foreground/70 bg-secondary/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                      {buildCurlCommand()}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <Button size="sm" onClick={handleAdd} disabled={saving || !canAdd}>
              <Play className="h-3.5 w-3.5 mr-1.5" />{saving ? "Saving..." : "Add Job"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="user" className="space-y-3">
        <TabsList className="h-8">
          <TabsTrigger value="user" className="text-xs h-7">User Crontab</TabsTrigger>
          <TabsTrigger value="system" className="text-xs h-7">System Cron</TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="space-y-3">
          {rawMode ? (
            <Card>
              <CardContent className="p-3 space-y-2">
                <Textarea className="min-h-[300px] font-mono text-xs bg-background" value={rawText} onChange={e => setRawText(e.target.value)} />
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />{saving ? "Saving..." : "Save Crontab"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {loading ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Loading crontab...</CardContent></Card>
              ) : activeJobs.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <Clock className="h-8 w-8 opacity-30" />
                  <p>No cron jobs configured</p>
                  <p className="text-xs">Click "Add Job" to create your first scheduled task</p>
                </CardContent></Card>
              ) : (
                <>
                  {variables.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Environment Variables</CardTitle></CardHeader>
                      <CardContent className="p-3 pt-0 space-y-1">
                        {variables.map((e, i) => (
                          <div key={i} className="flex items-center gap-2 py-1 px-2 rounded bg-muted/30 font-mono text-xs">
                            <code className="text-foreground">{e.command}</code>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  {activeJobs.map((entry, i) => {
                    const type = detectJobType(entry.command);
                    const httpInfo = type === "http" ? parseHttpDetails(entry.command) : null;
                    return (
                      <Card key={i} className="hover:border-primary/20 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className="text-[10px] font-mono bg-primary/10 text-primary border-0 shrink-0">
                                  {entry.minute} {entry.hour} {entry.day} {entry.month} {entry.weekday}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {describeSchedule(entry.minute, entry.hour, entry.day, entry.month, entry.weekday)}
                                </span>
                                {type === "http" && (
                                  <Badge variant="outline" className={`text-[9px] font-mono border ${METHOD_COLORS[httpInfo?.method || "GET"] || ""}`}>
                                    {httpInfo?.method || "GET"}
                                  </Badge>
                                )}
                                <Badge variant="outline" className={`text-[9px] ${type === "http" ? "border-blue-500/20 text-blue-400" : "border-border text-muted-foreground"}`}>
                                  {type === "http" ? <><Globe className="h-2.5 w-2.5 mr-0.5" /> HTTP</> : <><FileText className="h-2.5 w-2.5 mr-0.5" /> Script</>}
                                </Badge>
                              </div>
                              {type === "http" && httpInfo?.url ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <Link className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <code className="text-xs font-mono text-primary break-all">{httpInfo.url}</code>
                                  </div>
                                  <code className="text-[10px] font-mono text-muted-foreground break-all block pl-[18px]">{entry.command}</code>
                                </div>
                              ) : (
                                <code className="text-xs font-mono text-foreground break-all">{entry.command}</code>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={() => handleDelete(entry)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="system" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-accent" />System Cron Files (read-only)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-[400px] overflow-auto terminal-scrollbar">
                {systemCron || "No system cron files found"}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
