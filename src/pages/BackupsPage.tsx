import { useState, useEffect } from "react";
import { HardDrive, Loader2, Plus, Trash2, Download, RefreshCw, FolderArchive, Clock } from "lucide-react";
import { executeCommand, listFiles, RemoteFile } from "@/lib/ssh-api";
import { toast } from "sonner";

interface BackupEntry {
  name: string;
  size: string;
  date: string;
  path: string;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [backupDir] = useState("/root/zeevps-backups");
  const [sourcePath, setSourcePath] = useState("/etc");
  const [backupName, setBackupName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      await executeCommand(`mkdir -p ${backupDir}`);
      const result = await executeCommand(`ls -lh ${backupDir}/*.tar.gz 2>/dev/null | awk '{print $5, $6, $7, $8, $9}'`);
      const entries: BackupEntry[] = [];
      if (result.output.trim()) {
        result.output.trim().split("\n").forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const path = parts[4] || parts[3];
            entries.push({
              size: parts[0],
              date: `${parts[1]} ${parts[2]} ${parts[3]}`,
              name: path.split("/").pop() || path,
              path,
            });
          }
        });
      }
      setBackups(entries);
    } catch { toast.error("Failed to load backups"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadBackups(); }, []);

  const createBackup = async () => {
    if (!sourcePath.trim()) return;
    setCreating(true);
    const name = backupName.trim() || `backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
    const fullName = `${name}.tar.gz`;
    try {
      const result = await executeCommand(
        `tar -czf ${backupDir}/${fullName} ${sourcePath} 2>&1 && echo "BACKUP_OK" || echo "BACKUP_FAIL"`
      );
      if (result.output.includes("BACKUP_OK")) {
        toast.success(`Backup "${fullName}" created`);
        setShowCreate(false);
        setBackupName("");
        loadBackups();
      } else {
        toast.error("Backup failed: " + result.output);
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const deleteBackup = async (path: string, name: string) => {
    if (!confirm(`Delete backup "${name}"? This cannot be undone.`)) return;
    setDeleting(name);
    try {
      await executeCommand(`rm -f "${path}"`);
      toast.success(`Deleted ${name}`);
      loadBackups();
    } catch (err: any) { toast.error(err.message); }
    finally { setDeleting(null); }
  };

  const restoreBackup = async (path: string) => {
    if (!confirm("Restore this backup? Files will be overwritten in their original locations.")) return;
    try {
      const result = await executeCommand(`tar -xzf "${path}" -C / 2>&1 && echo "RESTORE_OK"`);
      if (result.output.includes("RESTORE_OK")) toast.success("Backup restored");
      else toast.error("Restore failed: " + result.output);
    } catch (err: any) { toast.error(err.message); }
  };

  const inputClass = "w-full h-9 px-3 text-sm rounded-lg border border-border/60 bg-background/50 text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <FolderArchive className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Backup Manager</h1>
            <p className="text-xs text-muted-foreground">Create, manage, and restore server backups</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadBackups} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg border border-border/60 hover:bg-secondary/60 text-muted-foreground flex items-center gap-1.5 transition-colors">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 font-medium transition-colors">
            <Plus className="h-3 w-3" /> New Backup
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 space-y-3 shadow-sm">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Create Backup</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Source Path</label>
              <input type="text" value={sourcePath} onChange={e => setSourcePath(e.target.value)} placeholder="/etc" className={inputClass} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Backup Name (optional)</label>
              <input type="text" value={backupName} onChange={e => setBackupName(e.target.value)} placeholder="Auto-generated" className={inputClass} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createBackup} disabled={creating} className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 font-medium">
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderArchive className="h-3 w-3" />}
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="text-xs px-4 py-2 rounded-lg border border-border/60 text-muted-foreground hover:bg-secondary/60">Cancel</button>
          </div>
          <p className="text-[10px] text-muted-foreground/50">Backups stored in {backupDir}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : backups.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-8 text-center shadow-sm">
          <FolderArchive className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No backups yet</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Create your first backup to protect your server data</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/40 border-b border-border/30">
                <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase text-left">Name</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase text-left">Size</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase text-left">Date</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {backups.map(b => (
                <tr key={b.name} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-foreground text-xs">{b.name}</td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground text-xs">{b.size}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{b.date}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => restoreBackup(b.path)} className="text-[10px] px-2 py-1 rounded border border-border/60 hover:bg-secondary/60 text-muted-foreground transition-colors">
                        Restore
                      </button>
                      <button
                        onClick={() => deleteBackup(b.path, b.name)}
                        disabled={deleting === b.name}
                        className="text-[10px] px-2 py-1 rounded border border-destructive/30 text-destructive/70 hover:bg-destructive/10 transition-colors"
                      >
                        {deleting === b.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
