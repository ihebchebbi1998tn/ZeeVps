/**
 * ZeeVPS — SSH API Client
 * All remote server communication through Supabase Edge Functions.
 * 
 * @author Iheb Chebbi
 */

import { supabase } from "@/integrations/supabase/client";

export interface SystemInfo {
  hostname: string; kernel: string; uptime: string; cpuCores: number;
  memTotal: number; memUsed: number; memFree: number;
  diskTotal: number; diskUsed: number; diskFree: number;
  loadAvg: string; os: string; netRx: number; netTx: number; cpuPercent: number;
}

export interface ServiceInfo { name: string; load: string; active: string; sub: string; description: string; }

export interface RemoteFile {
  name: string; path: string; type: "file" | "directory" | "symlink";
  size: number; permissions: string; owner: string; group: string; modified: string;
}

export interface CommandResult { output: string; stderr: string; exitCode: number; }

export interface ProcessInfo {
  user: string; pid: string; cpu: number; mem: number; vsz: string; rss: string;
  stat: string; started: string; time: string; command: string;
}

import { getVpsConfig } from "@/lib/vps-config";

async function sshRequest<T>(body: Record<string, unknown>): Promise<T> {
  const config = getVpsConfig();
  const payload = config
    ? { ...body, host: config.host, port: config.port, username: config.username, password: config.password }
    : body;
  const { data, error } = await supabase.functions.invoke("ssh-proxy", { body: payload });
  if (error) throw new Error(error.message || "SSH request failed");
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function testConnection(): Promise<{ success: boolean; hostname?: string; error?: string }> {
  return sshRequest({ action: "test_connection" });
}
export async function getSystemInfo(): Promise<SystemInfo> { return sshRequest({ action: "system_info" }); }
export async function getServices(): Promise<{ services: ServiceInfo[] }> { return sshRequest({ action: "services" }); }
export async function listFiles(path: string): Promise<{ files: RemoteFile[]; currentPath: string }> { return sshRequest({ action: "list_files", path }); }
export async function readFile(path: string): Promise<{ content: string; path: string }> { return sshRequest({ action: "read_file", path }); }
export async function writeFile(path: string, content: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "write_file", path, content }); }
export async function deleteFile(path: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "delete_file", path }); }
export async function renameFile(path: string, newPath: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "rename_file", path, newPath }); }
export async function createFolder(path: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "create_folder", path }); }
export async function uploadFile(path: string, fileData: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "upload_file", path, fileData }); }
export async function downloadFile(path: string): Promise<{ data: string; error?: string; mimeGuess?: string }> { return sshRequest({ action: "download_file", path }); }
export async function zipDownload(path: string): Promise<{ data: string; error?: string }> { return sshRequest({ action: "zip_download", path }); }
export async function getFileInfo(path: string): Promise<{ stat: string; fileType: string; path: string }> { return sshRequest({ action: "file_info", path }); }
export async function chmodFile(path: string, permissions: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "chmod", path, command: permissions }); }
export async function executeCommand(command: string): Promise<CommandResult> { return sshRequest({ action: "execute", command }); }
export async function getServiceLogs(service: string, lines = 100): Promise<{ logs: string; service: string }> { return sshRequest({ action: "service_logs", service, lines }); }
export async function getSystemLogs(lines = 100): Promise<{ logs: string }> { return sshRequest({ action: "system_logs", lines }); }
export async function getProcesses(): Promise<{ processes: ProcessInfo[] }> { return sshRequest({ action: "processes" }); }
export async function killProcess(pid: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "kill_process", command: pid }); }
export async function getOpenPorts(): Promise<{ output: string }> { return sshRequest({ action: "open_ports" }); }
export async function getActiveConnections(): Promise<{ output: string }> { return sshRequest({ action: "active_connections" }); }
export async function getIptablesRules(): Promise<{ output: string; stderr?: string }> { return sshRequest({ action: "iptables_rules" }); }
export async function addIptablesRule(command: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "iptables_add", command }); }
export async function deleteIptablesRule(command: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "iptables_delete", command }); }

export interface SecurityAudit {
  lastlog: string; loginHistory: string; fail2ban: string; sshConfig: string;
  ufw: string; cronJobs: string; activeUsers: string; failedLogins: string;
  nginxDomains: string; apacheDomains: string;
}

export async function getSecurityAudit(): Promise<SecurityAudit> { return sshRequest({ action: "security_audit" }); }
export async function installPackage(pkg: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "install_package", command: pkg }); }
export async function installScript(script: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "install_script", command: script }); }
export async function uninstallPackage(pkg: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "uninstall_package", command: pkg }); }
export async function checkInstalled(names: string[]): Promise<{ installed: Record<string, boolean> }> { return sshRequest({ action: "check_installed", command: names.join(",") }); }
export async function enableUfw(): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "enable_ufw" }); }
export async function ufwRule(rule: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "ufw_rule", command: rule }); }

export interface GeoInfo { query: string; status: string; country?: string; regionName?: string; city?: string; isp?: string; }
export async function geoLookup(ips: string[]): Promise<{ geoData: GeoInfo[] }> { return sshRequest({ action: "geo_lookup", command: ips.join(",") }); }

export async function manageNginxDomain(domain: string, config: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "manage_nginx_domain", command: domain, content: config }); }
export async function deleteNginxDomain(domain: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "delete_nginx_domain", command: domain }); }
export async function readNginxConfig(path: string): Promise<{ content: string; error?: string }> { return sshRequest({ action: "read_nginx_config", command: path }); }

// Cron Jobs
export async function getCronJobs(): Promise<{ userCron: string; systemCron: string }> { return sshRequest({ action: "cron_list" }); }
export async function saveCrontab(content: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "cron_save", content }); }
export async function addCronJob(entry: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "cron_add", command: entry }); }
export async function deleteCronJob(pattern: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "cron_delete", command: pattern }); }

// Docker
export interface DockerContainer { ID: string; Names: string; Image: string; Status: string; State: string; Ports: string; CreatedAt: string; Size: string; }
export interface DockerImage { Repository: string; Tag: string; ID: string; Size: string; CreatedAt: string; }
export async function getDockerContainers(): Promise<{ containers: DockerContainer[]; error?: string }> { return sshRequest({ action: "docker_ps" }); }
export async function getDockerImages(): Promise<{ images: DockerImage[] }> { return sshRequest({ action: "docker_images" }); }
export async function dockerAction(action: string, container: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "docker_action", command: action, service: container }); }
export async function dockerInspect(container: string): Promise<{ data: any; error?: string }> { return sshRequest({ action: "docker_inspect", service: container }); }
export async function getDockerStats(): Promise<{ stats: any[] }> { return sshRequest({ action: "docker_stats" }); }
export async function dockerComposeUp(path: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "docker_compose_up", path }); }
export async function dockerComposeDown(path: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "docker_compose_down", path }); }
export async function dockerPull(image: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "docker_pull", service: image }); }
export async function getDockerNetworks(): Promise<{ networks: any[] }> { return sshRequest({ action: "docker_networks" }); }
export async function getDockerVolumes(): Promise<{ volumes: any[] }> { return sshRequest({ action: "docker_volumes" }); }

// UFW parsed
export async function getUfwStatusParsed(): Promise<{ output: string; error?: string }> { return sshRequest({ action: "ufw_status_parsed" }); }

// PostgreSQL
export interface PgStatus { status: string; version: string; databases: string[]; }
export interface PgTable { name: string; size: string; columns: number; }
export interface PgColumn { name: string; type: string; nullable: boolean; default: string | null; }
export interface PgQueryResult { columns: string[]; rows: string[][]; raw: string; error?: string; exitCode?: number; }
export async function getPgStatus(): Promise<PgStatus> { return sshRequest({ action: "pg_status" }); }
export async function pgListTables(database: string): Promise<{ tables: PgTable[]; error?: string }> { return sshRequest({ action: "pg_list_tables", command: database }); }
export async function pgTableSchema(database: string, table: string): Promise<{ columns: PgColumn[]; error?: string }> { return sshRequest({ action: "pg_table_schema", command: database, service: table }); }
export async function pgQuery(database: string, query: string): Promise<PgQueryResult> { return sshRequest({ action: "pg_query", command: database, content: query }); }
export async function pgCreateDb(name: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "pg_create_db", command: name }); }
export async function pgDropDb(name: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "pg_drop_db", command: name }); }
export async function pgTableData(database: string, table: string, limit?: number): Promise<{ columns: string[]; rows: string[][]; error?: string }> { return sshRequest({ action: "pg_table_data", command: database, service: table, lines: limit }); }
export async function pgSetup(): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "pg_setup" }); }

// Security Features
export async function readSshdConfig(): Promise<{ content: string; error?: string }> { return sshRequest({ action: "read_sshd_config" }); }
export async function writeSshdConfig(content: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "write_sshd_config", content }); }
export async function sshdHarden(setting: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "sshd_harden", command: setting }); }

export async function f2bStatus(): Promise<{ output: string; error?: string; installed: boolean }> { return sshRequest({ action: "f2b_status" }); }
export async function f2bJailStatus(jail: string): Promise<{ output: string; error?: string }> { return sshRequest({ action: "f2b_jail_status", command: jail }); }
export async function f2bBanIp(jail: string, ip: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "f2b_ban_ip", command: jail, service: ip }); }
export async function f2bUnbanIp(jail: string, ip: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "f2b_unban_ip", command: jail, service: ip }); }
export async function f2bReadJailConfig(): Promise<{ content: string; error?: string }> { return sshRequest({ action: "f2b_read_jail_config" }); }
export async function f2bWriteJailConfig(content: string): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "f2b_write_jail_config", content }); }

export interface SecurityToolsStatus {
  fail2ban: boolean; ufw: boolean; clamav: boolean; rkhunter: boolean; lynis: boolean;
  google_auth: boolean; aide: boolean; auditd: boolean; apparmor: boolean; unattended_upgrades: boolean;
}
export async function securityToolsCheck(): Promise<SecurityToolsStatus> { return sshRequest({ action: "security_tools_check" }); }

export async function runLynis(): Promise<{ output: string; error?: string }> { return sshRequest({ action: "run_lynis" }); }
export async function runRkhunter(): Promise<{ output: string; error?: string }> { return sshRequest({ action: "run_rkhunter" }); }
export async function runClamscan(path?: string): Promise<{ output: string; error?: string }> { return sshRequest({ action: "run_clamscan", path }); }

export async function readSecurityFile(path: string): Promise<{ content: string; error?: string }> { return sshRequest({ action: "read_security_file", path }); }
export async function writeSecurityFile(path: string, content: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "write_security_file", path, content }); }
export async function applySysctl(): Promise<{ success: boolean; output?: string; error?: string }> { return sshRequest({ action: "apply_sysctl" }); }

// IP Whitelist / Blacklist
export interface WhitelistData { hostsAllow: string; hostsDeny: string; f2bIgnoreIp: string; }
export async function getWhitelist(): Promise<WhitelistData> { return sshRequest({ action: "get_whitelist" }); }
export async function addWhitelistIp(ip: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "add_whitelist_ip", command: ip }); }
export async function removeWhitelistIp(ip: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "remove_whitelist_ip", command: ip }); }
export async function addBlacklistIp(ip: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "add_blacklist_ip", command: ip }); }
export async function removeBlacklistIp(ip: string): Promise<{ success: boolean; error?: string }> { return sshRequest({ action: "remove_blacklist_ip", command: ip }); }

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatPercent(used: number, total: number): string {
  if (total === 0) return "0%";
  return Math.round((used / total) * 100) + "%";
}
