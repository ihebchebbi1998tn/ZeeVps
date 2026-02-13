/**
 * ZeeVPS — SSH Proxy Edge Function
 * Handles all server communication via SSH over Supabase Edge Functions.
 * 
 * @author Iheb Chebbi
 * @see https://www.linkedin.com/in/iheb-chebbi-899462237/
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Client } from "npm:ssh2@1.16.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SSHRequest {
  action: string;
  command?: string;
  path?: string;
  newPath?: string;
  content?: string;
  fileData?: string;
  service?: string;
  lines?: number;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

function sshExec(conn: InstanceType<typeof Client>, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err: Error | undefined, stream: any) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";
      stream.on("close", (code: number) => resolve({ stdout, stderr, code: code || 0 }));
      stream.on("data", (data: Buffer) => { stdout += data.toString(); });
      stream.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
    });
  });
}

function connectSSH(host: string, port: number, username: string, password: string): Promise<InstanceType<typeof Client>> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error("SSH connection timeout (10s)"));
    }, 10000);

    conn.on("ready", () => {
      clearTimeout(timeout);
      resolve(conn);
    });
    conn.on("error", (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
    conn.connect({ host, port, username, password, readyTimeout: 10000 });
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SSHRequest = await req.json();
    const { action } = body;

    const host = body.host || Deno.env.get("SSH_HOST");
    const port = body.port || 22;
    const username = body.username || Deno.env.get("SSH_USERNAME");
    const password = body.password || Deno.env.get("SSH_PASSWORD");

    if (!host || !username || !password) {
      return new Response(
        JSON.stringify({ error: "SSH credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "test_connection") {
      try {
        const conn = await connectSSH(host, port, username, password);
        const result = await sshExec(conn, "hostname && uname -a");
        conn.end();
        return new Response(
          JSON.stringify({ success: true, hostname: result.stdout.trim() }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Connection failed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const conn = await connectSSH(host, port, username, password);
    let result: any;

    switch (action) {
      case "execute": {
        if (!body.command) throw new Error("No command provided");
        const execResult = await sshExec(conn, body.command);
        result = { output: execResult.stdout, stderr: execResult.stderr, exitCode: execResult.code };
        break;
      }

      case "list_files": {
        const path = body.path || "/";
        const execResult = await sshExec(conn, `ls -la --time-style=long-iso ${JSON.stringify(path)} 2>/dev/null || ls -la ${JSON.stringify(path)}`);
        const lines = execResult.stdout.split("\n").filter(l => l.trim() && !l.startsWith("total"));
        const files = lines.map(line => {
          const parts = line.split(/\s+/);
          if (parts.length < 8) return null;
          const permissions = parts[0];
          const owner = parts[2];
          const group = parts[3];
          const size = parseInt(parts[4]) || 0;
          const dateStr = parts[5] + " " + parts[6];
          const name = parts.slice(7).join(" ");
          const type = permissions.startsWith("d") ? "directory" : permissions.startsWith("l") ? "symlink" : "file";
          return { name, path: path === "/" ? `/${name}` : `${path}/${name}`, type, size, permissions, owner, group, modified: dateStr };
        }).filter(Boolean);
        result = { files, currentPath: path };
        break;
      }

      case "read_file": {
        if (!body.path) throw new Error("No file path provided");
        const execResult = await sshExec(conn, `head -c 65536 ${JSON.stringify(body.path)} 2>&1`);
        result = { content: execResult.stdout, path: body.path };
        break;
      }

      case "write_file": {
        if (!body.path || body.content === undefined) throw new Error("Path and content required");
        const b64 = btoa(body.content);
        const execResult = await sshExec(conn, `echo '${b64}' | base64 -d > ${JSON.stringify(body.path)} 2>&1`);
        result = { success: execResult.code === 0, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "upload_file": {
        if (!body.path || !body.fileData) throw new Error("Path and fileData required");
        const uploadResult = await sshExec(conn, `echo '${body.fileData}' | base64 -d > ${JSON.stringify(body.path)} 2>&1`);
        result = { success: uploadResult.code === 0, error: uploadResult.stderr || uploadResult.stdout };
        break;
      }

      case "download_file": {
        if (!body.path) throw new Error("No path provided");
        const execResult = await sshExec(conn, `base64 ${JSON.stringify(body.path)} 2>&1`);
        result = { data: execResult.stdout.replace(/\n/g, ""), error: execResult.stderr, mimeGuess: body.path.split(".").pop() };
        break;
      }

      case "zip_download": {
        if (!body.path) throw new Error("No path provided");
        const isDir = await sshExec(conn, `test -d ${JSON.stringify(body.path)} && echo "dir" || echo "file"`);
        let zipCmd: string;
        if (isDir.stdout.trim() === "dir") {
          zipCmd = `cd ${JSON.stringify(body.path)} && tar czf - . 2>/dev/null | base64`;
        } else {
          const paths = body.path.split(",").map(p => JSON.stringify(p.trim())).join(" ");
          zipCmd = `tar czf - ${paths} 2>/dev/null | base64`;
        }
        const zipResult = await sshExec(conn, zipCmd);
        result = { data: zipResult.stdout.replace(/\n/g, ""), error: zipResult.stderr };
        break;
      }

      case "file_info": {
        if (!body.path) throw new Error("No path provided");
        const execResult = await sshExec(conn, `stat ${JSON.stringify(body.path)} 2>&1 && echo '---FINFO---' && file ${JSON.stringify(body.path)} 2>&1`);
        const [statOut, fileOut] = execResult.stdout.split("---FINFO---");
        result = { stat: statOut?.trim(), fileType: fileOut?.trim(), path: body.path };
        break;
      }

      case "chmod": {
        if (!body.path || !body.command) throw new Error("Path and permissions required");
        const execResult = await sshExec(conn, `chmod ${body.command} ${JSON.stringify(body.path)} 2>&1`);
        result = { success: execResult.code === 0, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "delete_file": {
        if (!body.path) throw new Error("No path provided");
        const execResult = await sshExec(conn, `rm -rf ${JSON.stringify(body.path)} 2>&1`);
        result = { success: execResult.code === 0, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "rename_file": {
        if (!body.path || !body.newPath) throw new Error("Path and newPath required");
        const execResult = await sshExec(conn, `mv ${JSON.stringify(body.path)} ${JSON.stringify(body.newPath)} 2>&1`);
        result = { success: execResult.code === 0, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "create_folder": {
        if (!body.path) throw new Error("No path provided");
        const execResult = await sshExec(conn, `mkdir -p ${JSON.stringify(body.path)} 2>&1`);
        result = { success: execResult.code === 0, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "system_info": {
        const commands = [
          `hostname`,
          `uname -r`,
          `uptime -p 2>/dev/null || uptime`,
          `nproc`,
          `free -b | grep Mem`,
          `df -B1 / | tail -1`,
          `cat /proc/loadavg`,
          `cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2`,
          `cat /proc/net/dev | grep -v 'lo:' | grep ':' | head -1`,
          `top -bn1 | grep "Cpu(s)" | awk '{print $2}' 2>/dev/null || echo "0"`,
        ];
        const execResult = await sshExec(conn, commands.join(" && echo '---SEPARATOR---' && "));
        const parts = execResult.stdout.split("---SEPARATOR---").map(s => s.trim());

        const memParts = (parts[4] || "").split(/\s+/);
        const diskParts = (parts[5] || "").split(/\s+/);
        const netParts = (parts[8] || "").split(/\s+/);
        const netRx = parseInt(netParts[1]) || 0;
        const netTx = parseInt(netParts[9]) || 0;

        result = {
          hostname: parts[0] || "unknown",
          kernel: parts[1] || "unknown",
          uptime: parts[2] || "unknown",
          cpuCores: parseInt(parts[3]) || 0,
          memTotal: parseInt(memParts[1]) || 0,
          memUsed: parseInt(memParts[2]) || 0,
          memFree: parseInt(memParts[3]) || 0,
          diskTotal: parseInt(diskParts[1]) || 0,
          diskUsed: parseInt(diskParts[2]) || 0,
          diskFree: parseInt(diskParts[3]) || 0,
          loadAvg: parts[6] || "0 0 0",
          os: parts[7] || "Linux",
          netRx,
          netTx,
          cpuPercent: parseFloat(parts[9]) || 0,
        };
        break;
      }

      case "services": {
        const execResult = await sshExec(conn, `systemctl list-units --type=service --all --no-pager --no-legend 2>/dev/null | head -80`);
        const services = execResult.stdout.split("\n").filter(l => l.trim()).map(line => {
          const parts = line.trim().split(/\s+/);
          const name = (parts[0] || "").replace(".service", "");
          const load = parts[1] || "unknown";
          const active = parts[2] || "unknown";
          const sub = parts[3] || "unknown";
          const description = parts.slice(4).join(" ");
          return { name, load, active, sub, description };
        }).filter(s => s.name);
        result = { services };
        break;
      }

      case "service_logs": {
        const service = body.service || "";
        const numLines = body.lines || 100;
        const execResult = await sshExec(conn, `journalctl -u ${JSON.stringify(service)} --no-pager -n ${numLines} --output=short-iso 2>&1`);
        result = { logs: execResult.stdout, service };
        break;
      }

      case "system_logs": {
        const numLines = body.lines || 100;
        const execResult = await sshExec(conn, `journalctl --no-pager -n ${numLines} --output=short-iso 2>&1`);
        result = { logs: execResult.stdout };
        break;
      }

      case "processes": {
        const execResult = await sshExec(conn, `ps aux --sort=-%mem | head -50`);
        const lines = execResult.stdout.split("\n");
        const procs = lines.slice(1).filter(l => l.trim()).map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            user: parts[0], pid: parts[1], cpu: parseFloat(parts[2]) || 0, mem: parseFloat(parts[3]) || 0,
            vsz: parts[4], rss: parts[5], stat: parts[7], started: parts[8], time: parts[9],
            command: parts.slice(10).join(" "),
          };
        });
        result = { processes: procs };
        break;
      }

      case "kill_process": {
        if (!body.command) throw new Error("No PID provided");
        const execResult = await sshExec(conn, `kill -9 ${body.command} 2>&1`);
        result = { success: execResult.code === 0, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "open_ports": {
        const execResult = await sshExec(conn, `ss -tulnp 2>/dev/null || netstat -tulnp 2>/dev/null`);
        result = { output: execResult.stdout };
        break;
      }

      case "active_connections": {
        const execResult = await sshExec(conn, `ss -tunp 2>/dev/null | head -100 || netstat -tunp 2>/dev/null | head -100`);
        result = { output: execResult.stdout };
        break;
      }

      case "iptables_rules": {
        const execResult = await sshExec(conn, `sudo iptables -L -n -v --line-numbers 2>&1`);
        result = { output: execResult.stdout, stderr: execResult.stderr };
        break;
      }

      case "iptables_add": {
        if (!body.command) throw new Error("No rule provided");
        const execResult = await sshExec(conn, `sudo iptables ${body.command} 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "iptables_delete": {
        if (!body.command) throw new Error("No rule provided");
        const execResult = await sshExec(conn, `sudo iptables ${body.command} 2>&1`);
        result = { success: execResult.code === 0, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "security_audit": {
        const commands = [
          `(lastlog 2>/dev/null | head -30 || true)`,
          `echo '---SEC_SEP---'`,
          `(last -n 20 2>/dev/null || true)`,
          `echo '---SEC_SEP---'`,
          `(sudo fail2ban-client status 2>/dev/null && echo '---F2B_DETAIL---' && sudo fail2ban-client status sshd 2>/dev/null || echo 'fail2ban not installed')`,
          `echo '---SEC_SEP---'`,
          `(cat /etc/ssh/sshd_config 2>/dev/null | grep -E '^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|Port |MaxAuthTries|AllowUsers|AllowGroups|PermitEmptyPasswords|X11Forwarding|UsePAM)' || echo 'Could not read sshd_config')`,
          `echo '---SEC_SEP---'`,
          `(sudo ufw status verbose 2>/dev/null || echo 'ufw not installed')`,
          `echo '---SEC_SEP---'`,
          `(find /etc/cron.d /var/spool/cron -type f 2>/dev/null | head -20 || true)`,
          `echo '---SEC_SEP---'`,
          `(w 2>/dev/null || who 2>/dev/null || true)`,
          `echo '---SEC_SEP---'`,
          `(sudo grep "Failed password" /var/log/auth.log 2>/dev/null | tail -50 || echo 'no auth log')`,
          `echo '---SEC_SEP---'`,
          `(ls /etc/nginx/sites-enabled/ 2>/dev/null && echo '---VHOST_SEP---' && for f in /etc/nginx/sites-enabled/*; do echo "===FILE:$f==="; grep -E 'server_name|root|proxy_pass|listen' "$f" 2>/dev/null; done || echo 'no nginx')`,
          `echo '---SEC_SEP---'`,
          `(ls /etc/apache2/sites-enabled/ 2>/dev/null && echo '---VHOST_SEP---' && for f in /etc/apache2/sites-enabled/*; do echo "===FILE:$f==="; grep -E 'ServerName|ServerAlias|DocumentRoot|ProxyPass' "$f" 2>/dev/null; done || echo 'no apache')`,
        ];
        const execResult = await sshExec(conn, commands.join(" ; "));
        const sections = execResult.stdout.split("---SEC_SEP---").map(s => s.trim());
        result = {
          lastlog: sections[0] || "",
          loginHistory: sections[1] || "",
          fail2ban: sections[2] || "",
          sshConfig: sections[3] || "",
          ufw: sections[4] || "",
          cronJobs: sections[5] || "",
          activeUsers: sections[6] || "",
          failedLogins: sections[7] || "",
          nginxDomains: sections[8] || "",
          apacheDomains: sections[9] || "",
        };
        break;
      }

      case "install_package": {
        if (!body.command) throw new Error("Package name required");
        const allowed = [
          // Security
          "fail2ban", "ufw", "clamav", "clamav-daemon", "rkhunter", "lynis",
          "libpam-google-authenticator", "aide", "auditd", "apparmor", "apparmor-utils",
          "unattended-upgrades", "wireguard", "openvpn",
          // Web servers
          "nginx", "apache2", "caddy", "lighttpd", "haproxy",
          // Databases
          "postgresql", "postgresql-contrib", "mysql-server", "mariadb-server",
          "redis-server", "redis-tools", "sqlite3", "memcached",
          // Message Queues
          "mosquitto", "mosquitto-clients",
          // Dev tools
          "git", "nodejs", "npm", "python3", "python3-pip", "python3-venv",
          "golang-go", "ruby", "ruby-dev", "php", "php-fpm", "php-cli", "php-mysql", "php-curl",
          "build-essential", "cmake", "pkg-config", "default-jdk", "default-jre",
          "httpie", "shellcheck", "make",
          // File management
          "mc", "ncdu", "tree", "rsync", "zip", "unzip", "p7zip-full", "rar", "unrar",
          "ranger", "fzf", "fd-find", "ripgrep", "bat",
          // Monitoring
          "htop", "btop", "glances", "nethogs", "iftop", "iotop", "nmon", "vnstat", "bmon",
          "sysstat", "dstat", "atop", "monit", "prometheus-node-exporter",
          // Networking
          "curl", "wget", "nmap", "traceroute", "mtr", "dnsutils", "net-tools",
          "iperf3", "openssh-server", "socat", "netcat-openbsd", "tcpdump", "whois",
          "speedtest-cli", "tor", "privoxy", "haproxy", "squid",
          // DNS
          "bind9", "bind9-utils", "dnsmasq",
          // Docker
          "docker.io", "docker-compose",
          // Container tools
          "podman", "buildah", "skopeo", "lxc", "lxd-installer",
          // Media
          "ffmpeg", "imagemagick", "graphicsmagick", "jpegoptim", "optipng", "webp",
          // Backup
          "borgbackup", "restic", "duplicity", "rclone", "rdiff-backup",
          // System
          "tmux", "screen", "supervisor", "cron", "logrotate", "acl",
          "jq", "yq", "strace", "ltrace", "gdb", "lsof", "systemd-timesyncd", "pipx",
          // SSL
          "certbot", "python3-certbot-nginx", "python3-certbot-apache",
          // Communication
          "postfix", "dovecot-imapd", "prosody",
          // Version control
          "gh", "subversion", "mercurial",
          // Text
          "vim", "neovim", "nano", "emacs-nox", "micro",
          // Runtimes
          "elixir",
          // Misc
          "cockpit", "webmin", "snapd", "flatpak",
        ];
        const pkgs = body.command.split(",").map((p: string) => p.trim());
        for (const p of pkgs) {
          if (!allowed.includes(p)) throw new Error("Package not allowed: " + p);
        }
        const execResult = await sshExec(conn, `sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ${pkgs.join(" ")} 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "uninstall_package": {
        if (!body.command) throw new Error("Package name required");
        const uninstallAllowed = [
          "fail2ban", "ufw", "clamav", "clamav-daemon", "rkhunter", "lynis",
          "libpam-google-authenticator", "aide", "auditd", "apparmor", "apparmor-utils",
          "unattended-upgrades", "wireguard", "openvpn",
          "nginx", "apache2", "caddy", "lighttpd", "haproxy",
          "postgresql", "postgresql-contrib", "mysql-server", "mariadb-server",
          "redis-server", "redis-tools", "sqlite3", "memcached",
          "mosquitto", "mosquitto-clients",
          "git", "nodejs", "npm", "python3", "python3-pip", "python3-venv",
          "golang-go", "ruby", "ruby-dev", "php", "php-fpm", "php-cli", "php-mysql", "php-curl",
          "build-essential", "cmake", "pkg-config", "default-jdk", "default-jre",
          "httpie", "shellcheck", "make",
          "mc", "ncdu", "tree", "rsync", "zip", "unzip", "p7zip-full", "rar", "unrar",
          "ranger", "fzf", "fd-find", "ripgrep", "bat",
          "htop", "btop", "glances", "nethogs", "iftop", "iotop", "nmon", "vnstat", "bmon",
          "sysstat", "dstat", "atop", "monit", "prometheus-node-exporter",
          "curl", "wget", "nmap", "traceroute", "mtr", "dnsutils", "net-tools",
          "iperf3", "openssh-server", "socat", "netcat-openbsd", "tcpdump", "whois",
          "speedtest-cli", "tor", "privoxy", "squid",
          "bind9", "bind9-utils", "dnsmasq",
          "docker.io", "docker-compose",
          "podman", "buildah", "skopeo", "lxc", "lxd-installer",
          "ffmpeg", "imagemagick", "graphicsmagick", "jpegoptim", "optipng", "webp",
          "borgbackup", "restic", "duplicity", "rclone", "rdiff-backup",
          "tmux", "screen", "supervisor", "cron", "logrotate", "acl",
          "jq", "yq", "strace", "ltrace", "gdb", "lsof", "systemd-timesyncd", "pipx",
          "certbot", "python3-certbot-nginx", "python3-certbot-apache",
          "postfix", "dovecot-imapd", "prosody",
          "gh", "subversion", "mercurial",
          "vim", "neovim", "nano", "emacs-nox", "micro",
          "elixir",
          "cockpit", "webmin", "snapd", "flatpak",
        ];
        const uPkgs = body.command.split(",").map((p: string) => p.trim());
        for (const p of uPkgs) {
          if (!uninstallAllowed.includes(p)) throw new Error("Package not allowed: " + p);
        }
        const uninstallResult = await sshExec(conn, `sudo DEBIAN_FRONTEND=noninteractive apt-get remove --purge -y ${uPkgs.join(" ")} 2>&1 && sudo apt-get autoremove -y 2>&1`);
        result = { success: uninstallResult.code === 0, output: uninstallResult.stdout, error: uninstallResult.stderr || uninstallResult.stdout };
        break;
      }

      case "install_script": {
        // For apps that need script-based installation (docker, node apps, etc.)
        if (!body.command) throw new Error("Script name required");
        const scripts: Record<string, string> = {
          "docker": `curl -fsSL https://get.docker.com | sudo sh 2>&1 && sudo usermod -aG docker $USER 2>&1`,
          "nvm": `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash 2>&1`,
          "gh-cli": `(type -p wget >/dev/null || sudo apt-get install wget -y) && sudo mkdir -p -m 755 /etc/apt/keyrings && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && sudo apt update && sudo apt install gh -y 2>&1`,
          "pm2": `sudo npm install -g pm2 2>&1`,
          "yarn": `sudo npm install -g yarn 2>&1`,
          "pnpm": `sudo npm install -g pnpm 2>&1`,
          "bun": `curl -fsSL https://bun.sh/install | bash 2>&1`,
          "deno": `curl -fsSL https://deno.land/install.sh | sh 2>&1`,
          "rustup": `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y 2>&1`,
          "composer": `curl -sS https://getcomposer.org/installer | sudo php -- --install-dir=/usr/local/bin --filename=composer 2>&1`,
          "wp-cli": `curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x wp-cli.phar && sudo mv wp-cli.phar /usr/local/bin/wp 2>&1`,
          "lazydocker": `curl https://raw.githubusercontent.com/jesseduffield/lazydocker/master/scripts/install_update_linux.sh | bash 2>&1`,
          "portainer": `sudo docker volume create portainer_data 2>&1 && sudo docker run -d -p 8000:8000 -p 9443:9443 --name portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest 2>&1`,
          "netdata": `wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh && sh /tmp/netdata-kickstart.sh --non-interactive 2>&1`,
          "grafana": `sudo apt-get install -y apt-transport-https software-properties-common wget && sudo mkdir -p /etc/apt/keyrings/ && wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg > /dev/null && echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | sudo tee /etc/apt/sources.list.d/grafana.list && sudo apt-get update && sudo apt-get install grafana -y && sudo systemctl enable grafana-server && sudo systemctl start grafana-server 2>&1`,
          "uptime-kuma": `sudo docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1 2>&1`,
          // New scripts
          "mongodb": `wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add - && echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list && sudo apt-get update && sudo apt-get install -y mongodb-org 2>&1 && sudo systemctl enable mongod && sudo systemctl start mongod 2>&1`,
          "influxdb": `wget -q https://repos.influxdata.com/influxdata-archive_compat.key && echo '393e8779c89ac8d958f81f942f9ad7fb82a25e133faddaf92e15b16e6ac9ce4c influxdata-archive_compat.key' | sha256sum -c && cat influxdata-archive_compat.key | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg > /dev/null && echo 'deb [signed-by=/etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg] https://repos.influxdata.com/debian stable main' | sudo tee /etc/apt/sources.list.d/influxdata.list && sudo apt-get update && sudo apt-get install -y influxdb2 2>&1 && sudo systemctl enable influxdb && sudo systemctl start influxdb 2>&1`,
          "cockroachdb": `curl https://binaries.cockroachdb.com/cockroach-latest.linux-amd64.tgz | tar -xz && sudo cp cockroach-*/cockroach /usr/local/bin/ && rm -rf cockroach-* 2>&1`,
          "keydb": `echo "deb https://download.keydb.dev/open-source-dist $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/keydb.list && sudo wget -O /etc/apt/trusted.gpg.d/keydb.gpg https://download.keydb.dev/open-source-dist/keyring.gpg && sudo apt-get update && sudo apt-get install -y keydb 2>&1 && sudo systemctl enable keydb-server && sudo systemctl start keydb-server 2>&1`,
          "rabbitmq": `sudo apt-get install -y erlang-base erlang-nox 2>&1 && sudo apt-get install -y rabbitmq-server 2>&1 && sudo systemctl enable rabbitmq-server && sudo systemctl start rabbitmq-server && sudo rabbitmq-plugins enable rabbitmq_management 2>&1`,
          "nats": `curl -L https://github.com/nats-io/nats-server/releases/latest/download/nats-server-v2.10.22-linux-amd64.tar.gz | tar -xz && sudo mv nats-server-*/nats-server /usr/local/bin/ && rm -rf nats-server-* 2>&1`,
          "prometheus": `sudo useradd --no-create-home --shell /bin/false prometheus 2>/dev/null; cd /tmp && curl -LO https://github.com/prometheus/prometheus/releases/download/v2.51.2/prometheus-2.51.2.linux-amd64.tar.gz && tar xvf prometheus-*.tar.gz && sudo cp prometheus-*/prometheus /usr/local/bin/ && sudo cp prometheus-*/promtool /usr/local/bin/ && rm -rf prometheus-* 2>&1`,
          "ctop": `sudo wget https://github.com/bcicen/ctop/releases/download/v0.7.7/ctop-0.7.7-linux-amd64 -O /usr/local/bin/ctop && sudo chmod +x /usr/local/bin/ctop 2>&1`,
          "dive": `wget https://github.com/wagoodman/dive/releases/download/v0.12.0/dive_0.12.0_linux_amd64.deb && sudo apt install -y ./dive_0.12.0_linux_amd64.deb && rm dive_*.deb 2>&1`,
          "traefik": `sudo wget -O /usr/local/bin/traefik https://github.com/traefik/traefik/releases/latest/download/traefik_v3.0.0_linux_amd64.tar.gz && cd /tmp && wget https://github.com/traefik/traefik/releases/download/v3.2.3/traefik_v3.2.3_linux_amd64.tar.gz && tar xzf traefik_*.tar.gz && sudo mv traefik /usr/local/bin/ && rm traefik_*.tar.gz 2>&1`,
          "crowdsec": `curl -s https://install.crowdsec.net | sudo sh && sudo apt install -y crowdsec 2>&1 && sudo systemctl enable crowdsec && sudo systemctl start crowdsec 2>&1`,
          "dotnet": `wget https://dot.net/v1/dotnet-install.sh -O /tmp/dotnet-install.sh && chmod +x /tmp/dotnet-install.sh && /tmp/dotnet-install.sh --channel 8.0 2>&1 && echo 'export DOTNET_ROOT=$HOME/.dotnet' >> ~/.bashrc && echo 'export PATH=$PATH:$DOTNET_ROOT' >> ~/.bashrc 2>&1`,
          "gitlab-runner": `curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash && sudo apt-get install -y gitlab-runner 2>&1`,
          "yt-dlp": `sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp 2>&1`,
          "mkcert": `sudo apt install -y libnss3-tools 2>&1 && curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64" && chmod +x mkcert-v*-linux-amd64 && sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert 2>&1`,
          "nginx-proxy-manager": `sudo mkdir -p /opt/npm && cd /opt/npm && cat > docker-compose.yml << 'NPMEOF'\nversion: "3"\nservices:\n  app:\n    image: jc21/nginx-proxy-manager:latest\n    restart: unless-stopped\n    ports:\n      - "80:80"\n      - "81:81"\n      - "443:443"\n    volumes:\n      - ./data:/data\n      - ./letsencrypt:/etc/letsencrypt\nNPMEOF\ndocker compose up -d 2>&1`,
          "phpmyadmin": `sudo mkdir -p /opt/phpmyadmin && cd /opt/phpmyadmin && cat > docker-compose.yml << 'PMAEOF'\nversion: "3"\nservices:\n  phpmyadmin:\n    image: phpmyadmin:latest\n    restart: unless-stopped\n    ports:\n      - "8080:80"\n    environment:\n      PMA_ARBITRARY: 1\nPMAEOF\ndocker compose up -d 2>&1`,
          "adminer": `sudo mkdir -p /opt/adminer && cd /opt/adminer && cat > docker-compose.yml << 'ADMEOF'\nversion: "3"\nservices:\n  adminer:\n    image: adminer:latest\n    restart: unless-stopped\n    ports:\n      - "8081:8080"\nADMEOF\ndocker compose up -d 2>&1`,
        };
        const script = scripts[body.command];
        if (!script) throw new Error("Unknown install script: " + body.command);
        const execResult = await sshExec(conn, script);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "check_installed": {
        // Check if multiple packages/commands are installed
        if (!body.command) throw new Error("Package names required");
        const names = body.command.split(",").map((n: string) => n.trim());
        const checks: Record<string, boolean> = {};
        for (const name of names) {
          const execResult = await sshExec(conn, `(which ${name} 2>/dev/null || dpkg -l ${name} 2>/dev/null | grep -q ^ii) && echo 'YES' || echo 'NO'`);
          checks[name] = execResult.stdout.trim().includes("YES");
        }
        result = { installed: checks };
        break;
      }

      case "enable_ufw": {
        const execResult = await sshExec(conn, `sudo ufw default deny incoming 2>&1 && sudo ufw default allow outgoing 2>&1 && sudo ufw allow ssh 2>&1 && echo "y" | sudo ufw enable 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "ufw_rule": {
        if (!body.command) throw new Error("UFW rule required");
        const execResult = await sshExec(conn, `sudo ufw ${body.command} 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "geo_lookup": {
        if (!body.command) throw new Error("IPs required");
        const ips = body.command.split(",").slice(0, 20);
        const results: any[] = [];
        for (const ip of ips) {
          try {
            const execResult = await sshExec(conn, `curl -s "http://ip-api.com/json/${ip.trim()}?fields=status,country,regionName,city,isp,query,lat,lon" 2>/dev/null`);
            try { results.push(JSON.parse(execResult.stdout)); } catch { results.push({ query: ip, status: "fail" }); }
          } catch { results.push({ query: ip, status: "fail" }); }
        }
        result = { geoData: results };
        break;
      }

      case "manage_nginx_domain": {
        if (!body.command || !body.content) throw new Error("Domain name and config required");
        const domain = body.command.replace(/[^a-zA-Z0-9.-]/g, "");
        const b64 = btoa(body.content);
        const cmds = [
          `echo '${b64}' | base64 -d | sudo tee /etc/nginx/sites-available/${domain} > /dev/null`,
          `sudo ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/${domain}`,
          `sudo nginx -t 2>&1`,
          `sudo systemctl reload nginx 2>&1`,
        ];
        const execResult = await sshExec(conn, cmds.join(" && "));
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "delete_nginx_domain": {
        if (!body.command) throw new Error("Domain name required");
        const domain = body.command.replace(/[^a-zA-Z0-9.-]/g, "");
        const execResult = await sshExec(conn, `sudo rm -f /etc/nginx/sites-enabled/${domain} && sudo rm -f /etc/nginx/sites-available/${domain} && sudo nginx -t 2>&1 && sudo systemctl reload nginx 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "read_nginx_config": {
        if (!body.command) throw new Error("Config file required");
        const execResult = await sshExec(conn, `sudo cat ${JSON.stringify(body.command)} 2>&1`);
        result = { content: execResult.stdout, error: execResult.stderr };
        break;
      }

      // ============ SSH CONFIG MANAGEMENT ============
      case "read_sshd_config": {
        const execResult = await sshExec(conn, `sudo cat /etc/ssh/sshd_config 2>&1`);
        result = { content: execResult.stdout, error: execResult.stderr };
        break;
      }

      case "write_sshd_config": {
        if (body.content === undefined) throw new Error("Config content required");
        const b64 = btoa(body.content);
        const cmds = [
          `sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%s)`,
          `echo '${b64}' | base64 -d | sudo tee /etc/ssh/sshd_config > /dev/null`,
          `sudo sshd -t 2>&1`,
        ];
        const execResult = await sshExec(conn, cmds.join(" && "));
        if (execResult.code !== 0) {
          await sshExec(conn, `sudo cp $(ls -t /etc/ssh/sshd_config.bak.* | head -1) /etc/ssh/sshd_config 2>/dev/null`);
          result = { success: false, error: "Config test failed: " + (execResult.stderr || execResult.stdout) };
        } else {
          const restart = await sshExec(conn, `sudo systemctl restart sshd 2>&1 || sudo systemctl restart ssh 2>&1`);
          result = { success: restart.code === 0, output: execResult.stdout, error: restart.stderr || restart.stdout };
        }
        break;
      }

      case "sshd_harden": {
        if (!body.command) throw new Error("Setting required (key=value)");
        const [key, ...valParts] = body.command.split("=");
        const val = valParts.join("=");
        if (!key || !val) throw new Error("Invalid format, use key=value");
        const cmds = [
          `sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%s)`,
          `sudo sed -i '/^#*\\s*${key}\\b/d' /etc/ssh/sshd_config`,
          `echo '${key} ${val}' | sudo tee -a /etc/ssh/sshd_config > /dev/null`,
          `sudo sshd -t 2>&1`,
        ];
        const execResult = await sshExec(conn, cmds.join(" && "));
        if (execResult.code !== 0) {
          await sshExec(conn, `sudo cp $(ls -t /etc/ssh/sshd_config.bak.* | head -1) /etc/ssh/sshd_config 2>/dev/null`);
          result = { success: false, error: "Config test failed: " + (execResult.stderr || execResult.stdout) };
        } else {
          const restart = await sshExec(conn, `sudo systemctl restart sshd 2>&1 || sudo systemctl restart ssh 2>&1`);
          result = { success: true, output: `Set ${key}=${val}`, error: restart.stderr };
        }
        break;
      }

      // ============ FAIL2BAN MANAGEMENT ============
      case "f2b_status": {
        const execResult = await sshExec(conn, `sudo fail2ban-client status 2>&1`);
        result = { output: execResult.stdout, error: execResult.stderr, installed: !execResult.stdout.includes("not found") && execResult.code === 0 };
        break;
      }

      case "f2b_jail_status": {
        if (!body.command) throw new Error("Jail name required");
        const jail = body.command.replace(/[^a-zA-Z0-9_-]/g, "");
        const execResult = await sshExec(conn, `sudo fail2ban-client status ${jail} 2>&1`);
        result = { output: execResult.stdout, error: execResult.stderr };
        break;
      }

      case "f2b_ban_ip": {
        if (!body.command || !body.service) throw new Error("Jail and IP required");
        const jail = body.command.replace(/[^a-zA-Z0-9_-]/g, "");
        const ip = body.service.replace(/[^0-9.:/]/g, "");
        const execResult = await sshExec(conn, `sudo fail2ban-client set ${jail} banip ${ip} 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "f2b_unban_ip": {
        if (!body.command || !body.service) throw new Error("Jail and IP required");
        const jail = body.command.replace(/[^a-zA-Z0-9_-]/g, "");
        const ip = body.service.replace(/[^0-9.:/]/g, "");
        const execResult = await sshExec(conn, `sudo fail2ban-client set ${jail} unbanip ${ip} 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "f2b_read_jail_config": {
        const execResult = await sshExec(conn, `sudo cat /etc/fail2ban/jail.local 2>/dev/null || sudo cat /etc/fail2ban/jail.conf 2>/dev/null | head -200`);
        result = { content: execResult.stdout, error: execResult.stderr };
        break;
      }

      case "f2b_write_jail_config": {
        if (body.content === undefined) throw new Error("Config content required");
        const b64 = btoa(body.content);
        const cmds = [
          `sudo cp /etc/fail2ban/jail.local /etc/fail2ban/jail.local.bak.$(date +%s) 2>/dev/null; true`,
          `echo '${b64}' | base64 -d | sudo tee /etc/fail2ban/jail.local > /dev/null`,
          `sudo systemctl restart fail2ban 2>&1`,
        ];
        const execResult = await sshExec(conn, cmds.join(" && "));
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "f2b_banned_ips": {
        const execResult = await sshExec(conn, `sudo fail2ban-client status sshd 2>/dev/null | grep "Banned IP" || echo "none"`);
        result = { output: execResult.stdout, error: execResult.stderr };
        break;
      }

      // ============ IP WHITELIST MANAGEMENT ============
      case "get_whitelist": {
        const cmds = [
          `sudo cat /etc/hosts.allow 2>/dev/null || echo ''`,
          `echo '---WL_SEP---'`,
          `sudo cat /etc/hosts.deny 2>/dev/null || echo ''`,
          `echo '---WL_SEP---'`,
          `(sudo grep -r 'ignoreip' /etc/fail2ban/jail.local 2>/dev/null || sudo grep -r 'ignoreip' /etc/fail2ban/jail.conf 2>/dev/null || echo '')`,
        ];
        const execResult = await sshExec(conn, cmds.join(" ; "));
        const parts = execResult.stdout.split("---WL_SEP---").map(s => s.trim());
        result = { hostsAllow: parts[0] || "", hostsDeny: parts[1] || "", f2bIgnoreIp: parts[2] || "" };
        break;
      }

      case "add_whitelist_ip": {
        if (!body.command) throw new Error("IP required");
        const ip = body.command.replace(/[^0-9.:/a-fA-F]/g, "");
        const cmds = [
          // Add to hosts.allow
          `grep -q "${ip}" /etc/hosts.allow 2>/dev/null || echo "ALL: ${ip}" | sudo tee -a /etc/hosts.allow > /dev/null`,
          // Add to fail2ban ignoreip
          `if [ -f /etc/fail2ban/jail.local ]; then sudo sed -i "s/^ignoreip = .*/& ${ip}/" /etc/fail2ban/jail.local 2>/dev/null || true; sudo systemctl restart fail2ban 2>/dev/null || true; fi`,
          // Add to UFW allow
          `sudo ufw allow from ${ip} 2>/dev/null || true`,
        ];
        const execResult = await sshExec(conn, cmds.join(" ; "));
        result = { success: true, output: execResult.stdout, error: execResult.stderr };
        break;
      }

      case "remove_whitelist_ip": {
        if (!body.command) throw new Error("IP required");
        const ip = body.command.replace(/[^0-9.:/a-fA-F]/g, "");
        const cmds = [
          `sudo sed -i "/${ip}/d" /etc/hosts.allow 2>/dev/null || true`,
          `if [ -f /etc/fail2ban/jail.local ]; then sudo sed -i "s/ ${ip}//" /etc/fail2ban/jail.local 2>/dev/null || true; sudo systemctl restart fail2ban 2>/dev/null || true; fi`,
          `sudo ufw delete allow from ${ip} 2>/dev/null || true`,
        ];
        const execResult = await sshExec(conn, cmds.join(" ; "));
        result = { success: true, output: execResult.stdout, error: execResult.stderr };
        break;
      }

      case "add_blacklist_ip": {
        if (!body.command) throw new Error("IP required");
        const ip = body.command.replace(/[^0-9.:/a-fA-F]/g, "");
        const cmds = [
          `grep -q "${ip}" /etc/hosts.deny 2>/dev/null || echo "ALL: ${ip}" | sudo tee -a /etc/hosts.deny > /dev/null`,
          `sudo ufw deny from ${ip} 2>/dev/null || true`,
        ];
        const execResult = await sshExec(conn, cmds.join(" ; "));
        result = { success: true, output: execResult.stdout, error: execResult.stderr };
        break;
      }

      case "remove_blacklist_ip": {
        if (!body.command) throw new Error("IP required");
        const ip = body.command.replace(/[^0-9.:/a-fA-F]/g, "");
        const cmds = [
          `sudo sed -i "/${ip}/d" /etc/hosts.deny 2>/dev/null || true`,
          `sudo ufw delete deny from ${ip} 2>/dev/null || true`,
        ];
        const execResult = await sshExec(conn, cmds.join(" ; "));
        result = { success: true, output: execResult.stdout, error: execResult.stderr };
        break;
      }

      // ============ SECURITY TOOLS CHECK ============
      case "security_tools_check": {
        const cmds = [
          `(which fail2ban-client 2>/dev/null && echo 'INSTALLED' || echo 'NOT_INSTALLED')`,
          `echo '---TOOL_SEP---'`,
          `(which ufw 2>/dev/null && echo 'INSTALLED' || echo 'NOT_INSTALLED')`,
          `echo '---TOOL_SEP---'`,
          `(which clamscan 2>/dev/null && echo 'INSTALLED' || echo 'NOT_INSTALLED')`,
          `echo '---TOOL_SEP---'`,
          `(which rkhunter 2>/dev/null && echo 'INSTALLED' || echo 'NOT_INSTALLED')`,
          `echo '---TOOL_SEP---'`,
          `(which lynis 2>/dev/null && echo 'INSTALLED' || echo 'NOT_INSTALLED')`,
          `echo '---TOOL_SEP---'`,
          `(which google-authenticator 2>/dev/null && echo 'INSTALLED' || echo 'NOT_INSTALLED')`,
          `echo '---TOOL_SEP---'`,
          `(which aide 2>/dev/null && echo 'INSTALLED' || echo 'NOT_INSTALLED')`,
          `echo '---TOOL_SEP---'`,
          `(which auditctl 2>/dev/null && echo 'INSTALLED' || echo 'NOT_INSTALLED')`,
          `echo '---TOOL_SEP---'`,
          `(which aa-status 2>/dev/null && echo 'INSTALLED' || echo 'NOT_INSTALLED')`,
          `echo '---TOOL_SEP---'`,
          `(dpkg -l unattended-upgrades 2>/dev/null | grep -q ^ii && echo 'INSTALLED' || echo 'NOT_INSTALLED')`,
        ];
        const execResult = await sshExec(conn, cmds.join(" ; "));
        const parts = execResult.stdout.split("---TOOL_SEP---").map(s => s.trim());
        result = {
          fail2ban: parts[0]?.includes("INSTALLED") && !parts[0]?.includes("NOT_INSTALLED"),
          ufw: parts[1]?.includes("INSTALLED") && !parts[1]?.includes("NOT_INSTALLED"),
          clamav: parts[2]?.includes("INSTALLED") && !parts[2]?.includes("NOT_INSTALLED"),
          rkhunter: parts[3]?.includes("INSTALLED") && !parts[3]?.includes("NOT_INSTALLED"),
          lynis: parts[4]?.includes("INSTALLED") && !parts[4]?.includes("NOT_INSTALLED"),
          google_auth: parts[5]?.includes("INSTALLED") && !parts[5]?.includes("NOT_INSTALLED"),
          aide: parts[6]?.includes("INSTALLED") && !parts[6]?.includes("NOT_INSTALLED"),
          auditd: parts[7]?.includes("INSTALLED") && !parts[7]?.includes("NOT_INSTALLED"),
          apparmor: parts[8]?.includes("INSTALLED") && !parts[8]?.includes("NOT_INSTALLED"),
          unattended_upgrades: parts[9]?.includes("INSTALLED") && !parts[9]?.includes("NOT_INSTALLED"),
        };
        break;
      }

      // ============ RUN SECURITY SCAN ============
      case "run_lynis": {
        const execResult = await sshExec(conn, `sudo lynis audit system --quick --no-colors 2>&1 | tail -80`);
        result = { output: execResult.stdout, error: execResult.stderr };
        break;
      }

      case "run_rkhunter": {
        const execResult = await sshExec(conn, `sudo rkhunter --check --skip-keypress --no-colors 2>&1 | tail -60`);
        result = { output: execResult.stdout, error: execResult.stderr };
        break;
      }

      case "run_clamscan": {
        if (!body.path) body.path = "/home";
        const execResult = await sshExec(conn, `sudo clamscan -r --max-filesize=10M --max-scansize=50M ${JSON.stringify(body.path)} 2>&1 | tail -30`);
        result = { output: execResult.stdout, error: execResult.stderr };
        break;
      }

      // ============ READ/WRITE SECURITY CONFIG FILES ============
      case "read_security_file": {
        if (!body.path) throw new Error("Path required");
        const allowedPaths = [
          "/etc/ssh/sshd_config", "/etc/fail2ban/jail.local", "/etc/fail2ban/jail.conf",
          "/etc/fail2ban/jail.d/", "/etc/ufw/ufw.conf", "/etc/ufw/user.rules", "/etc/ufw/user6.rules",
          "/etc/pam.d/sshd", "/etc/pam.d/common-auth", "/etc/security/limits.conf",
          "/etc/sysctl.conf", "/etc/login.defs", "/etc/hosts.allow", "/etc/hosts.deny",
          "/etc/nginx/nginx.conf",
        ];
        const isAllowed = allowedPaths.some(p => body.path!.startsWith(p));
        if (!isAllowed) throw new Error("Not a security config file");
        const execResult = await sshExec(conn, `sudo cat ${JSON.stringify(body.path)} 2>&1`);
        result = { content: execResult.stdout, error: execResult.stderr };
        break;
      }

      case "write_security_file": {
        if (!body.path || body.content === undefined) throw new Error("Path and content required");
        const allowedPaths = [
          "/etc/ssh/sshd_config", "/etc/fail2ban/jail.local",
          "/etc/fail2ban/jail.d/", "/etc/ufw/ufw.conf",
          "/etc/pam.d/sshd", "/etc/security/limits.conf",
          "/etc/sysctl.conf", "/etc/hosts.allow", "/etc/hosts.deny",
          "/etc/nginx/nginx.conf",
        ];
        const isAllowed = allowedPaths.some(p => body.path!.startsWith(p));
        if (!isAllowed) throw new Error("Not an allowed security config file");
        const b64 = btoa(body.content);
        const cmds = [
          `sudo cp ${JSON.stringify(body.path)} ${JSON.stringify(body.path)}.bak.$(date +%s) 2>/dev/null; true`,
          `echo '${b64}' | base64 -d | sudo tee ${JSON.stringify(body.path)} > /dev/null`,
        ];
        const execResult = await sshExec(conn, cmds.join(" && "));
        result = { success: execResult.code === 0, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "apply_sysctl": {
        const execResult = await sshExec(conn, `sudo sysctl -p 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      // ============ CRON ============
      case "cron_list": {
        const execResult = await sshExec(conn, `crontab -l 2>/dev/null || echo 'no crontab'`);
        const systemCron = await sshExec(conn, `ls /etc/cron.d/ 2>/dev/null && for f in /etc/cron.d/*; do echo "===FILE:$f==="; cat "$f" 2>/dev/null; done || echo ''`);
        result = { userCron: execResult.stdout, systemCron: systemCron.stdout };
        break;
      }

      case "cron_save": {
        if (body.content === undefined) throw new Error("Content required");
        const b64 = btoa(body.content);
        const execResult = await sshExec(conn, `echo '${b64}' | base64 -d | crontab - 2>&1`);
        result = { success: execResult.code === 0, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "cron_add": {
        if (!body.command) throw new Error("Cron entry required");
        const b64 = btoa(body.command);
        const execResult = await sshExec(conn, `(crontab -l 2>/dev/null; echo '$(echo "${b64}" | base64 -d)') | crontab - 2>&1`);
        result = { success: execResult.code === 0, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "cron_delete": {
        if (!body.command) throw new Error("Pattern required");
        const execResult = await sshExec(conn, `crontab -l 2>/dev/null | grep -v -F '${body.command}' | crontab - 2>&1`);
        result = { success: execResult.code === 0, error: execResult.stderr || execResult.stdout };
        break;
      }

      // ============ DOCKER ============
      case "docker_ps": {
        const execResult = await sshExec(conn, `docker ps -a --format '{{json .}}' 2>&1`);
        if (execResult.stderr && execResult.stderr.includes("not found")) {
          result = { error: "Docker is not installed", containers: [] };
        } else {
          const containers = execResult.stdout.split("\n").filter(l => l.trim()).map(l => {
            try { return JSON.parse(l); } catch { return null; }
          }).filter(Boolean);
          result = { containers };
        }
        break;
      }

      case "docker_images": {
        const execResult = await sshExec(conn, `docker images --format '{{json .}}' 2>&1`);
        const images = execResult.stdout.split("\n").filter(l => l.trim()).map(l => {
          try { return JSON.parse(l); } catch { return null; }
        }).filter(Boolean);
        result = { images };
        break;
      }

      case "docker_action": {
        if (!body.command || !body.service) throw new Error("Action and container required");
        const allowed = ["start", "stop", "restart", "pause", "unpause", "rm", "logs"];
        if (!allowed.includes(body.command)) throw new Error("Invalid docker action");
        const flags = body.command === "rm" ? "-f" : body.command === "logs" ? "--tail 200" : "";
        const execResult = await sshExec(conn, `docker ${body.command} ${flags} ${body.service} 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "docker_inspect": {
        if (!body.service) throw new Error("Container required");
        const execResult = await sshExec(conn, `docker inspect ${body.service} 2>&1`);
        try { result = { data: JSON.parse(execResult.stdout) }; } catch { result = { data: null, error: execResult.stdout }; }
        break;
      }

      case "docker_stats": {
        const execResult = await sshExec(conn, `docker stats --no-stream --format '{{json .}}' 2>&1`);
        const stats = execResult.stdout.split("\n").filter(l => l.trim()).map(l => {
          try { return JSON.parse(l); } catch { return null; }
        }).filter(Boolean);
        result = { stats };
        break;
      }

      case "docker_compose_up": {
        const path = body.path || ".";
        const execResult = await sshExec(conn, `cd ${JSON.stringify(path)} && docker compose up -d 2>&1 || docker-compose up -d 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "docker_compose_down": {
        const path = body.path || ".";
        const execResult = await sshExec(conn, `cd ${JSON.stringify(path)} && docker compose down 2>&1 || docker-compose down 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "docker_pull": {
        if (!body.service) throw new Error("Image name required");
        const execResult = await sshExec(conn, `docker pull ${body.service} 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "docker_networks": {
        const execResult = await sshExec(conn, `docker network ls --format '{{json .}}' 2>&1`);
        const networks = execResult.stdout.split("\n").filter(l => l.trim()).map(l => {
          try { return JSON.parse(l); } catch { return null; }
        }).filter(Boolean);
        result = { networks };
        break;
      }

      case "docker_volumes": {
        const execResult = await sshExec(conn, `docker volume ls --format '{{json .}}' 2>&1`);
        const volumes = execResult.stdout.split("\n").filter(l => l.trim()).map(l => {
          try { return JSON.parse(l); } catch { return null; }
        }).filter(Boolean);
        result = { volumes };
        break;
      }

      // ============ UFW PARSED ============
      case "ufw_status_parsed": {
        const execResult = await sshExec(conn, `sudo ufw status numbered 2>/dev/null || echo 'ufw not installed'`);
        result = { output: execResult.stdout, error: execResult.stderr };
        break;
      }

      // ============ POSTGRESQL ============
      case "pg_status": {
        const execResult = await sshExec(conn, [
          `(systemctl is-active postgresql 2>/dev/null || echo 'not-installed')`,
          `echo '---PG_SEP---'`,
          `(sudo -u postgres psql -V 2>/dev/null || echo 'no psql')`,
          `echo '---PG_SEP---'`,
          `(sudo -u postgres psql -t -A -c "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;" 2>/dev/null || echo '')`,
        ].join(" ; "));
        const parts = execResult.stdout.split("---PG_SEP---").map(s => s.trim());
        result = {
          status: parts[0] || "not-installed",
          version: parts[1] || "",
          databases: (parts[2] || "").split("\n").filter(Boolean),
        };
        break;
      }

      case "pg_list_tables": {
        if (!body.command) throw new Error("Database name required");
        const db = body.command.replace(/[^a-zA-Z0-9_-]/g, "");
        const execResult = await sshExec(conn, `sudo -u postgres psql -d "${db}" -t -A -c "SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))), (SELECT count(*) FROM information_schema.columns WHERE table_name=t.table_name AND table_schema='public') FROM information_schema.tables t WHERE table_schema='public' ORDER BY table_name;" 2>&1`);
        const tables = execResult.stdout.split("\n").filter(Boolean).map(line => {
          const [name, size, cols] = line.split("|");
          return { name, size: size || "0 bytes", columns: parseInt(cols) || 0 };
        });
        result = { tables, error: execResult.stderr };
        break;
      }

      case "pg_table_schema": {
        if (!body.command || !body.service) throw new Error("Database and table required");
        const db = body.command.replace(/[^a-zA-Z0-9_-]/g, "");
        const table = body.service.replace(/[^a-zA-Z0-9_-]/g, "");
        const execResult = await sshExec(conn, `sudo -u postgres psql -d "${db}" -t -A -c "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' ORDER BY ordinal_position;" 2>&1`);
        const columns = execResult.stdout.split("\n").filter(Boolean).map(line => {
          const [name, type, nullable, defaultVal] = line.split("|");
          return { name, type, nullable: nullable === "YES", default: defaultVal || null };
        });
        result = { columns, error: execResult.stderr };
        break;
      }

      case "pg_query": {
        if (!body.command || !body.content) throw new Error("Database and query required");
        const db = body.command.replace(/[^a-zA-Z0-9_-]/g, "");
        const b64q = btoa(body.content);
        const execResult = await sshExec(conn, `echo '${b64q}' | base64 -d | sudo -u postgres psql -d "${db}" --csv 2>&1`);
        const lines = execResult.stdout.split("\n").filter(Boolean);
        let columns: string[] = [];
        let rows: string[][] = [];
        if (lines.length > 0) {
          columns = lines[0].split(",").map(c => c.replace(/^"|"$/g, ""));
          rows = lines.slice(1).map(l => l.split(",").map(c => c.replace(/^"|"$/g, "")));
        }
        result = { columns, rows, raw: execResult.stdout, error: execResult.stderr, exitCode: execResult.code };
        break;
      }

      case "pg_create_db": {
        if (!body.command) throw new Error("Database name required");
        const db = body.command.replace(/[^a-zA-Z0-9_-]/g, "");
        const execResult = await sshExec(conn, `sudo -u postgres createdb "${db}" 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "pg_drop_db": {
        if (!body.command) throw new Error("Database name required");
        const db = body.command.replace(/[^a-zA-Z0-9_-]/g, "");
        const execResult = await sshExec(conn, `sudo -u postgres dropdb "${db}" 2>&1`);
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      case "pg_table_data": {
        if (!body.command || !body.service) throw new Error("Database and table required");
        const db = body.command.replace(/[^a-zA-Z0-9_-]/g, "");
        const table = body.service.replace(/[^a-zA-Z0-9_-]/g, "");
        const limit = body.lines || 100;
        const execResult = await sshExec(conn, `sudo -u postgres psql -d "${db}" --csv -c "SELECT * FROM \\"${table}\\" LIMIT ${limit};" 2>&1`);
        const lines = execResult.stdout.split("\n").filter(Boolean);
        let columns: string[] = [];
        let rows: string[][] = [];
        if (lines.length > 0) {
          columns = lines[0].split(",").map(c => c.replace(/^"|"$/g, ""));
          rows = lines.slice(1).map(l => l.split(",").map(c => c.replace(/^"|"$/g, "")));
        }
        result = { columns, rows, error: execResult.stderr };
        break;
      }

      case "pg_setup": {
        const cmds = [
          `sudo systemctl start postgresql 2>&1`,
          `sudo systemctl enable postgresql 2>&1`,
        ];
        const execResult = await sshExec(conn, cmds.join(" ; "));
        result = { success: execResult.code === 0, output: execResult.stdout, error: execResult.stderr || execResult.stdout };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    conn.end();

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("SSH proxy error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
