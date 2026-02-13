import { useState, useEffect, useCallback } from "react";
import { installPackage, installScript, uninstallPackage, checkInstalled, executeCommand } from "@/lib/ssh-api";
import {
  Loader2, Download, CheckCircle2, Search, Package, Rocket, AlertCircle, X, RefreshCw, Trash2
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { APPS, APP_CATEGORIES, DEPLOY_TEMPLATES, type AppItem, type DeployTemplate } from "@/lib/app-store-data";

export default function AppStorePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [installing, setInstalling] = useState<string | null>(null);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<AppItem | null>(null);
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [installOutput, setInstallOutput] = useState<{ id: string; output: string } | null>(null);

  // Deploy state
  const [showDeploy, setShowDeploy] = useState(false);
  const [deployTemplate, setDeployTemplate] = useState<DeployTemplate | null>(null);
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [deployDir, setDeployDir] = useState("/home");
  const [deployPort, setDeployPort] = useState("");
  const [customCmd, setCustomCmd] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployLog, setDeployLog] = useState("");

  const checkAll = useCallback(async () => {
    setLoading(true);
    try {
      const cmds = [...new Set(APPS.map(a => a.checkCmd))];
      const allInstalled: Record<string, boolean> = {};
      for (let i = 0; i < cmds.length; i += 10) {
        const batch = cmds.slice(i, i + 10);
        try {
          const r = await checkInstalled(batch);
          Object.assign(allInstalled, r.installed);
        } catch { /* ignore */ }
      }
      const result: Record<string, boolean> = {};
      APPS.forEach(a => { result[a.id] = allInstalled[a.checkCmd] ?? false; });
      setInstalled(result);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { checkAll(); }, [checkAll]);

  const handleInstall = async (app: AppItem) => {
    setInstalling(app.id);
    setInstallOutput(null);
    try {
      let r;
      if (app.script) {
        r = await installScript(app.script);
      } else if (app.pkg) {
        r = await installPackage(app.pkg);
      } else return;

      if (r.success) {
        setInstalled(prev => ({ ...prev, [app.id]: true }));
      } else {
        toast.error(`Failed to install ${app.name}: ${r.error?.slice(0, 150)}`);
        if (r.output || r.error) setInstallOutput({ id: app.id, output: r.output || r.error || "" });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = async (app: AppItem) => {
    setConfirmUninstall(null);
    setUninstalling(app.id);
    try {
      const pkg = app.pkg || app.script;
      if (!pkg) return;
      const r = await uninstallPackage(pkg);
      if (r.success) {
        setInstalled(prev => ({ ...prev, [app.id]: false }));
      } else {
        toast.error(`Failed to uninstall ${app.name}: ${r.error?.slice(0, 150)}`);
        if (r.output || r.error) setInstallOutput({ id: app.id, output: r.output || r.error || "" });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUninstalling(null);
    }
  };

  const selectTemplate = (t: DeployTemplate) => {
    setDeployTemplate(t);
    setDeployPort(t.port || "");
    setCustomCmd(t.id === "custom" ? "" : "");
    setDeployLog("");
  };

  const handleDeploy = async () => {
    if (!gitUrl.trim() || !deployTemplate) return;
    setDeploying(true);
    setDeployLog("Cloning repository...\n");
    try {
      const repoName = gitUrl.split("/").pop()?.replace(".git", "") || "app";
      const targetDir = `${deployDir}/${repoName}`;

      const cloneCmd = `git clone --depth 1 -b ${gitBranch} ${gitUrl.trim()} ${targetDir} 2>&1`;
      const cloneResult = await executeCommand(cloneCmd);
      setDeployLog(prev => prev + cloneResult.output + (cloneResult.stderr || "") + "\n");

      if (cloneResult.exitCode !== 0) {
        setDeployLog(prev => prev + "\n❌ Clone failed.\n");
        setDeploying(false);
        return;
      }

      setDeployLog(prev => prev + "✅ Cloned successfully.\n\nSetting up...\n");

      let setupCmd = "";
      if (deployTemplate.id === "custom") {
        setupCmd = customCmd.replace(/__DIR__/g, targetDir).replace(/__NAME__/g, repoName);
      } else {
        setupCmd = deployTemplate.steps.replace(/__DIR__/g, targetDir).replace(/__NAME__/g, repoName);
      }

      if (setupCmd) {
        const setupResult = await executeCommand(setupCmd);
        setDeployLog(prev => prev + setupResult.output + (setupResult.stderr || "") + "\n");

        if (setupResult.exitCode === 0) {
          setDeployLog(prev => prev + "\n✅ Setup complete!" + (deployPort ? ` App should be running on port ${deployPort}.` : "") + "\n");
        } else {
          setDeployLog(prev => prev + "\n⚠️ Setup finished with warnings. Check output above.\n");
        }
      } else {
        setDeployLog(prev => prev + "✅ Repository cloned to " + targetDir + ". No setup commands configured.\n");
      }

      if (deployPort) {
        try {
          await executeCommand(`sudo ufw allow ${deployPort} 2>/dev/null || true`);
          setDeployLog(prev => prev + `🔓 Port ${deployPort} opened in firewall.\n`);
        } catch { /* ignore */ }
      }
    } catch (e: any) {
      setDeployLog(prev => prev + `\n❌ Error: ${e.message}\n`);
    } finally {
      setDeploying(false);
    }
  };

  const filtered = APPS.filter(a => {
    if (category === "deploy") return false;
    if (category !== "all" && a.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q) || a.tags.some(t => t.includes(q));
    }
    return true;
  });

  const installedCount = Object.values(installed).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">App Store</h1>
          <span className="text-xs text-muted-foreground ml-2">{APPS.length} apps · {installedCount} installed</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowDeploy(!showDeploy); if (!showDeploy) setCategory("deploy"); else setCategory("all"); }}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium transition-colors ${showDeploy ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-secondary"}`}>
            <Rocket className="h-3 w-3" /> Deploy from Git
          </button>
          <button onClick={checkAll} disabled={loading} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded hover:bg-secondary text-muted-foreground">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      {!showDeploy && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search apps by name, description, or tag..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded bg-background" />
        </div>
      )}

      {/* ============ DEPLOY FROM GIT ============ */}
      {showDeploy && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">Clone a GitHub repository, auto-install dependencies, and launch — one click deployment.</div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {DEPLOY_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => selectTemplate(t)}
                className={`border rounded-lg p-3 text-left transition-colors ${deployTemplate?.id === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <t.icon className={`h-4 w-4 ${deployTemplate?.id === t.id ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs font-semibold">{t.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{t.desc}</p>
              </button>
            ))}
          </div>

          {deployTemplate && (
            <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Rocket className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Deploy {deployTemplate.name}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Git Repository URL</label>
                  <input value={gitUrl} onChange={e => setGitUrl(e.target.value)}
                    placeholder="https://github.com/user/repo.git"
                    className="w-full px-2.5 py-1.5 text-xs border border-border rounded bg-background font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Branch</label>
                  <input value={gitBranch} onChange={e => setGitBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-2.5 py-1.5 text-xs border border-border rounded bg-background font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Deploy Directory</label>
                  <input value={deployDir} onChange={e => setDeployDir(e.target.value)}
                    placeholder="/home"
                    className="w-full px-2.5 py-1.5 text-xs border border-border rounded bg-background font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Port (auto-opened in firewall)</label>
                  <input value={deployPort} onChange={e => setDeployPort(e.target.value)}
                    placeholder="3000"
                    className="w-full px-2.5 py-1.5 text-xs border border-border rounded bg-background font-mono" />
                </div>
              </div>

              {deployTemplate.id === "custom" && (
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Custom Setup Commands <span className="opacity-50">(use __DIR__ for repo path, __NAME__ for repo name)</span></label>
                  <textarea value={customCmd} onChange={e => setCustomCmd(e.target.value)}
                    placeholder={`cd __DIR__ && npm install && npm start`}
                    className="w-full px-2.5 py-1.5 text-xs border border-border rounded bg-background font-mono min-h-[60px]" />
                </div>
              )}

              {deployTemplate.id !== "custom" && (
                <details className="text-[10px]">
                  <summary className="text-muted-foreground cursor-pointer hover:text-foreground">View setup commands</summary>
                  <pre className="mt-1 p-2 bg-secondary/50 rounded text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">{deployTemplate.steps}</pre>
                </details>
              )}

              <button onClick={handleDeploy} disabled={deploying || !gitUrl.trim()}
                className="flex items-center gap-1.5 text-xs px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 font-medium">
                {deploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                {deploying ? "Deploying..." : "Clone & Deploy"}
              </button>

              {deployLog && (
                <div className="border border-border rounded overflow-hidden">
                  <div className="bg-secondary/60 px-3 py-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Deploy Output</span>
                    <button onClick={() => setDeployLog("")} className="text-xs text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <pre className="p-3 text-xs font-mono text-foreground/80 overflow-auto max-h-72 terminal-scrollbar whitespace-pre-wrap">{deployLog}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Categories */}
      {!showDeploy && (
        <>
          <div className="flex gap-1 flex-wrap">
            {APP_CATEGORIES.filter(c => c.id !== "deploy").map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${category === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-border"}`}>
                <c.icon className="h-3 w-3" /> {c.label}
                {c.id !== "all" && <span className="text-[10px] opacity-70">({APPS.filter(a => a.category === c.id).length})</span>}
              </button>
            ))}
          </div>

          {/* Apps Grid */}
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No apps found matching "{search}"</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(app => {
                const isInstalled = installed[app.id];
                const isInstalling = installing === app.id;
                const isUninstalling = uninstalling === app.id;
                return (
                  <div key={app.id} className={`border rounded-lg p-3 transition-all ${isInstalled ? "border-success/30 bg-success/5" : "border-border hover:border-primary/30"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${isInstalled ? "bg-success/10" : "bg-secondary"}`}>
                          <app.icon className={`h-4 w-4 ${isInstalled ? "text-success" : "text-primary"}`} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{app.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{app.pkg || app.script}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isInstalling ? (
                          <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded font-medium">
                            <Loader2 className="h-3 w-3 animate-spin" /> Installing...
                          </span>
                        ) : isUninstalling ? (
                          <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 bg-destructive/10 text-destructive border border-destructive/20 rounded font-medium">
                            <Loader2 className="h-3 w-3 animate-spin" /> Removing...
                          </span>
                        ) : isInstalled ? (
                          <>
                            <span className="text-[10px] px-2.5 py-1 rounded border text-success bg-success/10 border-success/20 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Installed
                            </span>
                            <button onClick={() => setConfirmUninstall(app)} disabled={!!uninstalling || !!installing}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 border border-destructive/20 text-destructive rounded hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                              title="Uninstall">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleInstall(app)} disabled={!!installing || !!uninstalling}
                            className="flex items-center gap-1 text-[10px] px-2.5 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                            <Download className="h-3 w-3" /> Install
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{app.desc}</p>
                    <div className="flex flex-wrap gap-1">
                      {app.tags.map(t => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded">{t}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Install Output */}
          {installOutput && (
            <div className="border border-border rounded overflow-hidden">
              <div className="bg-secondary/60 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3 text-destructive" /> Install Log: {installOutput.id}
                </span>
                <button onClick={() => setInstallOutput(null)} className="text-xs text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <pre className="p-3 text-xs font-mono text-foreground/80 overflow-auto max-h-64 terminal-scrollbar whitespace-pre-wrap">{installOutput.output}</pre>
            </div>
          )}
        </>
      )}

      {/* Uninstall Confirmation Dialog */}
      <AlertDialog open={!!confirmUninstall} onOpenChange={(open) => { if (!open) setConfirmUninstall(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uninstall {confirmUninstall?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-mono font-semibold">{confirmUninstall?.pkg || confirmUninstall?.script}</span> from your server and purge its configuration files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmUninstall && handleUninstall(confirmUninstall)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Uninstall
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
