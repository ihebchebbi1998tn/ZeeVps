import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { executeCommand } from "@/lib/ssh-api";
import { ShieldCheck, RefreshCw, Plus, Trash2, Download, Upload, Clock, CheckCircle, AlertTriangle, Lock } from "lucide-react";

interface CertInfo {
  domain: string;
  issuer: string;
  expiry: string;
  daysLeft: number;
  type: string;
  path: string;
}

export default function SSLPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [certs, setCerts] = useState<CertInfo[]>([]);
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [certType, setCertType] = useState("letsencrypt-nginx");
  const [customCert, setCustomCert] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [renewalLog, setRenewalLog] = useState("");
  const [certbotInstalled, setCertbotInstalled] = useState<boolean | null>(null);

  const checkCertbot = async () => {
    try {
      const r = await executeCommand("which certbot 2>/dev/null && echo 'INSTALLED' || echo 'NOT_INSTALLED'");
      setCertbotInstalled(r.output.includes("INSTALLED") && !r.output.includes("NOT_INSTALLED"));
    } catch { setCertbotInstalled(false); }
  };

  const loadCerts = async () => {
    setLoading(true);
    try {
      await checkCertbot();
      // List Let's Encrypt certs
      const le = await executeCommand(`sudo certbot certificates 2>/dev/null || echo 'NO_CERTBOT'`);
      // List certs in /etc/ssl/certs (custom) and nginx ssl
      const custom = await executeCommand(`find /etc/ssl/private /etc/nginx/ssl /etc/letsencrypt/live -name '*.pem' -o -name '*.crt' -o -name '*.key' 2>/dev/null | head -50`);
      
      const parsed: CertInfo[] = [];
      
      if (!le.output.includes("NO_CERTBOT") && !le.output.includes("No certificates found")) {
        const blocks = le.output.split("Certificate Name:").slice(1);
        for (const block of blocks) {
          const lines = block.split("\n");
          const name = lines[0]?.trim() || "";
          const domainsLine = lines.find(l => l.includes("Domains:"))?.replace("Domains:", "").trim() || name;
          const expiryLine = lines.find(l => l.includes("Expiry Date:"))?.replace("Expiry Date:", "").trim() || "";
          const pathLine = lines.find(l => l.includes("Certificate Path:"))?.replace("Certificate Path:", "").trim() || "";
          
          let daysLeft = 0;
          const match = expiryLine.match(/(\d+)\s*day/i) || expiryLine.match(/VALID:\s*(\d+)/i);
          if (match) daysLeft = parseInt(match[1]);
          
          parsed.push({
            domain: domainsLine,
            issuer: "Let's Encrypt",
            expiry: expiryLine.split("(")[0]?.trim() || expiryLine,
            daysLeft,
            type: "letsencrypt",
            path: pathLine,
          });
        }
      }

      // Check for self-signed or custom certs
      const customFiles = custom.output.split("\n").filter(f => f.endsWith(".crt") || f.endsWith(".pem"));
      for (const file of customFiles.slice(0, 10)) {
        if (!file.trim() || parsed.some(p => file.includes(p.domain))) continue;
        try {
          const info = await executeCommand(`openssl x509 -in "${file}" -noout -subject -issuer -enddate 2>/dev/null`);
          const subject = info.output.match(/subject=.*?CN\s*=\s*([^\n/]+)/)?.[1]?.trim() || file;
          const issuer = info.output.match(/issuer=.*?O\s*=\s*([^\n/,]+)/)?.[1]?.trim() || "Unknown";
          const endDate = info.output.match(/notAfter=(.*)/)?.[1]?.trim() || "";
          const expDate = new Date(endDate);
          const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / 86400000);
          
          parsed.push({
            domain: subject,
            issuer,
            expiry: endDate,
            daysLeft,
            type: issuer.toLowerCase().includes("encrypt") ? "letsencrypt" : "custom",
            path: file,
          });
        } catch {}
      }

      setCerts(parsed);
    } catch (e: any) {
      toast({ title: "Error loading certificates", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const installCertbot = async () => {
    setLoading(true);
    try {
      const r = await executeCommand("sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx python3-certbot-apache 2>&1");
      toast({ title: r.exitCode === 0 ? "Certbot installed" : "Install failed", description: r.output.slice(-200) });
      await checkCertbot();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const issueCert = async () => {
    if (!domain) return toast({ title: "Enter a domain", variant: "destructive" });
    setLoading(true);
    try {
      let cmd = "";
      const emailFlag = email ? `--email ${email}` : "--register-unsafely-without-email";
      
      switch (certType) {
        case "letsencrypt-nginx":
          cmd = `sudo certbot --nginx -d ${domain} ${emailFlag} --agree-tos --non-interactive 2>&1`;
          break;
        case "letsencrypt-apache":
          cmd = `sudo certbot --apache -d ${domain} ${emailFlag} --agree-tos --non-interactive 2>&1`;
          break;
        case "letsencrypt-standalone":
          cmd = `sudo certbot certonly --standalone -d ${domain} ${emailFlag} --agree-tos --non-interactive 2>&1`;
          break;
        case "letsencrypt-dns":
          cmd = `sudo certbot certonly --manual --preferred-challenges dns -d ${domain} ${emailFlag} --agree-tos --non-interactive 2>&1`;
          break;
        case "letsencrypt-wildcard":
          cmd = `sudo certbot certonly --manual --preferred-challenges dns -d "*.${domain}" -d ${domain} ${emailFlag} --agree-tos --non-interactive 2>&1`;
          break;
        case "self-signed":
          cmd = `sudo mkdir -p /etc/ssl/private /etc/ssl/certs && sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/${domain}.key -out /etc/ssl/certs/${domain}.crt -subj "/C=US/ST=State/L=City/O=Org/CN=${domain}" 2>&1`;
          break;
        case "mkcert":
          cmd = `mkcert -install 2>&1 && mkcert -cert-file /etc/ssl/certs/${domain}.crt -key-file /etc/ssl/private/${domain}.key ${domain} "*.${domain}" 2>&1`;
          break;
      }
      
      const r = await executeCommand(cmd);
      toast({ title: r.exitCode === 0 ? "Certificate issued!" : "Issue failed", description: r.output.slice(-300) });
      await loadCerts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const renewCert = async (d?: string) => {
    setLoading(true);
    try {
      const cmd = d ? `sudo certbot renew --cert-name ${d} --force-renewal 2>&1` : `sudo certbot renew 2>&1`;
      const r = await executeCommand(cmd);
      setRenewalLog(r.output);
      toast({ title: r.exitCode === 0 ? "Renewal complete" : "Renewal issues", description: r.output.slice(-200) });
      await loadCerts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const revokeCert = async (d: string) => {
    setLoading(true);
    try {
      const r = await executeCommand(`sudo certbot revoke --cert-name ${d} --delete-after-revoke --non-interactive 2>&1`);
      toast({ title: r.exitCode === 0 ? "Certificate revoked" : "Revoke failed", description: r.output.slice(-200) });
      await loadCerts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const uploadCustomCert = async () => {
    if (!customDomain || !customCert || !customKey) return toast({ title: "All fields required", variant: "destructive" });
    setLoading(true);
    try {
      const certB64 = btoa(customCert);
      const keyB64 = btoa(customKey);
      const cmds = [
        `sudo mkdir -p /etc/ssl/certs /etc/ssl/private`,
        `echo '${certB64}' | base64 -d | sudo tee /etc/ssl/certs/${customDomain}.crt > /dev/null`,
        `echo '${keyB64}' | base64 -d | sudo tee /etc/ssl/private/${customDomain}.key > /dev/null`,
        `sudo chmod 600 /etc/ssl/private/${customDomain}.key`,
      ];
      const r = await executeCommand(cmds.join(" && "));
      toast({ title: r.exitCode === 0 ? "Custom certificate uploaded" : "Upload failed", description: r.output.slice(-200) });
      setCustomCert(""); setCustomKey(""); setCustomDomain("");
      await loadCerts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const setupAutoRenewal = async () => {
    setLoading(true);
    try {
      const r = await executeCommand(`(crontab -l 2>/dev/null | grep -v certbot; echo '0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx 2>/dev/null; systemctl reload apache2 2>/dev/null" >> /var/log/certbot-renew.log 2>&1') | crontab - 2>&1`);
      toast({ title: "Auto-renewal configured", description: "Certbot will renew daily at 3 AM" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const deleteCert = async (cert: CertInfo) => {
    setLoading(true);
    try {
      let cmd = "";
      if (cert.type === "letsencrypt") {
        cmd = `sudo certbot delete --cert-name ${cert.domain.split(" ")[0]} --non-interactive 2>&1`;
      } else {
        cmd = `sudo rm -f "${cert.path}" 2>&1`;
      }
      const r = await executeCommand(cmd);
      toast({ title: r.exitCode === 0 ? "Deleted" : "Delete failed", description: r.output.slice(-200) });
      await loadCerts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /> SSL Certificate Manager</h1>
          <p className="text-sm text-muted-foreground">Manage SSL/TLS certificates — Let's Encrypt, self-signed, mkcert, and custom uploads</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadCerts} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {certbotInstalled === false && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Certbot is not installed. Install it to use Let's Encrypt certificates.</span>
            </div>
            <Button size="sm" onClick={installCertbot} disabled={loading}>Install Certbot</Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="certs">
        <TabsList>
          <TabsTrigger value="certs">Certificates</TabsTrigger>
          <TabsTrigger value="issue">Issue New</TabsTrigger>
          <TabsTrigger value="custom">Upload Custom</TabsTrigger>
          <TabsTrigger value="renewal">Auto-Renewal</TabsTrigger>
        </TabsList>

        <TabsContent value="certs" className="space-y-3">
          {certs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No certificates found. Click Refresh to scan or issue a new one.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {certs.map((cert, i) => (
                <Card key={i}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg ${cert.daysLeft > 30 ? "bg-emerald-500/10" : cert.daysLeft > 7 ? "bg-amber-500/10" : "bg-red-500/10"}`}>
                        {cert.daysLeft > 30 ? <CheckCircle className="h-4 w-4 text-emerald-500" /> :
                         cert.daysLeft > 7 ? <Clock className="h-4 w-4 text-amber-500" /> :
                         <AlertTriangle className="h-4 w-4 text-red-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{cert.domain}</p>
                        <p className="text-xs text-muted-foreground">
                          {cert.issuer} • Expires: {cert.expiry}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={cert.daysLeft > 30 ? "default" : cert.daysLeft > 7 ? "secondary" : "destructive"}>
                        {cert.daysLeft}d left
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{cert.type}</Badge>
                      {cert.type === "letsencrypt" && (
                        <Button size="sm" variant="outline" onClick={() => renewCert(cert.domain.split(" ")[0])} disabled={loading}>
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteCert(cert)} disabled={loading}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="issue" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Issue SSL Certificate</CardTitle>
              <CardDescription>Choose a certificate type and enter your domain</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Certificate Type</label>
                <Select value={certType} onValueChange={setCertType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="letsencrypt-nginx">Let's Encrypt (Nginx)</SelectItem>
                    <SelectItem value="letsencrypt-apache">Let's Encrypt (Apache)</SelectItem>
                    <SelectItem value="letsencrypt-standalone">Let's Encrypt (Standalone)</SelectItem>
                    <SelectItem value="letsencrypt-dns">Let's Encrypt (DNS Challenge)</SelectItem>
                    <SelectItem value="letsencrypt-wildcard">Let's Encrypt (Wildcard)</SelectItem>
                    <SelectItem value="self-signed">Self-Signed (OpenSSL)</SelectItem>
                    <SelectItem value="mkcert">mkcert (Local Dev)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Domain</label>
                  <Input placeholder="example.com" value={domain} onChange={e => setDomain(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email (optional for LE)</label>
                  <Input placeholder="admin@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>
              {certType.startsWith("letsencrypt-dns") || certType === "letsencrypt-wildcard" ? (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                  <strong>DNS Challenge:</strong> You'll need to add a TXT record to your DNS. Certbot will show you the record value during issuance. For wildcard certs, DNS validation is required.
                </div>
              ) : null}
              {certType === "self-signed" && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                  <strong>Self-Signed:</strong> Creates a 2048-bit RSA certificate valid for 365 days. Not trusted by browsers but useful for internal services.
                </div>
              )}
              {certType === "mkcert" && (
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200">
                  <strong>mkcert:</strong> Creates locally-trusted development certificates. Requires mkcert to be installed (available in App Store).
                </div>
              )}
              <Button onClick={issueCert} disabled={loading || !domain} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Issue Certificate
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload Custom Certificate</CardTitle>
              <CardDescription>Upload your own SSL certificate and private key (e.g. from a commercial CA)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Domain Name</label>
                <Input placeholder="example.com" value={customDomain} onChange={e => setCustomDomain(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Certificate (PEM format)</label>
                <Textarea placeholder="-----BEGIN CERTIFICATE-----..." value={customCert} onChange={e => setCustomCert(e.target.value)} rows={5} className="font-mono text-xs" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Private Key (PEM format)</label>
                <Textarea placeholder="-----BEGIN PRIVATE KEY-----..." value={customKey} onChange={e => setCustomKey(e.target.value)} rows={5} className="font-mono text-xs" />
              </div>
              <Button onClick={uploadCustomCert} disabled={loading || !customDomain || !customCert || !customKey} className="w-full">
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload Certificate
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="renewal" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Auto-Renewal</CardTitle>
              <CardDescription>Configure automatic renewal for Let's Encrypt certificates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={setupAutoRenewal} disabled={loading} variant="outline">
                  <Clock className="h-3.5 w-3.5 mr-1" /> Setup Cron Auto-Renewal
                </Button>
                <Button onClick={() => renewCert()} disabled={loading} variant="outline">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Renew All Now
                </Button>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Check existing renewal timer</label>
                <Button size="sm" variant="ghost" onClick={async () => {
                  const r = await executeCommand("sudo systemctl list-timers certbot* 2>/dev/null; echo '---'; crontab -l 2>/dev/null | grep certbot || echo 'No cron renewal'");
                  setRenewalLog(r.output);
                }} disabled={loading}>Check Timers</Button>
              </div>
              {renewalLog && (
                <pre className="p-3 rounded-lg bg-secondary/50 text-xs font-mono max-h-60 overflow-auto whitespace-pre-wrap">{renewalLog}</pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
