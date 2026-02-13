import { useState, useEffect, useCallback } from "react";
import { getPgStatus, pgListTables, pgTableSchema, pgQuery, pgCreateDb, pgDropDb, pgTableData, pgSetup, installPackage, PgStatus, PgTable, PgColumn, PgQueryResult } from "@/lib/ssh-api";
import { Loader2, RefreshCw, Database, Table2, Play, Plus, Trash2, Download, ChevronRight, Columns, Search, X, Power, HardDrive, Eye } from "lucide-react";
import { toast } from "sonner";

export default function DatabasePage() {
  const [pgStatus, setPgStatus] = useState<PgStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [tables, setTables] = useState<PgTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSchema, setTableSchema] = useState<PgColumn[]>([]);
  const [tableData, setTableData] = useState<{ columns: string[]; rows: string[][] } | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [tab, setTab] = useState<"tables" | "query" | "data">("tables");

  // Query editor
  const [query, setQuery] = useState("SELECT * FROM ");
  const [queryResult, setQueryResult] = useState<PgQueryResult | null>(null);
  const [queryRunning, setQueryRunning] = useState(false);

  // Create DB
  const [newDbName, setNewDbName] = useState("");
  const [showCreateDb, setShowCreateDb] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getPgStatus();
      setPgStatus(r);
      if (r.databases.length > 0 && !selectedDb) {
        setSelectedDb(r.databases[0]);
      }
    } catch { toast.error("Failed to check PostgreSQL status"); }
    finally { setLoading(false); }
  }, [selectedDb]);

  useEffect(() => { refresh(); }, []);

  // Load tables when DB selected
  useEffect(() => {
    if (!selectedDb) return;
    setTablesLoading(true);
    setSelectedTable(null);
    setTableSchema([]);
    setTableData(null);
    pgListTables(selectedDb).then(r => {
      setTables(r.tables || []);
    }).catch(() => setTables([]))
    .finally(() => setTablesLoading(false));
  }, [selectedDb]);

  const loadTableSchema = async (table: string) => {
    if (!selectedDb) return;
    setSelectedTable(table);
    setSchemaLoading(true);
    try {
      const [schema, data] = await Promise.all([
        pgTableSchema(selectedDb, table),
        pgTableData(selectedDb, table, 50),
      ]);
      setTableSchema(schema.columns || []);
      setTableData(data);
      setTab("data");
    } catch { toast.error("Failed to load table"); }
    finally { setSchemaLoading(false); }
  };

  const runQuery = async () => {
    if (!selectedDb || !query.trim()) return;
    setQueryRunning(true);
    try {
      const r = await pgQuery(selectedDb, query);
      setQueryResult(r);
      if (r.error && r.exitCode !== 0) toast.error("Query error: " + r.error);
    } catch (e: any) { toast.error(e.message); }
    finally { setQueryRunning(false); }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const r = await installPackage("postgresql,postgresql-contrib");
      if (r.success) {
        toast.success("PostgreSQL installed!");
        await pgSetup();
        toast.success("PostgreSQL started and enabled");
        refresh();
      } else {
        toast.error("Install failed: " + r.error);
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setInstalling(false); }
  };

  const handleCreateDb = async () => {
    if (!newDbName.trim()) return;
    try {
      const r = await pgCreateDb(newDbName.trim());
      if (r.success) {
        toast.success(`Database "${newDbName}" created`);
        setNewDbName("");
        setShowCreateDb(false);
        refresh();
      } else toast.error(r.error || "Failed");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDropDb = async (db: string) => {
    if (!confirm(`Permanently delete database "${db}"? This cannot be undone!`)) return;
    try {
      const r = await pgDropDb(db);
      if (r.success) {
        toast.success(`Database "${db}" deleted`);
        if (selectedDb === db) setSelectedDb(null);
        refresh();
      } else toast.error(r.error || "Failed");
    } catch (e: any) { toast.error(e.message); }
  };

  // Not installed state
  if (!loading && pgStatus && pgStatus.status === "not-installed") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">PostgreSQL Database</h1>
        </div>
        <div className="border border-border rounded p-8 text-center space-y-4">
          <Database className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <div>
            <h2 className="text-sm font-semibold">PostgreSQL is not installed</h2>
            <p className="text-xs text-muted-foreground mt-1">Install PostgreSQL to manage databases, tables, and run queries directly from this panel.</p>
          </div>
          <button onClick={handleInstall} disabled={installing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {installing ? "Installing PostgreSQL..." : "Install PostgreSQL"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">PostgreSQL Database</h1>
          {pgStatus && pgStatus.status === "active" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20 font-medium">RUNNING</span>
          )}
        </div>
        <button onClick={refresh} disabled={loading} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded hover:bg-secondary text-muted-foreground">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-12 gap-3">
          {/* Sidebar - Database list */}
          <div className="col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Databases</span>
              <button onClick={() => setShowCreateDb(true)} className="p-0.5 hover:bg-secondary rounded" title="Create database">
                <Plus className="h-3.5 w-3.5 text-primary" />
              </button>
            </div>
            {showCreateDb && (
              <div className="border border-primary/30 rounded p-2 space-y-1.5 bg-primary/5">
                <input value={newDbName} onChange={e => setNewDbName(e.target.value)} placeholder="database_name"
                  className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
                  onKeyDown={e => e.key === "Enter" && handleCreateDb()} />
                <div className="flex gap-1">
                  <button onClick={handleCreateDb} className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground rounded">Create</button>
                  <button onClick={() => setShowCreateDb(false)} className="text-[10px] px-2 py-0.5 border border-border rounded">Cancel</button>
                </div>
              </div>
            )}
            {pgStatus?.databases.map(db => (
              <div key={db} onClick={() => setSelectedDb(db)}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer group ${selectedDb === db ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-secondary text-foreground border border-transparent"}`}>
                <div className="flex items-center gap-1.5">
                  <HardDrive className="h-3 w-3" />
                  <span className="font-mono">{db}</span>
                </div>
                {db !== "postgres" && (
                  <button onClick={e => { e.stopPropagation(); handleDropDb(db); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 rounded">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                )}
              </div>
            ))}
            {pgStatus?.version && (
              <div className="text-[10px] text-muted-foreground px-2 mt-2">{pgStatus.version}</div>
            )}
          </div>

          {/* Main content */}
          <div className="col-span-9 space-y-3">
            {!selectedDb ? (
              <div className="border border-border rounded p-8 text-center text-muted-foreground text-xs">
                Select a database to browse tables and run queries
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex gap-1 bg-secondary/50 p-1 rounded">
                  {[
                    { id: "tables" as const, label: "Tables", icon: Table2 },
                    { id: "data" as const, label: "Data", icon: Eye },
                    { id: "query" as const, label: "SQL Query", icon: Play },
                  ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                      <t.icon className="h-3.5 w-3.5" /> {t.label}
                    </button>
                  ))}
                </div>

                {/* Tables tab */}
                {tab === "tables" && (
                  <div className="border border-border rounded overflow-hidden">
                    <div className="bg-secondary/60 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
                      <span>Tables in {selectedDb}</span>
                      {tablesLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                    {tables.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        No tables found. Use the SQL Query tab to create tables.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {tables.map(t => (
                          <div key={t.name} onClick={() => loadTableSchema(t.name)}
                            className="flex items-center justify-between px-3 py-2 hover:bg-secondary/30 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <Table2 className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs font-mono font-medium">{t.name}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span>{t.columns} cols</span>
                              <span>{t.size}</span>
                              <ChevronRight className="h-3 w-3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Data tab */}
                {tab === "data" && (
                  <div className="space-y-3">
                    {selectedTable && (
                      <>
                        {/* Schema */}
                        <div className="border border-border rounded overflow-hidden">
                          <div className="bg-secondary/60 px-3 py-2 flex items-center gap-2">
                            <Columns className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-semibold uppercase text-muted-foreground">Schema: {selectedTable}</span>
                            {schemaLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                          </div>
                          <div className="overflow-auto terminal-scrollbar">
                            <table className="w-full text-xs">
                              <thead className="bg-secondary/40">
                                <tr>
                                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Column</th>
                                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Type</th>
                                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Nullable</th>
                                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Default</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {tableSchema.map(c => (
                                  <tr key={c.name} className="hover:bg-secondary/20">
                                    <td className="px-3 py-1.5 font-mono font-medium">{c.name}</td>
                                    <td className="px-3 py-1.5 font-mono text-primary">{c.type}</td>
                                    <td className="px-3 py-1.5">{c.nullable ? <span className="text-warning">YES</span> : <span className="text-success">NO</span>}</td>
                                    <td className="px-3 py-1.5 font-mono text-muted-foreground truncate max-w-[200px]">{c.default || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        {/* Data preview */}
                        {tableData && (
                          <div className="border border-border rounded overflow-hidden">
                            <div className="bg-secondary/60 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                              Data Preview (top 50 rows)
                            </div>
                            <div className="overflow-auto max-h-[400px] terminal-scrollbar">
                              <table className="w-full text-xs">
                                <thead className="bg-secondary/40 sticky top-0">
                                  <tr>
                                    {tableData.columns.map(c => (
                                      <th key={c} className="text-left px-3 py-1.5 text-muted-foreground font-medium whitespace-nowrap">{c}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                  {tableData.rows.map((row, i) => (
                                    <tr key={i} className="hover:bg-secondary/20">
                                      {row.map((cell, j) => (
                                        <td key={j} className="px-3 py-1 font-mono text-foreground/80 whitespace-nowrap max-w-[250px] truncate">{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {!selectedTable && (
                      <div className="border border-border rounded p-6 text-center text-xs text-muted-foreground">
                        Select a table from the Tables tab to view its schema and data
                      </div>
                    )}
                  </div>
                )}

                {/* Query tab */}
                {tab === "query" && (
                  <div className="space-y-3">
                    <div className="border border-border rounded overflow-hidden">
                      <div className="bg-secondary/60 px-3 py-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">SQL Editor — {selectedDb}</span>
                        <button onClick={runQuery} disabled={queryRunning || !query.trim()}
                          className="flex items-center gap-1.5 text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50">
                          {queryRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          Run Query
                        </button>
                      </div>
                      <textarea value={query} onChange={e => setQuery(e.target.value)} rows={6}
                        className="w-full p-3 text-xs font-mono bg-background text-foreground border-0 resize-none focus:outline-none terminal-scrollbar"
                        placeholder="SELECT * FROM users LIMIT 10;"
                        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runQuery(); } }}
                      />
                      <div className="px-3 py-1.5 bg-secondary/30 text-[10px] text-muted-foreground border-t border-border">
                        Ctrl+Enter to run • Results limited to CSV output
                      </div>
                    </div>

                    {queryResult && (
                      <div className="border border-border rounded overflow-hidden">
                        <div className="bg-secondary/60 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
                          <span>Results ({queryResult.rows?.length || 0} rows)</span>
                          {queryResult.error && <span className="text-destructive normal-case font-normal">{queryResult.error.slice(0, 100)}</span>}
                        </div>
                        {queryResult.columns && queryResult.columns.length > 0 ? (
                          <div className="overflow-auto max-h-[400px] terminal-scrollbar">
                            <table className="w-full text-xs">
                              <thead className="bg-secondary/40 sticky top-0">
                                <tr>
                                  {queryResult.columns.map(c => (
                                    <th key={c} className="text-left px-3 py-1.5 text-muted-foreground font-medium whitespace-nowrap">{c}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {queryResult.rows.map((row, i) => (
                                  <tr key={i} className="hover:bg-secondary/20">
                                    {row.map((cell, j) => (
                                      <td key={j} className="px-3 py-1 font-mono text-foreground/80 whitespace-nowrap">{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <pre className="p-3 text-xs font-mono text-foreground/80 overflow-auto max-h-60 terminal-scrollbar">{queryResult.raw || "Query executed successfully"}</pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
