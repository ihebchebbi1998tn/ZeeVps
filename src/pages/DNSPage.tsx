import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { executeCommand } from "@/lib/ssh-api";
import { Globe, RefreshCw, Plus, Trash2, Search, Settings, CheckCircle, AlertTriangle } from "lucide-react";

interface DnsRecord {
  name: string;
  type: string;
  value: string;
  ttl: string;
  priority?: string;
}

export default function DNSPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dnsServer, setDnsServer] = useState<"bind9" | "dnsmasq" | "none" | null>(null);

  // DNS Lookup
  const [lookupDomain, setLookupDomain] = useState("");
  const [lookupType, setLookupType] = useState("A");
  const [lookupResult, setLookupResult] = useState("");

  // Zone management (bind9)
  const [zones, setZones] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [zoneRecords, setZoneRecords] = useState<DnsRecord[]>([]);
  const [zoneFileContent, setZoneFileContent] = useState("");

  // New record
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("A");
  const [newValue, setNewValue] = useState("");
  const [newTTL, setNewTTL] = useState("3600");
  const [newPriority, setNewPriority] = useState("");

  // dnsmasq
  const [dnsmasqConfig, setDnsmasqConfig] = useState("");
  const [newDnsmasqEntry, setNewDnsmasqEntry] = useState("");

  // Hosts file
  const [hostsContent, setHostsContent] = useState("");

  const detectDnsServer = async () => {
    setLoading(true);
    try {
      const r = await executeCommand(`(systemctl is-active named 2>/dev/null || systemctl is-active bind9 2>/dev/null) && echo 'BIND9' || (systemctl is-active dnsmasq 2>/dev/null && echo 'DNSMASQ' || echo 'NONE')`);
      const out = r.output.trim();
      if (out.includes("BIND9")) setDnsServer("bind9");
      else if (out.includes("DNSMASQ")) setDnsServer("dnsmasq");
      else setDnsServer("none");
    } catch { setDnsServer("none"); }
    setLoading(false);
  };

  const dnsLookup = async () => {
    if (!lookupDomain) return;
    setLoading(true);
    try {
      const r = await executeCommand(`dig ${lookupType} ${lookupDomain} +short 2>/dev/null || nslookup ${lookupDomain} 2>/dev/null || host ${lookupDomain} 2>/dev/null`);
      setLookupResult(r.output || r.stderr || "No results");
    } catch (e: any) {
      setLookupResult("Error: " + e.message);
    }
    setLoading(false);
  };

  const dnsLookupFull = async () => {
    if (!lookupDomain) return;
    setLoading(true);
    try {
      const r = await executeCommand(`dig ${lookupDomain} ANY +noall +answer 2>/dev/null || echo 'dig not available'`);
      setLookupResult(r.output || r.stderr);
    } catch (e: any) {
      setLookupResult("Error: " + e.message);
    }
    setLoading(false);
  };

  // Bind9 zone management
  const loadZones = async () => {
    setLoading(true);
    try {
      const r = await executeCommand(`ls /etc/bind/db.* 2>/dev/null | sed 's|/etc/bind/db.||' || echo ''`);
      const z = r.output.split("\n").filter(l => l.trim() && l !== "local" && l !== "0" && l !== "127" && l !== "255" && l !== "empty");
      setZones(z);
    } catch {}
    setLoading(false);
  };

  const loadZoneFile = async (zone: string) => {
    setSelectedZone(zone);
    setLoading(true);
    try {
      const r = await executeCommand(`sudo cat /etc/bind/db.${zone} 2>/dev/null || echo 'Zone file not found'`);
      setZoneFileContent(r.output);
      
      // Parse records
      const lines = r.output.split("\n").filter(l => l.trim() && !l.startsWith(";") && !l.startsWith("$"));
      const records: DnsRecord[] = [];
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const isClass = parts[1] === "IN";
          if (isClass && parts.length >= 4) {
            records.push({ name: parts[0], type: parts[2], value: parts.slice(3).join(" "), ttl: "" });
          }
        }
      }
      setZoneRecords(records);
    } catch {}
    setLoading(false);
  };

  const saveZoneFile = async () => {
    if (!selectedZone) return;
    setLoading(true);
    try {
      const b64 = btoa(zoneFileContent);
      const cmds = [
        `sudo cp /etc/bind/db.${selectedZone} /etc/bind/db.${selectedZone}.bak.$(date +%s)`,
        `echo '${b64}' | base64 -d | sudo tee /etc/bind/db.${selectedZone} > /dev/null`,
        `sudo named-checkzone ${selectedZone} /etc/bind/db.${selectedZone} 2>&1`,
        `sudo rndc reload ${selectedZone} 2>&1 || sudo systemctl reload bind9 2>&1`,
      ];
      const r = await executeCommand(cmds.join(" && "));
      toast({ title: r.exitCode === 0 ? "Zone saved & reloaded" : "Error saving zone", description: r.output.slice(-200) });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const addRecord = async () => {
    if (!selectedZone || !newName || !newValue) return;
    setLoading(true);
    try {
      const priority = newType === "MX" ? `${newPriority || "10"} ` : "";
      const record = `${newName}\tIN\t${newType}\t${priority}${newValue}`;
      const cmds = [
        `echo '${record}' | sudo tee -a /etc/bind/db.${selectedZone} > /dev/null`,
        `sudo named-checkzone ${selectedZone} /etc/bind/db.${selectedZone} 2>&1`,
        `sudo rndc reload ${selectedZone} 2>&1 || sudo systemctl reload bind9 2>&1`,
      ];
      const r = await executeCommand(cmds.join(" && "));
      toast({ title: r.exitCode === 0 ? "Record added" : "Error", description: r.output.slice(-200) });
      setNewName(""); setNewValue("");
      await loadZoneFile(selectedZone);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const createZone = async (zoneName: string) => {
    if (!zoneName) return;
    setLoading(true);
    try {
      const template = `$TTL    86400
@       IN      SOA     ns1.${zoneName}. admin.${zoneName}. (
                     $(date +%Y%m%d)01 ; Serial
                         3600       ; Refresh
                          600       ; Retry
                        86400       ; Expire
                          600 )     ; Negative Cache TTL
;
@       IN      NS      ns1.${zoneName}.
@       IN      A       $(hostname -I | awk '{print $1}')
ns1     IN      A       $(hostname -I | awk '{print $1}')`;
      const b64 = btoa(template);
      const cmds = [
        `echo '${b64}' | base64 -d | sudo tee /etc/bind/db.${zoneName} > /dev/null`,
        `echo 'zone "${zoneName}" { type master; file "/etc/bind/db.${zoneName}"; };' | sudo tee -a /etc/bind/named.conf.local > /dev/null`,
        `sudo named-checkconf 2>&1`,
        `sudo systemctl reload bind9 2>&1`,
      ];
      const r = await executeCommand(cmds.join(" && "));
      toast({ title: r.exitCode === 0 ? "Zone created" : "Error", description: r.output.slice(-200) });
      await loadZones();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  // dnsmasq
  const loadDnsmasq = async () => {
    setLoading(true);
    try {
      const r = await executeCommand(`sudo cat /etc/dnsmasq.conf 2>/dev/null || echo 'Config not found'`);
      setDnsmasqConfig(r.output);
    } catch {}
    setLoading(false);
  };

  const saveDnsmasq = async () => {
    setLoading(true);
    try {
      const b64 = btoa(dnsmasqConfig);
      const cmds = [
        `sudo cp /etc/dnsmasq.conf /etc/dnsmasq.conf.bak.$(date +%s)`,
        `echo '${b64}' | base64 -d | sudo tee /etc/dnsmasq.conf > /dev/null`,
        `sudo systemctl restart dnsmasq 2>&1`,
      ];
      const r = await executeCommand(cmds.join(" && "));
      toast({ title: r.exitCode === 0 ? "Config saved" : "Error", description: r.output.slice(-200) });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const addDnsmasqEntry = async () => {
    if (!newDnsmasqEntry) return;
    setLoading(true);
    try {
      const r = await executeCommand(`echo '${newDnsmasqEntry}' | sudo tee -a /etc/dnsmasq.conf > /dev/null && sudo systemctl restart dnsmasq 2>&1`);
      toast({ title: r.exitCode === 0 ? "Entry added" : "Error", description: r.output.slice(-200) });
      setNewDnsmasqEntry("");
      await loadDnsmasq();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  // Hosts file
  const loadHosts = async () => {
    setLoading(true);
    try {
      const r = await executeCommand(`cat /etc/hosts 2>/dev/null`);
      setHostsContent(r.output);
    } catch {}
    setLoading(false);
  };

  const saveHosts = async () => {
    setLoading(true);
    try {
      const b64 = btoa(hostsContent);
      const cmds = [
        `sudo cp /etc/hosts /etc/hosts.bak.$(date +%s)`,
        `echo '${b64}' | base64 -d | sudo tee /etc/hosts > /dev/null`,
      ];
      const r = await executeCommand(cmds.join(" && "));
      toast({ title: r.exitCode === 0 ? "Hosts file saved" : "Error", description: r.output.slice(-200) });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> DNS Management</h1>
          <p className="text-sm text-muted-foreground">Manage DNS zones, records, lookups, and server configuration</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={detectDnsServer} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Detect DNS Server
          </Button>
        </div>
      </div>

      {dnsServer !== null && (
        <Card className={dnsServer === "none" ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"}>
          <CardContent className="py-3 flex items-center gap-2">
            {dnsServer === "none" ? (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm">No DNS server detected. Install BIND9 or dnsmasq from the App Store for full zone management.</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium">{dnsServer === "bind9" ? "BIND9" : "dnsmasq"} detected and running</span>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="lookup">
        <TabsList>
          <TabsTrigger value="lookup">DNS Lookup</TabsTrigger>
          <TabsTrigger value="zones">Zone Manager</TabsTrigger>
          <TabsTrigger value="dnsmasq">dnsmasq</TabsTrigger>
          <TabsTrigger value="hosts">/etc/hosts</TabsTrigger>
        </TabsList>

        <TabsContent value="lookup" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">DNS Lookup</CardTitle>
              <CardDescription>Query DNS records for any domain</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="example.com" value={lookupDomain} onChange={e => setLookupDomain(e.target.value)} className="flex-1" />
                <Select value={lookupType} onValueChange={setLookupType}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "SRV", "PTR", "CAA"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={dnsLookup} disabled={loading || !lookupDomain}>
                  <Search className="h-3.5 w-3.5 mr-1" /> Lookup
                </Button>
                <Button onClick={dnsLookupFull} disabled={loading || !lookupDomain} variant="outline">
                  All Records
                </Button>
              </div>
              {lookupResult && (
                <pre className="p-3 rounded-lg bg-secondary/50 text-xs font-mono max-h-60 overflow-auto whitespace-pre-wrap">{lookupResult}</pre>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Tools</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Reverse DNS", cmd: `dig -x $(curl -s ifconfig.me) +short 2>/dev/null` },
                { label: "Public IP", cmd: `curl -s ifconfig.me 2>/dev/null` },
                { label: "Resolv.conf", cmd: `cat /etc/resolv.conf 2>/dev/null` },
                { label: "DNS Cache Stats", cmd: `sudo rndc stats 2>/dev/null && tail -20 /var/cache/bind/named.stats 2>/dev/null || echo 'No BIND stats'` },
              ].map(tool => (
                <Button key={tool.label} size="sm" variant="outline" onClick={async () => {
                  const r = await executeCommand(tool.cmd);
                  setLookupResult(`=== ${tool.label} ===\n${r.output || r.stderr}`);
                }} disabled={loading}>{tool.label}</Button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zones" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">BIND9 Zone Manager</CardTitle>
              <CardDescription>Manage DNS zones and records (requires BIND9)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" onClick={loadZones} disabled={loading} variant="outline">
                  <RefreshCw className="h-3 w-3 mr-1" /> Load Zones
                </Button>
                <Input placeholder="New zone (e.g. example.com)" className="flex-1" onKeyDown={e => { if (e.key === "Enter") createZone((e.target as HTMLInputElement).value); }} />
                <Button size="sm" onClick={() => {
                  const input = document.querySelector('input[placeholder="New zone (e.g. example.com)"]') as HTMLInputElement;
                  if (input?.value) createZone(input.value);
                }} disabled={loading}>
                  <Plus className="h-3 w-3 mr-1" /> Create Zone
                </Button>
              </div>

              {zones.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {zones.map(z => (
                    <Badge key={z} variant={z === selectedZone ? "default" : "outline"} className="cursor-pointer" onClick={() => loadZoneFile(z)}>
                      {z}
                    </Badge>
                  ))}
                </div>
              )}

              {selectedZone && (
                <>
                  {/* Add record form */}
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border/30 space-y-2">
                    <p className="text-xs font-medium">Add Record to {selectedZone}</p>
                    <div className="flex gap-2">
                      <Input placeholder="Name (@, www, etc)" value={newName} onChange={e => setNewName(e.target.value)} className="w-32" />
                      <Select value={newType} onValueChange={setNewType}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SRV", "PTR", "CAA"].map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {newType === "MX" && <Input placeholder="Priority" value={newPriority} onChange={e => setNewPriority(e.target.value)} className="w-20" />}
                      <Input placeholder="Value (IP, hostname, etc)" value={newValue} onChange={e => setNewValue(e.target.value)} className="flex-1" />
                      <Button size="sm" onClick={addRecord} disabled={loading}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Zone records table */}
                  {zoneRecords.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {zoneRecords.map((rec, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono">{rec.name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{rec.type}</Badge></TableCell>
                            <TableCell className="text-xs font-mono">{rec.value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Raw zone editor */}
                  <Textarea value={zoneFileContent} onChange={e => setZoneFileContent(e.target.value)} rows={12} className="font-mono text-xs" />
                  <Button onClick={saveZoneFile} disabled={loading}>
                    <Settings className="h-3.5 w-3.5 mr-1" /> Save & Reload Zone
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dnsmasq" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">dnsmasq Configuration</CardTitle>
              <CardDescription>Lightweight DNS forwarder and DHCP server</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" onClick={loadDnsmasq} disabled={loading} variant="outline">
                  <RefreshCw className="h-3 w-3 mr-1" /> Load Config
                </Button>
              </div>

              <div className="p-3 rounded-lg bg-secondary/30 border border-border/30 space-y-2">
                <p className="text-xs font-medium">Quick Add Entry</p>
                <div className="flex gap-2">
                  <Input placeholder="address=/example.com/192.168.1.100" value={newDnsmasqEntry} onChange={e => setNewDnsmasqEntry(e.target.value)} className="flex-1" />
                  <Button size="sm" onClick={addDnsmasqEntry} disabled={loading}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Examples: address=/local.dev/127.0.0.1 • server=8.8.8.8 • cname=alias.com,real.com
                </p>
              </div>

              {dnsmasqConfig && (
                <>
                  <Textarea value={dnsmasqConfig} onChange={e => setDnsmasqConfig(e.target.value)} rows={15} className="font-mono text-xs" />
                  <Button onClick={saveDnsmasq} disabled={loading}>
                    <Settings className="h-3.5 w-3.5 mr-1" /> Save & Restart dnsmasq
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hosts" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">/etc/hosts Editor</CardTitle>
              <CardDescription>Edit local hostname resolution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button size="sm" onClick={loadHosts} disabled={loading} variant="outline">
                <RefreshCw className="h-3 w-3 mr-1" /> Load
              </Button>
              {hostsContent && (
                <>
                  <Textarea value={hostsContent} onChange={e => setHostsContent(e.target.value)} rows={12} className="font-mono text-xs" />
                  <Button onClick={saveHosts} disabled={loading}>
                    <Settings className="h-3.5 w-3.5 mr-1" /> Save Hosts File
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
