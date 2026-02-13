import { useState, useEffect, useCallback, useRef } from "react";
import { listFiles, readFile, writeFile, deleteFile, renameFile, createFolder, uploadFile, downloadFile, zipDownload, getFileInfo, chmodFile, type RemoteFile } from "@/lib/ssh-api";
import {
  Folder, FileText, Link2, Loader2, AlertCircle, ChevronRight,
  Trash2, Pencil, Plus, Save, X, FolderPlus, Eye, ArrowUp, RefreshCw,
  FileCode, FileImage, FileArchive, File, FileCog, Upload, LayoutGrid, List,
  HardDrive, Home, Server, Database, FolderOpen, FileUp, Monitor,
  Download, Archive, Info, Shield, Search, Copy, ChevronDown, ImageIcon
} from "lucide-react";
import { toast } from "sonner";

const EDITABLE_EXTENSIONS = new Set([
  "txt", "md", "log", "json", "xml", "html", "htm", "css", "scss", "less",
  "js", "ts", "tsx", "jsx", "cs", "py", "rb", "go", "rs", "java", "php",
  "sh", "bash", "zsh", "yml", "yaml", "toml", "ini", "cfg", "conf", "env",
  "sql", "graphql", "dockerfile", "makefile", "gitignore", "editorconfig",
  "csv", "svg", "service", "timer", "socket", "mount", "csproj", "sln",
]);

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "svg", "webp", "ico", "bmp"]);

function isEditable(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const baseName = name.toLowerCase();
  return EDITABLE_EXTENSIONS.has(ext) || ["dockerfile", "makefile", ".gitignore", ".env", "readme"].includes(baseName);
}

function isImage(name: string): boolean {
  return IMAGE_EXTENSIONS.has(name.split(".").pop()?.toLowerCase() || "");
}

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  svg: "image/svg+xml", webp: "image/webp", ico: "image/x-icon", bmp: "image/bmp",
  pdf: "application/pdf", zip: "application/zip", tar: "application/x-tar",
  gz: "application/gzip",
};

function getFileIcon(entry: RemoteFile) {
  if (entry.type === "directory") return <Folder className="h-5 w-5 text-accent" />;
  if (entry.type === "symlink") return <Link2 className="h-5 w-5 text-warning" />;
  const ext = entry.name.split(".").pop()?.toLowerCase() || "";
  if (["js", "ts", "tsx", "jsx", "cs", "py", "json", "xml", "html", "css", "sh", "yml", "yaml", "md"].includes(ext))
    return <FileCode className="h-5 w-5 text-primary" />;
  if (IMAGE_EXTENSIONS.has(ext)) return <FileImage className="h-5 w-5 text-success" />;
  if (["zip", "tar", "gz", "rar", "7z", "bz2"].includes(ext))
    return <FileArchive className="h-5 w-5 text-warning" />;
  if (["conf", "cfg", "ini", "env", "toml"].includes(ext))
    return <FileCog className="h-5 w-5 text-muted-foreground" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function getLargeIcon(entry: RemoteFile) {
  if (entry.type === "directory") return <Folder className="h-10 w-10 text-accent" />;
  if (entry.type === "symlink") return <Link2 className="h-10 w-10 text-warning" />;
  const ext = entry.name.split(".").pop()?.toLowerCase() || "";
  if (["js", "ts", "tsx", "jsx", "cs", "py", "json", "xml", "html", "css", "sh", "yml", "yaml", "md"].includes(ext))
    return <FileCode className="h-10 w-10 text-primary" />;
  if (IMAGE_EXTENSIONS.has(ext)) return <FileImage className="h-10 w-10 text-success" />;
  if (["zip", "tar", "gz", "rar", "7z", "bz2"].includes(ext))
    return <FileArchive className="h-10 w-10 text-warning" />;
  if (["conf", "cfg", "ini", "env", "toml"].includes(ext))
    return <FileCog className="h-10 w-10 text-muted-foreground" />;
  return <File className="h-10 w-10 text-muted-foreground" />;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

export default function FileBrowserPage() {
  const [currentPath, setCurrentPath] = useState("/home");
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<{ content: string; path: string } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState<"name" | "size" | "modified">("name");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ src: string; name: string } | null>(null);
  const [fileInfoData, setFileInfoData] = useState<{ stat: string; fileType: string; path: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showChmod, setShowChmod] = useState<string | null>(null);
  const [chmodValue, setChmodValue] = useState("755");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigate = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setFileContent(null);
    setEditMode(false);
    setSelected(new Set());
    setDeleteConfirm(null);
    setRenamingFile(null);
    setImagePreview(null);
    setFileInfoData(null);
    try {
      const data = await listFiles(path);
      const filtered = data.files.filter(f => f.name !== "." && f.name !== "..");
      setFiles(filtered);
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { navigate("/home"); }, [navigate]);

  const filteredFiles = files.filter(f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (a.type === "directory" && b.type !== "directory") return -1;
    if (a.type !== "directory" && b.type === "directory") return 1;
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "size") return b.size - a.size;
    return b.modified.localeCompare(a.modified);
  });

  const viewFile = async (path: string) => {
    setFileLoading(true);
    setEditMode(false);
    setImagePreview(null);
    try {
      const data = await readFile(path);
      setFileContent(data);
      setEditContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setFileLoading(false);
    }
  };

  const previewImage = async (path: string, name: string) => {
    setFileLoading(true);
    setFileContent(null);
    try {
      const data = await downloadFile(path);
      const ext = name.split(".").pop()?.toLowerCase() || "";
      const mime = MIME_MAP[ext] || "image/png";
      setImagePreview({ src: `data:${mime};base64,${data.data}`, name });
    } catch (err) {
      toast.error("Failed to load image");
    } finally {
      setFileLoading(false);
    }
  };

  const handleSave = async () => {
    if (!fileContent) return;
    setSaving(true);
    try {
      const res = await writeFile(fileContent.path, editContent);
      if (res.success) {
        toast.success("File saved successfully");
        setFileContent({ ...fileContent, content: editContent });
        setEditMode(false);
      } else {
        toast.error(res.error || "Failed to save");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (path: string) => {
    try {
      const res = await deleteFile(path);
      if (res.success) {
        toast.success("Deleted successfully");
        setDeleteConfirm(null);
        if (fileContent?.path === path) setFileContent(null);
        navigate(currentPath);
      } else {
        toast.error(res.error || "Delete failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleRename = async (oldPath: string) => {
    if (!renameValue.trim()) return;
    const dir = oldPath.substring(0, oldPath.lastIndexOf("/"));
    const newPath = `${dir}/${renameValue}`;
    try {
      const res = await renameFile(oldPath, newPath);
      if (res.success) {
        toast.success("Renamed successfully");
        setRenamingFile(null);
        navigate(currentPath);
      } else {
        toast.error(res.error || "Rename failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    }
  };

  const handleNewFolder = async () => {
    if (!newFolderName.trim()) return;
    const path = currentPath === "/" ? `/${newFolderName}` : `${currentPath}/${newFolderName}`;
    try {
      const res = await createFolder(path);
      if (res.success) {
        toast.success("Folder created");
        setShowNewFolder(false);
        setNewFolderName("");
        navigate(currentPath);
      } else {
        toast.error(res.error || "Failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleUploadFiles = async (fileList: FileList) => {
    if (fileList.length === 0) return;
    setUploading(true);
    let successCount = 0;
    let failCount = 0;
    for (const file of Array.from(fileList)) {
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const b64 = result.split(",")[1];
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const targetPath = currentPath === "/" ? `/${file.name}` : `${currentPath}/${file.name}`;
        const res = await uploadFile(targetPath, base64);
        if (res.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setUploading(false);
    if (successCount > 0) toast.success(`Uploaded ${successCount} file(s)`);
    if (failCount > 0) toast.error(`Failed to upload ${failCount} file(s)`);
    navigate(currentPath);
  };

  const handleDownloadFile = async (path: string, name: string) => {
    setDownloading(true);
    try {
      const data = await downloadFile(path);
      const ext = name.split(".").pop()?.toLowerCase() || "";
      const mime = MIME_MAP[ext] || "application/octet-stream";
      const blob = new Blob([Uint8Array.from(atob(data.data), c => c.charCodeAt(0))], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleZipDownload = async (paths?: string[]) => {
    setDownloading(true);
    try {
      const targetPath = paths ? paths.join(",") : currentPath;
      const data = await zipDownload(targetPath);
      const blob = new Blob([Uint8Array.from(atob(data.data), c => c.charCodeAt(0))], { type: "application/gzip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const folderName = currentPath.split("/").pop() || "download";
      a.download = `${folderName}.tar.gz`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Archive downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Zip download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleFileInfo = async (path: string) => {
    try {
      const data = await getFileInfo(path);
      setFileInfoData(data);
    } catch (err) {
      toast.error("Failed to get file info");
    }
  };

  const handleChmod = async (path: string) => {
    try {
      const res = await chmodFile(path, chmodValue);
      if (res.success) { toast.success("Permissions updated"); setShowChmod(null); navigate(currentPath); }
      else toast.error(res.error || "Failed");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleClick = (entry: RemoteFile) => {
    if (entry.type === "directory") {
      navigate(entry.path);
    } else if (entry.type === "file" && isImage(entry.name) && entry.size < 10485760) {
      previewImage(entry.path, entry.name);
    } else if (entry.type === "file" && isEditable(entry.name) && entry.size < 2097152) {
      viewFile(entry.path);
    } else if (entry.type === "file" && entry.size < 2097152) {
      viewFile(entry.path);
    }
  };

  const toggleSelect = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    for (const path of selected) {
      await deleteFile(path);
    }
    toast.success(`Deleted ${selected.size} items`);
    setSelected(new Set());
    navigate(currentPath);
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    toast.success("Path copied");
  };

  const pathSegments = currentPath.split("/").filter(Boolean);

  const quickPaths = [
    { label: "Home", path: "/home", icon: <Home className="h-4 w-4" /> },
    { label: "Backend", path: "/home/backendFlowServiceBackend", icon: <Server className="h-4 w-4" /> },
    { label: "Uploads", path: "/home/uploads", icon: <FileUp className="h-4 w-4" /> },
    { label: "Root", path: "/", icon: <HardDrive className="h-4 w-4" /> },
    { label: "Logs", path: "/var/log", icon: <FileText className="h-4 w-4" /> },
    { label: "Config", path: "/etc", icon: <FileCog className="h-4 w-4" /> },
  ];

  return (
    <div className="flex gap-3 h-[calc(100vh-100px)]">
      {/* Left sidebar */}
      <div className="w-48 flex-shrink-0 border border-border rounded-lg bg-card overflow-y-auto terminal-scrollbar">
        <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
          <Monitor className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Explorer</span>
        </div>
        <div className="p-1.5 space-y-0.5">
          {quickPaths.map(q => (
            <button
              key={q.path}
              onClick={() => navigate(q.path)}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 rounded-md transition-all ${
                currentPath.startsWith(q.path) && (q.path !== "/" || currentPath === "/")
                  ? "bg-primary/15 text-primary font-medium border border-primary/20"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              <span className={currentPath.startsWith(q.path) && (q.path !== "/" || currentPath === "/") ? "text-primary" : "text-muted-foreground"}>{q.icon}</span>
              {q.label}
            </button>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-border mt-2">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Storage</span>
          <div className="mt-1.5 flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{files.length} items in folder</span>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${dragOver ? "ring-2 ring-primary ring-dashed rounded-lg" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <button onClick={() => navigate("/" + pathSegments.slice(0, -1).join("/") || "/")} disabled={currentPath === "/"} className="p-1.5 border border-border rounded-md hover:bg-secondary disabled:opacity-30 transition-colors">
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => navigate(currentPath)} className="p-1.5 border border-border rounded-md hover:bg-secondary transition-colors">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Search */}
          <div className="relative flex-1 min-w-[120px] max-w-[250px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter files..."
              className="w-full pl-8 pr-2 py-1.5 text-xs border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring outline-none"
            />
          </div>

          {/* Breadcrumb */}
          <div className="flex-1 flex items-center gap-1 text-xs font-mono bg-card border border-border rounded-md px-3 py-1.5 overflow-x-auto min-w-0">
            <button onClick={() => navigate("/")} className="text-primary hover:underline flex-shrink-0">
              <HardDrive className="h-3.5 w-3.5" />
            </button>
            {pathSegments.map((seg, i) => (
              <span key={i} className="flex items-center gap-1 flex-shrink-0">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <button
                  onClick={() => navigate("/" + pathSegments.slice(0, i + 1).join("/"))}
                  className={i === pathSegments.length - 1 ? "text-foreground font-medium" : "text-primary hover:underline"}
                >
                  {seg}
                </button>
              </span>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button onClick={() => setViewMode("list")} className={`p-1.5 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"}`}>
              <List className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setViewMode("grid")} className={`p-1.5 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"}`}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Actions */}
          <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-secondary text-muted-foreground transition-colors">
            <FolderPlus className="h-3.5 w-3.5" /> New Folder
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Uploading..." : "Upload"}
          </button>
          <button
            onClick={() => handleZipDownload()}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50"
            title="Download folder as tar.gz"
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
            Zip
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
          />

          {selected.size > 0 && (
            <div className="flex items-center gap-1">
              <button onClick={() => handleZipDownload([...selected])} disabled={downloading}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-border rounded-md hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50">
                <Archive className="h-3.5 w-3.5" /> Zip {selected.size}
              </button>
              <button onClick={handleBulkDelete} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> Delete {selected.size}
              </button>
            </div>
          )}
        </div>

        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-20 pointer-events-none">
            <div className="bg-card border border-primary rounded-lg px-6 py-4 flex flex-col items-center gap-2 shadow-lg">
              <Upload className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-primary">Drop files here to upload</span>
              <span className="text-xs text-muted-foreground">Files will be uploaded to {currentPath}</span>
            </div>
          </div>
        )}

        {/* New folder input */}
        {showNewFolder && (
          <div className="flex items-center gap-2 mb-2 bg-card border border-border rounded-md px-3 py-2">
            <FolderPlus className="h-4 w-4 text-accent" />
            <input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleNewFolder()}
              placeholder="Folder name..."
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
            <button onClick={handleNewFolder} className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded-md">Create</button>
            <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2 text-sm mb-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-destructive">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-xs text-muted-foreground">✕</button>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : viewMode === "grid" ? (
          <div className="flex-1 overflow-auto terminal-scrollbar border border-border rounded-lg bg-card p-4">
            {sortedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mb-2 opacity-40" />
                <span className="text-sm">Empty folder</span>
                <span className="text-xs mt-1">Drop files here or click Upload</span>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
                {sortedFiles.map((entry, i) => (
                  <div
                    key={i}
                    onDoubleClick={() => handleClick(entry)}
                    onClick={(e) => toggleSelect(entry.path, e)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg cursor-pointer transition-all group relative ${
                      selected.has(entry.path)
                        ? "bg-primary/15 ring-1 ring-primary shadow-sm"
                        : "hover:bg-secondary/80"
                    }`}
                  >
                    {getLargeIcon(entry)}
                    {renamingFile === entry.path ? (
                      <input
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleRename(entry.path); if (e.key === "Escape") setRenamingFile(null); }}
                        onBlur={() => handleRename(entry.path)}
                        className="w-full text-[10px] text-center bg-secondary border border-border rounded px-1 py-0.5 outline-none text-foreground"
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-[11px] text-center text-foreground truncate w-full leading-tight" title={entry.name}>{entry.name}</span>
                    )}
                    <span className="text-[9px] text-muted-foreground">{entry.type === "file" ? formatSize(entry.size) : "Folder"}</span>
                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {entry.type === "file" && (
                        <button onClick={(e) => { e.stopPropagation(); handleDownloadFile(entry.path, entry.name); }} className="p-1 bg-card/90 hover:bg-muted rounded shadow-sm" title="Download">
                          <Download className="h-3 w-3 text-primary" />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setRenamingFile(entry.path); setRenameValue(entry.name); }} className="p-1 bg-card/90 hover:bg-muted rounded shadow-sm" title="Rename">
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(entry.path); }} className="p-1 bg-card/90 hover:bg-destructive/20 rounded shadow-sm" title="Delete">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 border border-border rounded-lg overflow-hidden">
            <div className="overflow-auto h-full terminal-scrollbar">
              {sortedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <FolderOpen className="h-10 w-10 mb-2 opacity-40" />
                  <span className="text-sm">Empty folder</span>
                  <span className="text-xs mt-1">Drop files here or click Upload</span>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-secondary text-left">
                      <th className="px-2 py-2 w-8"></th>
                      <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-foreground" onClick={() => setSortBy("name")}>
                        Name {sortBy === "name" && "▾"}
                      </th>
                      <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase w-24">Perms</th>
                      <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase w-20">Owner</th>
                      <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase w-20 text-right cursor-pointer hover:text-foreground" onClick={() => setSortBy("size")}>
                        Size {sortBy === "size" && "▾"}
                      </th>
                      <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase w-36 cursor-pointer hover:text-foreground" onClick={() => setSortBy("modified")}>
                        Modified {sortBy === "modified" && "▾"}
                      </th>
                      <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedFiles.map((entry, i) => (
                      <tr
                        key={i}
                        onClick={() => handleClick(entry)}
                        className={`hover:bg-secondary/50 cursor-pointer group transition-colors ${selected.has(entry.path) ? "bg-primary/10" : ""}`}
                      >
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={selected.has(entry.path)}
                            onChange={() => {}}
                            onClick={(e) => toggleSelect(entry.path, e)}
                            className="rounded border-border"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            {getFileIcon(entry)}
                            {renamingFile === entry.path ? (
                              <input
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") handleRename(entry.path); if (e.key === "Escape") setRenamingFile(null); }}
                                className="bg-secondary border border-border rounded px-2 py-0.5 text-xs outline-none text-foreground w-48"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span className={`font-mono text-xs ${entry.type === "directory" ? "text-primary font-medium" : "text-foreground"}`}>
                                {entry.name}
                              </span>
                            )}
                            {entry.type === "file" && isImage(entry.name) && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-success/10 text-success rounded font-medium">image</span>
                            )}
                            {entry.type === "file" && isEditable(entry.name) && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">editable</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground text-[10px]">{entry.permissions}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground text-xs">{entry.owner}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground text-xs text-right">
                          {entry.type === "file" ? formatSize(entry.size) : ""}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground text-xs">{entry.modified}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            {entry.type === "file" && (
                              <button onClick={() => handleDownloadFile(entry.path, entry.name)} className="p-1 hover:bg-secondary rounded" title="Download">
                                <Download className="h-3.5 w-3.5 text-primary" />
                              </button>
                            )}
                            {entry.type === "file" && entry.size < 2097152 && (
                              <button onClick={() => handleClick(entry)} className="p-1 hover:bg-secondary rounded" title="View">
                                <Eye className="h-3.5 w-3.5 text-primary" />
                              </button>
                            )}
                            <button onClick={() => copyPath(entry.path)} className="p-1 hover:bg-secondary rounded" title="Copy path">
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => handleFileInfo(entry.path)} className="p-1 hover:bg-secondary rounded" title="Info">
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => { setShowChmod(entry.path); setChmodValue("755"); }} className="p-1 hover:bg-secondary rounded" title="Chmod">
                              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => { setRenamingFile(entry.path); setRenameValue(entry.name); }} className="p-1 hover:bg-secondary rounded" title="Rename">
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => setDeleteConfirm(entry.path)} className="p-1 hover:bg-destructive/20 rounded" title="Delete">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Status bar */}
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground px-2 py-1 bg-card border border-border rounded-md">
          <span>{filteredFiles.length} items{searchQuery && ` (filtered from ${files.length})`}</span>
          <span className="font-mono">{currentPath}</span>
          <span>{selected.size > 0 ? `${selected.size} selected` : "Ready"}</span>
        </div>

        {/* Delete confirm modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-card border border-border rounded-lg p-5 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-destructive/10 rounded-lg"><Trash2 className="h-5 w-5 text-destructive" /></div>
                <h3 className="text-sm font-semibold text-foreground">Confirm Delete</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-1">Are you sure you want to delete:</p>
              <p className="text-xs font-mono text-destructive mb-4 break-all bg-destructive/5 p-2 rounded">{deleteConfirm}</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="text-xs px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors">Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="text-xs px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Chmod modal */}
        {showChmod && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50" onClick={() => setShowChmod(null)}>
            <div className="bg-card border border-border rounded-lg p-5 max-w-xs w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Change Permissions</h3>
              <p className="text-[10px] font-mono text-muted-foreground mb-2 break-all">{showChmod}</p>
              <div className="flex gap-2 mb-3">
                {["644", "755", "700", "600", "777"].map(p => (
                  <button key={p} onClick={() => setChmodValue(p)}
                    className={`text-xs px-2 py-1 rounded border font-mono ${chmodValue === p ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}>{p}</button>
                ))}
              </div>
              <input value={chmodValue} onChange={e => setChmodValue(e.target.value)} className="w-full px-2 py-1.5 text-xs font-mono border border-border rounded bg-background mb-3" placeholder="e.g. 755" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowChmod(null)} className="text-xs px-3 py-1.5 border border-border rounded hover:bg-secondary">Cancel</button>
                <button onClick={() => handleChmod(showChmod)} className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90">Apply</button>
              </div>
            </div>
          </div>
        )}

        {/* File info modal */}
        {fileInfoData && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50" onClick={() => setFileInfoData(null)}>
            <div className="bg-card border border-border rounded-lg p-5 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> File Info</h3>
                <button onClick={() => setFileInfoData(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
              <div className="text-xs font-mono text-primary mb-2 break-all">{fileInfoData.path}</div>
              <div className="space-y-2">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground mb-0.5">Type</div>
                  <div className="text-xs font-mono">{fileInfoData.fileType}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground mb-0.5">Stat</div>
                  <pre className="text-[10px] font-mono text-foreground/80 bg-secondary rounded p-2 overflow-auto max-h-40 terminal-scrollbar">{fileInfoData.stat}</pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File viewer / editor / image preview panel */}
      {(fileContent || fileLoading || imagePreview) && (
        <div className="w-[45%] flex-shrink-0 border border-border rounded-lg overflow-hidden flex flex-col bg-card">
          {fileLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : imagePreview ? (
            <>
              <div className="flex items-center justify-between bg-secondary px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-success" />
                  <span className="text-xs font-mono text-foreground font-medium">{imagePreview.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <a href={imagePreview.src} download={imagePreview.name} className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-secondary text-muted-foreground flex items-center gap-1">
                    <Download className="h-3 w-3" /> Download
                  </a>
                  <button onClick={() => setImagePreview(null)} className="text-xs p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
                <img src={imagePreview.src} alt={imagePreview.name} className="max-w-full max-h-full object-contain rounded shadow-lg" />
              </div>
            </>
          ) : fileContent && (
            <>
              {/* Editor header */}
              <div className="flex items-center justify-between bg-secondary px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  {getFileIcon({ name: fileContent.path.split("/").pop() || "", type: "file", path: fileContent.path, size: 0, permissions: "", owner: "", group: "", modified: "" })}
                  <span className="text-xs font-mono text-foreground truncate font-medium">{fileContent.path.split("/").pop()}</span>
                  {isEditable(fileContent.path.split("/").pop() || "") && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium flex-shrink-0">editable</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleDownloadFile(fileContent.path, fileContent.path.split("/").pop() || "file")} className="flex items-center gap-1 text-xs px-2 py-1.5 border border-border rounded-md hover:bg-secondary text-muted-foreground transition-colors" title="Download">
                    <Download className="h-3 w-3" />
                  </button>
                  <button onClick={() => copyPath(fileContent.path)} className="flex items-center gap-1 text-xs px-2 py-1.5 border border-border rounded-md hover:bg-secondary text-muted-foreground transition-colors" title="Copy path">
                    <Copy className="h-3 w-3" />
                  </button>
                  {editMode ? (
                    <>
                      <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                      </button>
                      <button onClick={() => { setEditMode(false); setEditContent(fileContent.content); }} className="text-xs px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setEditMode(true)} className="flex items-center gap-1 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-secondary text-muted-foreground transition-colors">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  )}
                  <button onClick={() => { setFileContent(null); setEditMode(false); }} className="text-xs p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground px-3 py-1 border-b border-border bg-secondary/50 font-mono truncate">
                {fileContent.path}
              </div>
              {editMode ? (
                <div className="flex-1 flex overflow-hidden">
                  <div className="flex-shrink-0 bg-secondary/50 text-muted-foreground text-[10px] font-mono py-3 px-2 text-right select-none overflow-hidden leading-[18px]">
                    {editContent.split("\n").map((_, i) => (<div key={i}>{i + 1}</div>))}
                  </div>
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="flex-1 p-3 text-xs font-mono bg-card text-foreground resize-none outline-none terminal-scrollbar leading-[18px]"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className="flex-1 flex overflow-auto terminal-scrollbar">
                  <div className="flex-shrink-0 bg-secondary/50 text-muted-foreground text-[10px] font-mono py-3 px-2 text-right select-none leading-[18px]">
                    {fileContent.content.split("\n").map((_, i) => (<div key={i}>{i + 1}</div>))}
                  </div>
                  <pre className="flex-1 p-3 text-xs font-mono text-foreground/80 leading-[18px]">
                    {fileContent.content}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
