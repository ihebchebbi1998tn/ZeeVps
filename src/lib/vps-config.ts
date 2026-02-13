/**
 * ZeeVPS — VPS Configuration Store
 * Manages SSH credentials in browser localStorage.
 * 
 * @author Iheb Chebbi
 */

const STORAGE_KEY = "vps_config";

export interface VpsConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export function getVpsConfig(): VpsConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.host || !parsed.username || !parsed.password) return null;
    return parsed as VpsConfig;
  } catch {
    return null;
  }
}

export function setVpsConfig(config: VpsConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearVpsConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isVpsConfigured(): boolean {
  return getVpsConfig() !== null;
}
