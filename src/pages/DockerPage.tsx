import { useState, useEffect, useCallback } from "react";
import {
  getDockerContainers, getDockerImages, dockerAction, dockerInspect,
  getDockerStats, dockerPull, getDockerNetworks, getDockerVolumes,
  DockerContainer, DockerImage
} from "@/lib/ssh-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Box, Play, Square, RotateCw, Trash2, RefreshCw, Search, Download,
  Layers, Network, HardDrive, Info, Pause, PlayCircle, Eye,
  AlertTriangle, CheckCircle2, XCircle, Clock, Container
} from "lucide-react";

function stateColor(state: string) {
  if (state === "running") return "text-green-400";
  if (state === "paused") return "text-yellow-400";
  if (state === "exited") return "text-red-400";
  return "text-muted-foreground";
}

function StateIcon({ state }: { state: string }) {
  if (state === "running") return <CheckCircle2 className="h-4 w-4 text-green-400" />;
  if (state === "paused") return <Pause className="h-4 w-4 text-yellow-400" />;
  if (state === "exited") return <XCircle className="h-4 w-4 text-red-400" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

export default function DockerPage() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [volumes, setVolumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dockerError, setDockerError] = useState("");
  const [search, setSearch] = useState("");
  const [pullImage, setPullImage] = useState("");
  const [pulling, setPulling] = useState(false);
  const [inspectData, setInspectData] = useState<any>(null);
  const [logsData, setLogsData] = useState<{ name: string; logs: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const loadAll = useCallback(async () => {
    setLoading(true);
    setDockerError("");
    try {
      const [cRes, iRes, sRes, nRes, vRes] = await Promise.all([
        getDockerContainers(), getDockerImages(), getDockerStats(),
        getDockerNetworks(), getDockerVolumes()
      ]);
      if (cRes.error) { setDockerError(cRes.error); return; }
      setContainers(cRes.containers || []);
      setImages(iRes.images || []);
      setStats(sRes.stats || []);
      setNetworks(nRes.networks || []);
      setVolumes(vRes.volumes || []);
    } catch (e: any) {
      setDockerError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleAction = async (action: string, name: string) => {
    setActionLoading(`${action}-${name}`);
    try {
      if (action === "logs") {
        const res = await dockerAction("logs", name);
        setLogsData({ name, logs: res.output || res.error || "No logs" });
      } else if (action === "inspect") {
        const res = await dockerInspect(name);
        setInspectData(res.data);
      } else {
        const res = await dockerAction(action, name);
        if (res.success) {
          toast({ title: "Success", description: `${action} on ${name} completed` });
          loadAll();
        } else {
          toast({ title: "Error", description: res.error, variant: "destructive" });
        }
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePull = async () => {
    if (!pullImage.trim()) return;
    setPulling(true);
    try {
      const res = await dockerPull(pullImage.trim());
      if (res.success) {
        toast({ title: "Pulled", description: `Image ${pullImage} pulled successfully` });
        setPullImage("");
        loadAll();
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPulling(false);
    }
  };

  const filtered = containers.filter(c =>
    c.Names?.toLowerCase().includes(search.toLowerCase()) ||
    c.Image?.toLowerCase().includes(search.toLowerCase())
  );

  const running = containers.filter(c => c.State === "running").length;
  const stopped = containers.filter(c => c.State === "exited").length;
  const paused = containers.filter(c => c.State === "paused").length;

  const getContainerStats = (name: string) => {
    const cleanName = name.replace(/^\//, "");
    return stats.find(s => s.Name === cleanName || s.Container?.startsWith(name.slice(0, 12)));
  };

  if (dockerError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Box className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Docker Manager</h1>
        </div>
        <Card className="border-destructive/30">
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto opacity-60" />
            <p className="text-foreground font-medium">Docker Not Available</p>
            <p className="text-sm text-muted-foreground">{dockerError}</p>
            <p className="text-xs text-muted-foreground">Make sure Docker is installed and the current user has access to the Docker socket.</p>
            <Button variant="outline" size="sm" onClick={loadAll}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Box className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Docker Manager</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Running", count: running, icon: CheckCircle2, color: "text-green-400" },
          { label: "Stopped", count: stopped, icon: XCircle, color: "text-red-400" },
          { label: "Paused", count: paused, icon: Pause, color: "text-yellow-400" },
          { label: "Images", count: images.length, icon: Layers, color: "text-primary" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-lg font-bold text-foreground">{s.count}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="containers" className="space-y-3">
        <TabsList className="h-8">
          <TabsTrigger value="containers" className="text-xs h-7">Containers</TabsTrigger>
          <TabsTrigger value="images" className="text-xs h-7">Images</TabsTrigger>
          <TabsTrigger value="networks" className="text-xs h-7">Networks</TabsTrigger>
          <TabsTrigger value="volumes" className="text-xs h-7">Volumes</TabsTrigger>
        </TabsList>

        <TabsContent value="containers" className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8 h-8 text-xs" placeholder="Search containers..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Loading containers...</CardContent></Card>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <Box className="h-8 w-8 opacity-30" />
              <p>No containers found</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => {
                const cStats = getContainerStats(c.Names);
                return (
                  <Card key={c.ID} className="hover:border-primary/20 transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <StateIcon state={c.State} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">{c.Names}</span>
                              <Badge variant="outline" className={`text-[10px] ${stateColor(c.State)}`}>{c.State}</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-muted-foreground font-mono">{c.Image}</span>
                              <span className="text-[10px] text-muted-foreground">{c.Status}</span>
                            </div>
                            {c.Ports && <span className="text-[10px] text-muted-foreground mt-0.5 block truncate">{c.Ports}</span>}
                            {cStats && (
                              <div className="flex gap-3 mt-1">
                                <span className="text-[10px] text-muted-foreground">CPU: {cStats.CPUPerc}</span>
                                <span className="text-[10px] text-muted-foreground">MEM: {cStats.MemUsage}</span>
                                <span className="text-[10px] text-muted-foreground">Net I/O: {cStats.NetIO}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.State === "running" ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Stop" onClick={() => handleAction("stop", c.Names)} disabled={actionLoading === `stop-${c.Names}`}>
                                <Square className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Restart" onClick={() => handleAction("restart", c.Names)} disabled={actionLoading === `restart-${c.Names}`}>
                                <RotateCw className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Pause" onClick={() => handleAction("pause", c.Names)} disabled={actionLoading === `pause-${c.Names}`}>
                                <Pause className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : c.State === "paused" ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Unpause" onClick={() => handleAction("unpause", c.Names)} disabled={actionLoading === `unpause-${c.Names}`}>
                              <PlayCircle className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Start" onClick={() => handleAction("start", c.Names)} disabled={actionLoading === `start-${c.Names}`}>
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Logs" onClick={() => handleAction("logs", c.Names)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Inspect" onClick={() => handleAction("inspect", c.Names)}>
                            <Info className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Remove" onClick={() => handleAction("rm", c.Names)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="images" className="space-y-3">
          <div className="flex gap-2">
            <Input className="h-8 text-xs flex-1" placeholder="Image name (e.g., nginx:latest)" value={pullImage} onChange={e => setPullImage(e.target.value)} onKeyDown={e => e.key === "Enter" && handlePull()} />
            <Button size="sm" onClick={handlePull} disabled={pulling || !pullImage.trim()}>
              <Download className="h-3.5 w-3.5 mr-1.5" />{pulling ? "Pulling..." : "Pull"}
            </Button>
          </div>
          {images.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No images found</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {images.map((img, i) => (
                <Card key={i} className="hover:border-primary/20 transition-colors">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Layers className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <span className="text-sm font-medium text-foreground">{img.Repository}</span>
                        <Badge variant="outline" className="ml-2 text-[10px]">{img.Tag}</Badge>
                        <div className="flex gap-3 mt-0.5">
                          <span className="text-[10px] text-muted-foreground font-mono">{img.ID?.slice(0, 12)}</span>
                          <span className="text-[10px] text-muted-foreground">{img.Size}</span>
                          <span className="text-[10px] text-muted-foreground">{img.CreatedAt}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="networks" className="space-y-2">
          {networks.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No networks found</CardContent></Card>
          ) : networks.map((n, i) => (
            <Card key={i}>
              <CardContent className="p-3 flex items-center gap-3">
                <Network className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-sm font-medium text-foreground">{n.Name}</span>
                  <Badge variant="outline" className="ml-2 text-[10px]">{n.Driver}</Badge>
                  <span className="text-[10px] text-muted-foreground ml-2">{n.Scope}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="volumes" className="space-y-2">
          {volumes.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No volumes found</CardContent></Card>
          ) : volumes.map((v, i) => (
            <Card key={i}>
              <CardContent className="p-3 flex items-center gap-3">
                <HardDrive className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-sm font-mono text-foreground text-xs">{v.Name}</span>
                  <Badge variant="outline" className="ml-2 text-[10px]">{v.Driver}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Logs Dialog */}
      <Dialog open={!!logsData} onOpenChange={() => setLogsData(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono">Logs: {logsData?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap p-3">{logsData?.logs}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Inspect Dialog */}
      <Dialog open={!!inspectData} onOpenChange={() => setInspectData(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-sm">Container Details</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap p-3">{JSON.stringify(inspectData, null, 2)}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
