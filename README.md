<p align="center">
  <img src="https://storage.googleapis.com/gpt-engineer-file-uploads/rR0DyvKGIFZy0Uan8s996rt0Zt03/uploads/1770904637779-images.png" alt="ZeeVPS Logo" width="80" />
</p>

<h1 align="center">ZeeVPS</h1>
<p align="center"><strong>A full-featured, web-based server management panel for Linux VPS instances.</strong></p>
<p align="center">
  <a href="https://www.linkedin.com/in/iheb-chebbi-899462237/">
    <img src="https://img.shields.io/badge/Author-Iheb%20Chebbi-blue?style=flat-square&logo=linkedin" alt="Author" />
  </a>
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5-646cff?style=flat-square&logo=vite" alt="Vite" />
</p>

---

## Overview

ZeeVPS is a modern, browser-based control panel that connects to any Linux server over SSH. It provides real-time monitoring, file management, service control, security auditing, Docker administration, and more — all through an intuitive dark-themed dashboard.

Built with **React 18**, **TypeScript**, and **Tailwind CSS**, the frontend communicates with the remote server through a **Supabase Edge Function** that acts as a secure SSH proxy.

---

## Screenshots

### Connection Screen
The login gate authenticates against your VPS via SSH. Credentials are stored in `localStorage` and never transmitted to third parties.

### System Overview
Real-time CPU, memory, disk, and network metrics with historical resource charts, gauge visualizations, and a services summary table.

### File Manager
Full remote file browser with upload, download, edit, rename, chmod, create folder, and multi-file zip download support. Includes a sidebar with quick-access locations (Home, Root, Logs, Config).

### Services Manager
View all 60+ systemd services with status indicators. Start, stop, and restart services directly. Filter by running/active/failed state and search by name.

### Security Center
10-tab security dashboard: SSH hardening controls, failed login analysis with geo-located attack map (Leaflet), Fail2Ban management, UFW firewall rules, IP whitelist/blacklist, security tool installation (ClamAV, rkhunter, Lynis, AppArmor), config file editor, and vulnerability scans.

### Docker Manager
Manage containers, images, networks, and volumes. Pull images, start/stop/restart containers, inspect configuration, and view real-time stats.

### App Store
144 packages across 21 categories — install databases, web servers, runtimes, security tools, monitoring agents, and more with a single click.

### SSL Certificate Manager
Issue, renew, revoke, and upload SSL certificates. Supports Let's Encrypt (Nginx/Apache/Standalone/DNS/Wildcard), self-signed (OpenSSL), and mkcert for local development. Auto-renewal via cron.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                   │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Overview  │ │  Files   │ │ Security │ │  Docker   │  │
│  │  Page     │ │ Browser  │ │  Center  │ │  Manager  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       │             │            │              │        │
│       └─────────────┴────────────┴──────────────┘        │
│                          │                               │
│                   ssh-api.ts (API client)                │
│                          │                               │
│              supabase.functions.invoke()                 │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────┐
│              Supabase Edge Function                      │
│              supabase/functions/ssh-proxy/index.ts        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Deno Runtime                                      │  │
│  │  ├─ CORS handling                                  │  │
│  │  ├─ Request validation & action routing            │  │
│  │  ├─ SSH connection via ssh2 (npm)                  │  │
│  │  ├─ Command execution with timeout                 │  │
│  │  └─ JSON response serialization                    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ SSH (port 22)
                           ▼
┌──────────────────────────────────────────────────────────┐
│                   Target Linux VPS                       │
│  Ubuntu / Debian / CentOS / Any Linux with SSH           │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | React 18 + TypeScript | Component-based SPA with type safety |
| **Styling** | Tailwind CSS + shadcn/ui | Utility-first CSS with accessible primitives |
| **Build Tool** | Vite 5 | Fast HMR, ES module bundling |
| **State Management** | TanStack React Query | Server state caching and synchronization |
| **Charts** | Recharts | CPU/RAM/Disk gauges and time-series graphs |
| **Maps** | Leaflet | Geo-located attack origin visualization |
| **Routing** | React Router v6 | Client-side SPA routing |
| **Toast/Notifications** | Sonner | Non-blocking user feedback |
| **Backend Proxy** | Supabase Edge Functions (Deno) | Serverless SSH proxy |
| **SSH Library** | ssh2 (npm) | Node.js SSH2 client for remote execution |

---

## Modules

| Module | Route | Description |
|--------|-------|-------------|
| **Overview** | `/` | Real-time system metrics, resource gauges, history charts, services summary |
| **File Manager** | `/files` | Browse, upload, download, edit, rename, chmod, zip download |
| **Services** | `/services` | List, start, stop, restart systemd services with search and filters |
| **Processes** | `/processes` | Running processes with CPU/memory usage, kill support |
| **Logs** | `/logs` | Real-time system and service log streaming with search |
| **Terminal** | `/terminal` | Execute shell commands directly on the server |
| **Network** | `/network` | Open ports, active connections, iptables/UFW rules |
| **Security** | `/security` | SSH hardening, Fail2Ban, UFW, whitelist, attack map, scans, config editor |
| **Cron Jobs** | `/cron` | View, add, edit, delete crontab entries |
| **Docker** | `/docker` | Containers, images, networks, volumes, compose, stats |
| **App Store** | `/apps` | 144 packages across 21 categories with one-click install |
| **Benchmarks** | `/benchmarks` | CPU, disk I/O, memory, and network speed tests |
| **Backups** | `/backups` | Create, schedule, and restore tar.gz backups |
| **SSH Keys** | `/ssh-keys` | Manage authorized_keys, generate key pairs |
| **SSL Certs** | `/ssl` | Let's Encrypt, self-signed, mkcert, custom upload, auto-renewal |
| **DNS** | `/dns` | DNS record management |
| **Database** | `/database` | PostgreSQL: databases, tables, schema, SQL query execution |
| **Settings** | `/settings` | SSH connection config, test, disconnect |

---

## Prerequisites

- **Node.js** ≥ 18 (or **Bun** ≥ 1.0)
- **Git**
- A **Supabase** account (free tier is sufficient) — [supabase.com](https://supabase.com)
- A Linux VPS with SSH access (Ubuntu/Debian recommended)

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/zeevps.git
cd zeevps
```

### 2. Install Dependencies

```bash
npm install
# or
bun install
```

### 3. Create Supabase Project

1. Sign in at [supabase.com](https://supabase.com)
2. Click **New Project**, fill in details, wait for provisioning
3. Go to **Settings → API** and copy:
   - **Project URL** (`https://xxxxx.supabase.co`)
   - **Anon / Public Key** (`eyJ...`)

### 4. Environment Variables

Create `.env` in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
```

> **Security**: `.env` is in `.gitignore` — never commit it.

### 5. Deploy the SSH Proxy Edge Function

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link
supabase login
supabase link --project-ref your-project-id

# Deploy
supabase functions deploy ssh-proxy
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and connect to your VPS.

---

## Edge Function API Reference

The SSH proxy (`supabase/functions/ssh-proxy/index.ts`) exposes a single POST endpoint that accepts JSON with an `action` field. All actions require SSH credentials in the request body (`host`, `port`, `username`, `password`).

### System Actions

| Action | Parameters | Response |
|--------|-----------|----------|
| `test_connection` | — | `{ success, hostname }` |
| `system_info` | — | `{ hostname, kernel, uptime, cpuCores, memTotal, memUsed, diskTotal, diskUsed, loadAvg, os, netRx, netTx, cpuPercent }` |
| `execute` | `command` | `{ output, stderr, exitCode }` |
| `processes` | — | `{ processes: [{ user, pid, cpu, mem, command }] }` |
| `kill_process` | `command` (PID) | `{ success }` |

### File Operations

| Action | Parameters | Response |
|--------|-----------|----------|
| `list_files` | `path` | `{ files: [{ name, path, type, size, permissions, owner, modified }] }` |
| `read_file` | `path` | `{ content, path }` |
| `write_file` | `path`, `content` | `{ success }` |
| `upload_file` | `path`, `fileData` (base64) | `{ success }` |
| `download_file` | `path` | `{ data }` (base64) |
| `delete_file` | `path` | `{ success }` |
| `rename_file` | `path`, `newPath` | `{ success }` |
| `create_folder` | `path` | `{ success }` |
| `chmod` | `path`, `command` (perms) | `{ success }` |

### Service Management

| Action | Parameters | Response |
|--------|-----------|----------|
| `services` | — | `{ services: [{ name, load, active, sub, description }] }` |
| `service_logs` | `service`, `lines` | `{ logs, service }` |
| `system_logs` | `lines` | `{ logs }` |

### Security

| Action | Parameters | Response |
|--------|-----------|----------|
| `security_audit` | — | `{ lastlog, loginHistory, fail2ban, sshConfig, ufw, cronJobs, activeUsers, failedLogins, nginxDomains, apacheDomains }` |
| `read_sshd_config` | — | `{ content }` |
| `write_sshd_config` | `content` | `{ success }` |
| `sshd_harden` | `command` (setting) | `{ success }` |
| `f2b_status` | — | `{ output, installed }` |
| `f2b_ban_ip` | `command` (jail), `service` (IP) | `{ success }` |
| `security_tools_check` | — | `{ fail2ban, ufw, clamav, rkhunter, lynis, auditd, apparmor, ... }` |
| `run_lynis` / `run_rkhunter` / `run_clamscan` | `path`? | `{ output }` |

### Docker

| Action | Parameters | Response |
|--------|-----------|----------|
| `docker_ps` | — | `{ containers: [{ ID, Names, Image, Status, State, Ports }] }` |
| `docker_images` | — | `{ images: [{ Repository, Tag, ID, Size }] }` |
| `docker_action` | `command` (start/stop/restart/rm), `service` (container) | `{ success, output }` |
| `docker_inspect` | `service` (container) | `{ data }` |
| `docker_pull` | `service` (image) | `{ success, output }` |
| `docker_networks` | — | `{ networks }` |
| `docker_volumes` | — | `{ volumes }` |

### Database (PostgreSQL)

| Action | Parameters | Response |
|--------|-----------|----------|
| `pg_status` | — | `{ status, version, databases }` |
| `pg_list_tables` | `command` (db) | `{ tables: [{ name, size, columns }] }` |
| `pg_query` | `command` (db), `content` (SQL) | `{ columns, rows }` |
| `pg_create_db` | `command` (name) | `{ success }` |
| `pg_drop_db` | `command` (name) | `{ success }` |

---

## Project Structure

```
zeevps/
├── public/                       # Static assets & favicon
├── src/
│   ├── components/
│   │   ├── DashboardLayout.tsx   # Main layout wrapper (sidebar + header)
│   │   ├── DashboardSidebar.tsx  # Navigation sidebar with all module links
│   │   ├── VpsSetupGate.tsx      # Connection gate (login screen)
│   │   ├── NavLink.tsx           # Active-aware navigation link
│   │   └── ui/                   # shadcn/ui primitives (Button, Card, Dialog, etc.)
│   ├── hooks/
│   │   ├── use-mobile.tsx        # Responsive breakpoint hook
│   │   └── use-toast.ts          # Toast notification system
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts         # Supabase client initialization
│   │       └── types.ts          # Database type definitions
│   ├── lib/
│   │   ├── ssh-api.ts            # SSH API client (all 50+ remote operations)
│   │   ├── vps-config.ts         # Credential storage (localStorage)
│   │   ├── app-store-data.ts     # 144 package definitions for App Store
│   │   └── utils.ts              # Utility functions (cn, etc.)
│   ├── pages/                    # 18 route-level page components
│   │   ├── Overview.tsx          # System dashboard with charts
│   │   ├── FileBrowserPage.tsx   # File manager
│   │   ├── Services.tsx          # Systemd service management
│   │   ├── SecurityPage.tsx      # Security center (1300+ lines)
│   │   ├── SSLPage.tsx           # SSL certificate management
│   │   ├── DockerPage.tsx        # Docker administration
│   │   ├── AppStorePage.tsx      # Package installer
│   │   ├── DatabasePage.tsx      # PostgreSQL manager
│   │   └── ...                   # Terminal, Logs, Network, DNS, etc.
│   ├── App.tsx                   # Root component with route definitions
│   ├── main.tsx                  # Application entry point
│   └── index.css                 # Design system tokens (HSL-based)
├── supabase/
│   ├── config.toml               # Supabase project configuration
│   └── functions/
│       └── ssh-proxy/
│           └── index.ts          # Edge function: SSH proxy (1100+ lines)
├── LICENSE                       # MIT License
├── vite.config.ts                # Vite build configuration
├── tailwind.config.ts            # Tailwind theme extensions
└── tsconfig.json                 # TypeScript configuration
```

---

## Building for Production

```bash
npm run build
```

Output is in `dist/`. Deploy to any static host:
- **Vercel**: `vercel --prod`
- **Netlify**: drag `dist/` to Netlify dashboard
- **Cloudflare Pages**: connect Git repo
- **Nginx**: copy `dist/` to web root

### Vercel Configuration

A `vercel.json` is included for SPA routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| **Credential Storage** | Browser `localStorage` only — never sent to third parties |
| **Transport** | All SSH traffic proxied through HTTPS (Supabase Edge Functions) |
| **SSH Connection** | Established per-request with 10s timeout; connection closed after each operation |
| **Command Validation** | Package install/uninstall restricted to a curated allowlist of 120+ packages |
| **CORS** | Proper preflight handling with restrictive headers |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "Add my feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

Please follow the existing code style — TypeScript strict mode, Tailwind semantic tokens, and component-level JSDoc headers.

---

## License

MIT License — Copyright (c) 2024-2026 [Iheb Chebbi](https://www.linkedin.com/in/iheb-chebbi-899462237/)

See [LICENSE](./LICENSE) for full text.

---

<p align="center">
  <sub>Designed and developed with ❤️ by <a href="https://www.linkedin.com/in/iheb-chebbi-899462237/">Iheb Chebbi</a></sub>
</p>
