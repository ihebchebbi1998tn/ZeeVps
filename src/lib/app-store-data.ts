import {
  Server, Database, Code, FolderOpen, Activity, Network, Box, Terminal, Image,
  Archive, Clock, Globe, Lock, Eye, Wrench, GitBranch, Zap, Layers, Monitor,
  Package, Play, Settings, FileText, Hash, Rocket, Search, Shield, Download,
  MessageSquare, Key, Radio, Cpu, HardDrive, type LucideIcon,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
export interface AppItem {
  id: string;
  name: string;
  desc: string;
  pkg?: string;
  script?: string;
  checkCmd: string;
  icon: LucideIcon;
  category: string;
  tags: string[];
}

export interface AppCategory {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface DeployTemplate {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  runtime: string;
  steps: string;
  port?: string;
}

// ─── Categories ──────────────────────────────────────────────────────
export const APP_CATEGORIES: AppCategory[] = [
  { id: "all", label: "All", icon: Package },
  { id: "deploy", label: "Deploy", icon: Rocket },
  { id: "webserver", label: "Web Servers", icon: Globe },
  { id: "database", label: "Databases", icon: Database },
  { id: "security", label: "Security", icon: Shield },
  { id: "monitoring", label: "Monitoring", icon: Activity },
  { id: "devtools", label: "Dev Tools", icon: Code },
  { id: "runtime", label: "Runtimes", icon: Zap },
  { id: "container", label: "Containers", icon: Box },
  { id: "filetools", label: "File Tools", icon: FolderOpen },
  { id: "networking", label: "Networking", icon: Network },
  { id: "media", label: "Media", icon: Image },
  { id: "backup", label: "Backup", icon: Archive },
  { id: "system", label: "System", icon: Settings },
  { id: "editor", label: "Editors", icon: Terminal },
  { id: "ssl", label: "SSL / TLS", icon: Lock },
  { id: "vcs", label: "Version Control", icon: GitBranch },
  { id: "communication", label: "Communication", icon: MessageSquare },
  { id: "panel", label: "Admin Panels", icon: Monitor },
  { id: "dns", label: "DNS", icon: Globe },
  { id: "queue", label: "Message Queues", icon: Radio },
];

// ─── Applications ────────────────────────────────────────────────────
export const APPS: AppItem[] = [
  // ── Web Servers ────────────────────────────────────────────────────
  { id: "nginx", name: "Nginx", desc: "High-performance HTTP server and reverse proxy", pkg: "nginx", checkCmd: "nginx", icon: Globe, category: "webserver", tags: ["proxy", "load balancer", "web"] },
  { id: "apache2", name: "Apache2", desc: "World's most used web server software", pkg: "apache2", checkCmd: "apache2", icon: Globe, category: "webserver", tags: ["httpd", "web"] },
  { id: "caddy", name: "Caddy", desc: "Fast web server with automatic HTTPS", pkg: "caddy", checkCmd: "caddy", icon: Globe, category: "webserver", tags: ["https", "auto-ssl"] },
  { id: "haproxy", name: "HAProxy", desc: "Reliable, high-performance TCP/HTTP load balancer", pkg: "haproxy", checkCmd: "haproxy", icon: Globe, category: "webserver", tags: ["load balancer", "proxy"] },
  { id: "lighttpd", name: "Lighttpd", desc: "Lightweight and fast web server optimized for speed", pkg: "lighttpd", checkCmd: "lighttpd", icon: Globe, category: "webserver", tags: ["lightweight", "fast"] },
  { id: "traefik", name: "Traefik", desc: "Modern HTTP reverse proxy and load balancer for microservices", script: "traefik", checkCmd: "traefik", icon: Globe, category: "webserver", tags: ["microservices", "auto-discovery"] },

  // ── Databases ──────────────────────────────────────────────────────
  { id: "postgresql", name: "PostgreSQL", desc: "Advanced open-source relational database", pkg: "postgresql,postgresql-contrib", checkCmd: "psql", icon: Database, category: "database", tags: ["sql", "relational"] },
  { id: "mysql", name: "MySQL", desc: "Popular open-source relational database", pkg: "mysql-server", checkCmd: "mysql", icon: Database, category: "database", tags: ["sql", "relational"] },
  { id: "mariadb", name: "MariaDB", desc: "Community-developed fork of MySQL", pkg: "mariadb-server", checkCmd: "mariadb", icon: Database, category: "database", tags: ["sql", "mysql-fork"] },
  { id: "redis", name: "Redis", desc: "In-memory data structure store, cache & message broker", pkg: "redis-server,redis-tools", checkCmd: "redis-cli", icon: Database, category: "database", tags: ["cache", "nosql", "key-value"] },
  { id: "sqlite3", name: "SQLite3", desc: "Self-contained, serverless SQL database engine", pkg: "sqlite3", checkCmd: "sqlite3", icon: Database, category: "database", tags: ["sql", "embedded"] },
  { id: "memcached", name: "Memcached", desc: "High-performance distributed memory caching system", pkg: "memcached", checkCmd: "memcached", icon: Database, category: "database", tags: ["cache", "memory"] },
  { id: "mongodb", name: "MongoDB", desc: "Document-oriented NoSQL database for modern apps", script: "mongodb", checkCmd: "mongod", icon: Database, category: "database", tags: ["nosql", "document", "json"] },
  { id: "influxdb", name: "InfluxDB", desc: "Time-series database optimized for metrics and events", script: "influxdb", checkCmd: "influx", icon: Database, category: "database", tags: ["time-series", "metrics", "iot"] },
  { id: "cockroachdb", name: "CockroachDB", desc: "Distributed SQL database built for cloud-native apps", script: "cockroachdb", checkCmd: "cockroach", icon: Database, category: "database", tags: ["distributed", "sql", "cloud"] },
  { id: "keydb", name: "KeyDB", desc: "Multi-threaded Redis fork with higher throughput", script: "keydb", checkCmd: "keydb-cli", icon: Database, category: "database", tags: ["redis-fork", "multi-threaded", "cache"] },

  // ── Message Queues ─────────────────────────────────────────────────
  { id: "rabbitmq", name: "RabbitMQ", desc: "Feature-rich message broker supporting AMQP, MQTT, STOMP", script: "rabbitmq", checkCmd: "rabbitmqctl", icon: Radio, category: "queue", tags: ["amqp", "broker", "messaging"] },
  { id: "mosquitto", name: "Mosquitto", desc: "Lightweight MQTT broker for IoT messaging", pkg: "mosquitto,mosquitto-clients", checkCmd: "mosquitto", icon: Radio, category: "queue", tags: ["mqtt", "iot", "lightweight"] },
  { id: "nats", name: "NATS", desc: "High-performance cloud-native messaging system", script: "nats", checkCmd: "nats-server", icon: Radio, category: "queue", tags: ["cloud-native", "pubsub", "fast"] },

  // ── Security ───────────────────────────────────────────────────────
  { id: "fail2ban", name: "Fail2Ban", desc: "Intrusion prevention — bans IPs after failed logins", pkg: "fail2ban", checkCmd: "fail2ban-client", icon: Shield, category: "security", tags: ["firewall", "protection"] },
  { id: "ufw", name: "UFW Firewall", desc: "Uncomplicated firewall for managing iptables", pkg: "ufw", checkCmd: "ufw", icon: Shield, category: "security", tags: ["firewall", "iptables"] },
  { id: "clamav", name: "ClamAV", desc: "Open-source antivirus engine for detecting malware", pkg: "clamav,clamav-daemon", checkCmd: "clamscan", icon: Shield, category: "security", tags: ["antivirus", "malware"] },
  { id: "rkhunter", name: "Rootkit Hunter", desc: "Scans for rootkits, backdoors and local exploits", pkg: "rkhunter", checkCmd: "rkhunter", icon: Shield, category: "security", tags: ["rootkit", "scanner"] },
  { id: "lynis", name: "Lynis", desc: "Security auditing tool for Unix-based systems", pkg: "lynis", checkCmd: "lynis", icon: Shield, category: "security", tags: ["audit", "hardening"] },
  { id: "auditd", name: "Audit Daemon", desc: "Linux audit framework for tracking security events", pkg: "auditd", checkCmd: "auditctl", icon: Eye, category: "security", tags: ["audit", "logging"] },
  { id: "apparmor", name: "AppArmor", desc: "Mandatory access control for restricting programs", pkg: "apparmor,apparmor-utils", checkCmd: "aa-status", icon: Lock, category: "security", tags: ["mac", "access-control"] },
  { id: "wireguard", name: "WireGuard", desc: "Fast, modern, secure VPN tunnel", pkg: "wireguard", checkCmd: "wg", icon: Lock, category: "security", tags: ["vpn", "tunnel"] },
  { id: "aide", name: "AIDE", desc: "Advanced Intrusion Detection Environment", pkg: "aide", checkCmd: "aide", icon: Eye, category: "security", tags: ["ids", "file-integrity"] },
  { id: "unattended-upgrades", name: "Auto Updates", desc: "Automatic installation of security updates", pkg: "unattended-upgrades", checkCmd: "unattended-upgrades", icon: Clock, category: "security", tags: ["updates", "patches"] },
  { id: "nmap", name: "Nmap", desc: "Network exploration and security auditing tool", pkg: "nmap", checkCmd: "nmap", icon: Search, category: "security", tags: ["scanner", "ports"] },
  { id: "openvpn", name: "OpenVPN", desc: "Full-featured open-source VPN solution", pkg: "openvpn", checkCmd: "openvpn", icon: Lock, category: "security", tags: ["vpn", "ssl"] },
  { id: "crowdsec", name: "CrowdSec", desc: "Collaborative and open-source intrusion prevention system", script: "crowdsec", checkCmd: "cscli", icon: Shield, category: "security", tags: ["ips", "collaborative", "modern"] },

  // ── Monitoring ─────────────────────────────────────────────────────
  { id: "htop", name: "htop", desc: "Interactive process viewer for Unix systems", pkg: "htop", checkCmd: "htop", icon: Activity, category: "monitoring", tags: ["processes", "interactive"] },
  { id: "btop", name: "btop++", desc: "Resource monitor showing CPU, memory, disks, network", pkg: "btop", checkCmd: "btop", icon: Activity, category: "monitoring", tags: ["resources", "modern"] },
  { id: "glances", name: "Glances", desc: "Cross-platform system monitoring tool written in Python", pkg: "glances", checkCmd: "glances", icon: Activity, category: "monitoring", tags: ["system", "web-ui"] },
  { id: "nethogs", name: "NetHogs", desc: "Per-process network bandwidth monitor", pkg: "nethogs", checkCmd: "nethogs", icon: Network, category: "monitoring", tags: ["bandwidth", "per-process"] },
  { id: "iftop", name: "iftop", desc: "Display bandwidth usage on a network interface", pkg: "iftop", checkCmd: "iftop", icon: Network, category: "monitoring", tags: ["bandwidth", "real-time"] },
  { id: "iotop", name: "iotop", desc: "Monitor I/O usage per process", pkg: "iotop", checkCmd: "iotop", icon: Activity, category: "monitoring", tags: ["disk", "io"] },
  { id: "vnstat", name: "vnStat", desc: "Network traffic monitor that keeps a log", pkg: "vnstat", checkCmd: "vnstat", icon: Network, category: "monitoring", tags: ["traffic", "statistics"] },
  { id: "sysstat", name: "sysstat", desc: "Performance monitoring tools (sar, iostat, mpstat)", pkg: "sysstat", checkCmd: "sar", icon: Activity, category: "monitoring", tags: ["performance", "cpu", "io"] },
  { id: "monit", name: "Monit", desc: "Process supervision tool with web interface", pkg: "monit", checkCmd: "monit", icon: Eye, category: "monitoring", tags: ["supervisor", "web-ui"] },
  { id: "netdata", name: "Netdata", desc: "Real-time performance and health monitoring with web dashboard", script: "netdata", checkCmd: "netdata", icon: Activity, category: "monitoring", tags: ["real-time", "dashboard", "web-ui"] },
  { id: "grafana", name: "Grafana", desc: "Analytics & interactive visualization web application", script: "grafana", checkCmd: "grafana-server", icon: Monitor, category: "monitoring", tags: ["dashboard", "visualization", "metrics"] },
  { id: "prometheus", name: "Prometheus", desc: "Open-source monitoring and alerting toolkit for metrics", script: "prometheus", checkCmd: "prometheus", icon: Activity, category: "monitoring", tags: ["metrics", "alerting", "tsdb"] },
  { id: "node-exporter", name: "Node Exporter", desc: "Prometheus exporter for hardware and OS metrics", pkg: "prometheus-node-exporter", checkCmd: "prometheus-node-exporter", icon: Cpu, category: "monitoring", tags: ["prometheus", "metrics", "hardware"] },
  { id: "ctop", name: "ctop", desc: "Top-like interface for Docker container metrics", script: "ctop", checkCmd: "ctop", icon: Box, category: "monitoring", tags: ["docker", "containers", "tui"] },

  // ── Dev Tools ──────────────────────────────────────────────────────
  { id: "git", name: "Git", desc: "Distributed version control system", pkg: "git", checkCmd: "git", icon: GitBranch, category: "devtools", tags: ["vcs", "source-control"] },
  { id: "build-essential", name: "Build Essential", desc: "C/C++ compiler and essential build tools (gcc, make)", pkg: "build-essential", checkCmd: "gcc", icon: Wrench, category: "devtools", tags: ["compiler", "c", "c++"] },
  { id: "cmake", name: "CMake", desc: "Cross-platform build system generator", pkg: "cmake", checkCmd: "cmake", icon: Wrench, category: "devtools", tags: ["build", "cross-platform"] },
  { id: "jq", name: "jq", desc: "Command-line JSON processor", pkg: "jq", checkCmd: "jq", icon: Code, category: "devtools", tags: ["json", "parser"] },
  { id: "yq", name: "yq", desc: "Command-line YAML/XML/TOML processor (like jq)", pkg: "yq", checkCmd: "yq", icon: Code, category: "devtools", tags: ["yaml", "parser"] },
  { id: "strace", name: "strace", desc: "System call tracer for debugging programs", pkg: "strace", checkCmd: "strace", icon: Code, category: "devtools", tags: ["debug", "syscalls"] },
  { id: "gdb", name: "GDB", desc: "GNU debugger for C/C++ programs", pkg: "gdb", checkCmd: "gdb", icon: Code, category: "devtools", tags: ["debug", "c"] },
  { id: "curl", name: "curl", desc: "Transfer data from or to a server using various protocols", pkg: "curl", checkCmd: "curl", icon: Globe, category: "devtools", tags: ["http", "transfer"] },
  { id: "wget", name: "wget", desc: "Non-interactive network downloader", pkg: "wget", checkCmd: "wget", icon: Download, category: "devtools", tags: ["download", "http"] },
  { id: "httpie", name: "HTTPie", desc: "User-friendly command-line HTTP client with JSON support", pkg: "httpie", checkCmd: "http", icon: Globe, category: "devtools", tags: ["http", "api", "json"] },
  { id: "shellcheck", name: "ShellCheck", desc: "Static analysis tool for shell scripts", pkg: "shellcheck", checkCmd: "shellcheck", icon: Code, category: "devtools", tags: ["linter", "bash", "shell"] },
  { id: "make", name: "Make", desc: "Build automation tool using Makefiles", pkg: "make", checkCmd: "make", icon: Wrench, category: "devtools", tags: ["build", "automation"] },

  // ── Runtimes ───────────────────────────────────────────────────────
  { id: "nodejs", name: "Node.js", desc: "JavaScript runtime built on V8 engine", pkg: "nodejs,npm", checkCmd: "node", icon: Zap, category: "runtime", tags: ["javascript", "server"] },
  { id: "python3", name: "Python 3", desc: "Popular programming language for scripting and web", pkg: "python3,python3-pip,python3-venv", checkCmd: "python3", icon: Zap, category: "runtime", tags: ["scripting", "ml", "web"] },
  { id: "golang", name: "Go (Golang)", desc: "Statically typed, compiled language by Google", pkg: "golang-go", checkCmd: "go", icon: Zap, category: "runtime", tags: ["compiled", "google"] },
  { id: "ruby", name: "Ruby", desc: "Dynamic language focused on simplicity and productivity", pkg: "ruby,ruby-dev", checkCmd: "ruby", icon: Zap, category: "runtime", tags: ["scripting", "rails"] },
  { id: "php", name: "PHP", desc: "Popular server-side scripting language for web", pkg: "php,php-fpm,php-cli,php-mysql,php-curl", checkCmd: "php", icon: Zap, category: "runtime", tags: ["web", "scripting"] },
  { id: "java", name: "Java (JDK)", desc: "Platform-independent programming language", pkg: "default-jdk", checkCmd: "javac", icon: Zap, category: "runtime", tags: ["jvm", "enterprise"] },
  { id: "bun", name: "Bun", desc: "Fast all-in-one JavaScript runtime & toolkit", script: "bun", checkCmd: "bun", icon: Zap, category: "runtime", tags: ["javascript", "fast", "bundler"] },
  { id: "deno", name: "Deno", desc: "Secure runtime for JavaScript and TypeScript", script: "deno", checkCmd: "deno", icon: Zap, category: "runtime", tags: ["typescript", "secure"] },
  { id: "rustup", name: "Rust", desc: "Memory-safe systems programming language", script: "rustup", checkCmd: "rustc", icon: Zap, category: "runtime", tags: ["systems", "memory-safe"] },
  { id: "nvm", name: "NVM", desc: "Node Version Manager — manage multiple Node.js versions", script: "nvm", checkCmd: "nvm", icon: Layers, category: "runtime", tags: ["node", "version-manager"] },
  { id: "dotnet", name: ".NET SDK", desc: "Microsoft's cross-platform development framework", script: "dotnet", checkCmd: "dotnet", icon: Zap, category: "runtime", tags: ["csharp", "microsoft", "cross-platform"] },
  { id: "elixir", name: "Elixir", desc: "Functional language for scalable and maintainable apps", pkg: "elixir", checkCmd: "elixir", icon: Zap, category: "runtime", tags: ["functional", "erlang", "concurrent"] },

  // ── Package Managers ───────────────────────────────────────────────
  { id: "pm2", name: "PM2", desc: "Production process manager for Node.js apps", script: "pm2", checkCmd: "pm2", icon: Play, category: "runtime", tags: ["process-manager", "node"] },
  { id: "yarn", name: "Yarn", desc: "Fast, reliable, secure dependency management", script: "yarn", checkCmd: "yarn", icon: Package, category: "runtime", tags: ["npm", "package-manager"] },
  { id: "pnpm", name: "pnpm", desc: "Fast, disk space efficient package manager", script: "pnpm", checkCmd: "pnpm", icon: Package, category: "runtime", tags: ["npm", "fast"] },
  { id: "composer", name: "Composer", desc: "Dependency manager for PHP", script: "composer", checkCmd: "composer", icon: Package, category: "runtime", tags: ["php", "package-manager"] },
  { id: "pipx", name: "pipx", desc: "Install Python CLI apps in isolated environments", pkg: "pipx", checkCmd: "pipx", icon: Package, category: "runtime", tags: ["python", "isolated"] },

  // ── Containers ─────────────────────────────────────────────────────
  { id: "docker", name: "Docker", desc: "Platform for developing, shipping, running containers", script: "docker", checkCmd: "docker", icon: Box, category: "container", tags: ["containerization", "devops"] },
  { id: "docker-compose", name: "Docker Compose", desc: "Define and run multi-container Docker applications", pkg: "docker-compose", checkCmd: "docker-compose", icon: Box, category: "container", tags: ["multi-container", "orchestration"] },
  { id: "podman", name: "Podman", desc: "Daemonless container engine compatible with Docker", pkg: "podman", checkCmd: "podman", icon: Box, category: "container", tags: ["rootless", "oci"] },
  { id: "lazydocker", name: "LazyDocker", desc: "Terminal UI for Docker and Docker Compose", script: "lazydocker", checkCmd: "lazydocker", icon: Box, category: "container", tags: ["tui", "docker"] },
  { id: "portainer", name: "Portainer", desc: "Web-based Docker management UI (runs on port 9443)", script: "portainer", checkCmd: "docker", icon: Monitor, category: "container", tags: ["web-ui", "management"] },
  { id: "buildah", name: "Buildah", desc: "Tool for building OCI container images", pkg: "buildah", checkCmd: "buildah", icon: Box, category: "container", tags: ["oci", "build"] },
  { id: "dive", name: "Dive", desc: "Explore Docker image layers and reduce image size", script: "dive", checkCmd: "dive", icon: Eye, category: "container", tags: ["image", "analysis", "optimization"] },

  // ── File Tools ─────────────────────────────────────────────────────
  { id: "mc", name: "Midnight Commander", desc: "Visual file manager with dual-panel interface", pkg: "mc", checkCmd: "mc", icon: FolderOpen, category: "filetools", tags: ["file-manager", "tui"] },
  { id: "ncdu", name: "ncdu", desc: "Disk usage analyzer with ncurses interface", pkg: "ncdu", checkCmd: "ncdu", icon: FolderOpen, category: "filetools", tags: ["disk", "usage"] },
  { id: "tree", name: "tree", desc: "List contents of directories in tree-like format", pkg: "tree", checkCmd: "tree", icon: FolderOpen, category: "filetools", tags: ["directory", "listing"] },
  { id: "rsync", name: "rsync", desc: "Fast, versatile file copying/syncing tool", pkg: "rsync", checkCmd: "rsync", icon: FolderOpen, category: "filetools", tags: ["sync", "backup"] },
  { id: "zip", name: "Zip / Unzip", desc: "Archive compression and extraction tools", pkg: "zip,unzip", checkCmd: "zip", icon: Archive, category: "filetools", tags: ["compression", "archive"] },
  { id: "p7zip", name: "7-Zip", desc: "High compression ratio file archiver (7z format)", pkg: "p7zip-full", checkCmd: "7z", icon: Archive, category: "filetools", tags: ["compression", "7z"] },
  { id: "fzf", name: "fzf", desc: "General-purpose command-line fuzzy finder", pkg: "fzf", checkCmd: "fzf", icon: Search, category: "filetools", tags: ["search", "fuzzy"] },
  { id: "ripgrep", name: "ripgrep", desc: "Recursively search directories with regex (faster than grep)", pkg: "ripgrep", checkCmd: "rg", icon: Search, category: "filetools", tags: ["search", "regex", "fast"] },
  { id: "rclone", name: "rclone", desc: "Manage files on cloud storage (S3, GDrive, etc.)", pkg: "rclone", checkCmd: "rclone", icon: Globe, category: "filetools", tags: ["cloud", "s3", "gdrive"] },
  { id: "bat", name: "bat", desc: "A cat clone with syntax highlighting and Git integration", pkg: "bat", checkCmd: "bat", icon: FileText, category: "filetools", tags: ["cat", "syntax", "preview"] },
  { id: "fd", name: "fd", desc: "Simple, fast alternative to 'find' command", pkg: "fd-find", checkCmd: "fdfind", icon: Search, category: "filetools", tags: ["find", "fast", "search"] },
  { id: "ranger", name: "Ranger", desc: "Console file manager with vi key bindings", pkg: "ranger", checkCmd: "ranger", icon: FolderOpen, category: "filetools", tags: ["file-manager", "vim", "tui"] },

  // ── Networking ─────────────────────────────────────────────────────
  { id: "traceroute", name: "traceroute", desc: "Trace the route packets take to a host", pkg: "traceroute", checkCmd: "traceroute", icon: Network, category: "networking", tags: ["diagnostic", "route"] },
  { id: "mtr", name: "mtr", desc: "Network diagnostic tool combining ping and traceroute", pkg: "mtr", checkCmd: "mtr", icon: Network, category: "networking", tags: ["diagnostic", "ping"] },
  { id: "dnsutils", name: "DNS Utils", desc: "DNS lookup tools (dig, nslookup, nsupdate)", pkg: "dnsutils", checkCmd: "dig", icon: Network, category: "networking", tags: ["dns", "lookup"] },
  { id: "iperf3", name: "iperf3", desc: "Network bandwidth measurement tool", pkg: "iperf3", checkCmd: "iperf3", icon: Network, category: "networking", tags: ["bandwidth", "speed-test"] },
  { id: "tcpdump", name: "tcpdump", desc: "Powerful command-line packet analyzer", pkg: "tcpdump", checkCmd: "tcpdump", icon: Network, category: "networking", tags: ["packets", "capture"] },
  { id: "socat", name: "socat", desc: "Multipurpose relay for bidirectional data transfer", pkg: "socat", checkCmd: "socat", icon: Network, category: "networking", tags: ["relay", "tunnel"] },
  { id: "speedtest", name: "Speedtest CLI", desc: "Command-line internet speed test", pkg: "speedtest-cli", checkCmd: "speedtest-cli", icon: Zap, category: "networking", tags: ["speed", "internet"] },
  { id: "squid", name: "Squid", desc: "Caching proxy for the web supporting HTTP, HTTPS", pkg: "squid", checkCmd: "squid", icon: Globe, category: "networking", tags: ["proxy", "cache"] },
  { id: "whois", name: "Whois", desc: "Domain and IP ownership lookup tool", pkg: "whois", checkCmd: "whois", icon: Globe, category: "networking", tags: ["domain", "lookup"] },
  { id: "netcat", name: "Netcat", desc: "Versatile networking utility for reading/writing data", pkg: "netcat-openbsd", checkCmd: "nc", icon: Network, category: "networking", tags: ["tcp", "udp", "utility"] },
  { id: "nginx-proxy-manager", name: "Nginx Proxy Manager", desc: "Easy-to-use reverse proxy with SSL and web UI", script: "nginx-proxy-manager", checkCmd: "docker", icon: Globe, category: "networking", tags: ["reverse-proxy", "ssl", "web-ui"] },

  // ── DNS ────────────────────────────────────────────────────────────
  { id: "bind9", name: "BIND9", desc: "The most widely used DNS server software", pkg: "bind9,bind9-utils", checkCmd: "named", icon: Globe, category: "dns", tags: ["dns", "authoritative", "resolver"] },
  { id: "dnsmasq", name: "Dnsmasq", desc: "Lightweight DNS forwarder and DHCP server", pkg: "dnsmasq", checkCmd: "dnsmasq", icon: Globe, category: "dns", tags: ["dns", "dhcp", "lightweight"] },

  // ── Media ──────────────────────────────────────────────────────────
  { id: "ffmpeg", name: "FFmpeg", desc: "Complete solution for recording, converting and streaming audio/video", pkg: "ffmpeg", checkCmd: "ffmpeg", icon: Image, category: "media", tags: ["video", "audio", "conversion"] },
  { id: "imagemagick", name: "ImageMagick", desc: "Create, edit, compose, convert bitmap images", pkg: "imagemagick", checkCmd: "convert", icon: Image, category: "media", tags: ["image", "conversion"] },
  { id: "yt-dlp", name: "yt-dlp", desc: "Feature-rich command-line audio/video downloader", script: "yt-dlp", checkCmd: "yt-dlp", icon: Image, category: "media", tags: ["download", "video", "audio"] },
  { id: "webp", name: "WebP Tools", desc: "Tools for encoding/decoding WebP image format", pkg: "webp", checkCmd: "cwebp", icon: Image, category: "media", tags: ["image", "webp", "optimization"] },

  // ── Backup ─────────────────────────────────────────────────────────
  { id: "borgbackup", name: "BorgBackup", desc: "Deduplicating archiver with compression and encryption", pkg: "borgbackup", checkCmd: "borg", icon: Archive, category: "backup", tags: ["dedup", "encrypted"] },
  { id: "restic", name: "Restic", desc: "Fast, secure, efficient backup program", pkg: "restic", checkCmd: "restic", icon: Archive, category: "backup", tags: ["fast", "encrypted", "cloud"] },
  { id: "duplicity", name: "Duplicity", desc: "Encrypted bandwidth-efficient backup using rsync algorithm", pkg: "duplicity", checkCmd: "duplicity", icon: Archive, category: "backup", tags: ["encrypted", "incremental"] },
  { id: "rdiff-backup", name: "rdiff-backup", desc: "Reverse differential backup utility", pkg: "rdiff-backup", checkCmd: "rdiff-backup", icon: Archive, category: "backup", tags: ["incremental", "reverse-diff"] },

  // ── System ─────────────────────────────────────────────────────────
  { id: "tmux", name: "tmux", desc: "Terminal multiplexer — run multiple shells in one window", pkg: "tmux", checkCmd: "tmux", icon: Terminal, category: "system", tags: ["terminal", "multiplexer"] },
  { id: "screen", name: "GNU Screen", desc: "Terminal multiplexer with session persistence", pkg: "screen", checkCmd: "screen", icon: Terminal, category: "system", tags: ["terminal", "session"] },
  { id: "supervisor", name: "Supervisor", desc: "Process control system for managing long-running processes", pkg: "supervisor", checkCmd: "supervisorctl", icon: Play, category: "system", tags: ["process", "daemon"] },
  { id: "logrotate", name: "logrotate", desc: "Rotates, compresses, and mails system logs", pkg: "logrotate", checkCmd: "logrotate", icon: FileText, category: "system", tags: ["logs", "rotation"] },
  { id: "lsof", name: "lsof", desc: "List open files — identify which processes use which files", pkg: "lsof", checkCmd: "lsof", icon: Eye, category: "system", tags: ["files", "processes"] },
  { id: "acl", name: "ACL", desc: "Access control lists for fine-grained file permissions", pkg: "acl", checkCmd: "getfacl", icon: Lock, category: "system", tags: ["permissions", "access"] },
  { id: "snapd", name: "Snap", desc: "Universal app platform for Linux (snap packages)", pkg: "snapd", checkCmd: "snap", icon: Package, category: "system", tags: ["packages", "universal"] },
  { id: "cron", name: "Cron", desc: "Standard Unix job scheduler for recurring tasks", pkg: "cron", checkCmd: "crontab", icon: Clock, category: "system", tags: ["scheduler", "jobs"] },
  { id: "systemd-timesyncd", name: "Timesyncd", desc: "Simple NTP time synchronization daemon", pkg: "systemd-timesyncd", checkCmd: "timedatectl", icon: Clock, category: "system", tags: ["ntp", "time", "sync"] },

  // ── Editors ────────────────────────────────────────────────────────
  { id: "vim", name: "Vim", desc: "Highly configurable text editor for efficient editing", pkg: "vim", checkCmd: "vim", icon: Terminal, category: "editor", tags: ["modal", "classic"] },
  { id: "neovim", name: "Neovim", desc: "Hyperextensible Vim-based text editor", pkg: "neovim", checkCmd: "nvim", icon: Terminal, category: "editor", tags: ["modern", "extensible"] },
  { id: "nano", name: "nano", desc: "Simple, beginner-friendly terminal text editor", pkg: "nano", checkCmd: "nano", icon: Terminal, category: "editor", tags: ["simple", "beginner"] },
  { id: "micro", name: "micro", desc: "Modern and intuitive terminal-based text editor", pkg: "micro", checkCmd: "micro", icon: Terminal, category: "editor", tags: ["modern", "easy"] },
  { id: "emacs", name: "Emacs", desc: "Extensible, customizable text editor and computing environment", pkg: "emacs-nox", checkCmd: "emacs", icon: Terminal, category: "editor", tags: ["extensible", "lisp"] },

  // ── SSL ────────────────────────────────────────────────────────────
  { id: "certbot", name: "Certbot", desc: "Automatically obtain and renew free SSL certificates from Let's Encrypt", pkg: "certbot", checkCmd: "certbot", icon: Lock, category: "ssl", tags: ["letsencrypt", "https"] },
  { id: "certbot-nginx", name: "Certbot Nginx", desc: "Nginx plugin for Certbot — auto-configure SSL for Nginx", pkg: "python3-certbot-nginx", checkCmd: "certbot", icon: Lock, category: "ssl", tags: ["nginx", "letsencrypt"] },
  { id: "certbot-apache", name: "Certbot Apache", desc: "Apache plugin for Certbot — auto-configure SSL for Apache", pkg: "python3-certbot-apache", checkCmd: "certbot", icon: Lock, category: "ssl", tags: ["apache", "letsencrypt"] },
  { id: "mkcert", name: "mkcert", desc: "Simple tool for making locally-trusted development certificates", script: "mkcert", checkCmd: "mkcert", icon: Lock, category: "ssl", tags: ["local", "development", "certificates"] },

  // ── Version Control ────────────────────────────────────────────────
  { id: "gh-cli", name: "GitHub CLI", desc: "Official GitHub command-line tool for managing repos, PRs, issues", script: "gh-cli", checkCmd: "gh", icon: GitBranch, category: "vcs", tags: ["github", "cli"] },
  { id: "subversion", name: "Subversion", desc: "Centralized version control system", pkg: "subversion", checkCmd: "svn", icon: GitBranch, category: "vcs", tags: ["svn", "centralized"] },
  { id: "wp-cli", name: "WP-CLI", desc: "Command-line interface for WordPress management", script: "wp-cli", checkCmd: "wp", icon: Globe, category: "vcs", tags: ["wordpress", "cli"] },
  { id: "gitlab-runner", name: "GitLab Runner", desc: "CI/CD runner for GitLab pipelines", script: "gitlab-runner", checkCmd: "gitlab-runner", icon: GitBranch, category: "vcs", tags: ["ci-cd", "gitlab", "automation"] },

  // ── Communication ──────────────────────────────────────────────────
  { id: "postfix", name: "Postfix", desc: "Fast, easy-to-administer mail transfer agent", pkg: "postfix", checkCmd: "postfix", icon: MessageSquare, category: "communication", tags: ["mail", "smtp"] },
  { id: "dovecot", name: "Dovecot", desc: "Secure IMAP and POP3 server", pkg: "dovecot-imapd", checkCmd: "dovecot", icon: MessageSquare, category: "communication", tags: ["imap", "pop3", "mail"] },

  // ── Admin Panels ───────────────────────────────────────────────────
  { id: "cockpit", name: "Cockpit", desc: "Web-based graphical server management interface", pkg: "cockpit", checkCmd: "cockpit-bridge", icon: Monitor, category: "panel", tags: ["web-ui", "management"] },
  { id: "webmin", name: "Webmin", desc: "Web-based system administration interface", pkg: "webmin", checkCmd: "webmin", icon: Monitor, category: "panel", tags: ["web-ui", "admin"] },
  { id: "uptime-kuma", name: "Uptime Kuma", desc: "Self-hosted monitoring tool with beautiful web UI (port 3001)", script: "uptime-kuma", checkCmd: "docker", icon: Activity, category: "panel", tags: ["uptime", "monitoring", "web-ui"] },
  { id: "phpmyadmin", name: "phpMyAdmin", desc: "Web-based MySQL/MariaDB administration tool", script: "phpmyadmin", checkCmd: "php", icon: Database, category: "panel", tags: ["mysql", "web-ui", "admin"] },
  { id: "adminer", name: "Adminer", desc: "Full-featured database management tool in a single PHP file", script: "adminer", checkCmd: "php", icon: Database, category: "panel", tags: ["database", "web-ui", "lightweight"] },
];

// ─── Deploy Templates ────────────────────────────────────────────────
export const DEPLOY_TEMPLATES: DeployTemplate[] = [
  {
    id: "node-app", name: "Node.js App", desc: "Clone a Node.js repo, install deps, and run with PM2",
    icon: Zap, runtime: "node",
    steps: `cd __DIR__ && npm install 2>&1 && (which pm2 >/dev/null 2>&1 || sudo npm install -g pm2 2>&1) && pm2 start npm --name __NAME__ -- start 2>&1`,
    port: "3000",
  },
  {
    id: "python-app", name: "Python App", desc: "Clone a Python repo, set up venv, install requirements, and run",
    icon: Zap, runtime: "python3",
    steps: `cd __DIR__ && python3 -m venv venv 2>&1 && source venv/bin/activate && pip install -r requirements.txt 2>&1 && nohup python3 app.py > output.log 2>&1 &`,
    port: "5000",
  },
  {
    id: "static-site", name: "Static Site", desc: "Clone and serve with Nginx — perfect for React, Vue, HTML sites",
    icon: Globe, runtime: "nginx",
    steps: `cd __DIR__ && ([ -f package.json ] && npm install && npm run build 2>&1 || true) && WEBROOT=$([ -d dist ] && echo dist || ([ -d build ] && echo build || echo .)) && sudo ln -sf $(pwd)/$WEBROOT /var/www/__NAME__ 2>&1`,
  },
  {
    id: "docker-app", name: "Docker Compose App", desc: "Clone a repo with docker-compose.yml and start all services",
    icon: Box, runtime: "docker",
    steps: `cd __DIR__ && (docker compose up -d 2>&1 || docker-compose up -d 2>&1)`,
  },
  {
    id: "dotnet-app", name: ".NET App", desc: "Clone a .NET repo, restore, build, and run as a service",
    icon: Code, runtime: "dotnet",
    steps: `cd __DIR__ && dotnet restore 2>&1 && dotnet build -c Release 2>&1 && nohup dotnet run --configuration Release > output.log 2>&1 &`,
    port: "5000",
  },
  {
    id: "go-app", name: "Go App", desc: "Clone a Go repo, build, and run the binary",
    icon: Zap, runtime: "go",
    steps: `cd __DIR__ && go build -o app . 2>&1 && nohup ./app > output.log 2>&1 &`,
    port: "8080",
  },
  {
    id: "php-app", name: "PHP App", desc: "Clone a PHP repo, install Composer deps, configure for Apache/Nginx",
    icon: Code, runtime: "php",
    steps: `cd __DIR__ && ([ -f composer.json ] && composer install 2>&1 || true) && sudo ln -sf $(pwd) /var/www/__NAME__ 2>&1`,
    port: "80",
  },
  {
    id: "ruby-app", name: "Ruby / Rails App", desc: "Clone a Ruby repo, bundle install, and start with Puma",
    icon: Zap, runtime: "ruby",
    steps: `cd __DIR__ && bundle install 2>&1 && ([ -f bin/rails ] && RAILS_ENV=production bundle exec rails server -d 2>&1 || nohup ruby app.rb > output.log 2>&1 &)`,
    port: "3000",
  },
  {
    id: "custom", name: "Custom", desc: "Clone any repo and run your own setup commands",
    icon: Terminal, runtime: "any",
    steps: "",
  },
];
