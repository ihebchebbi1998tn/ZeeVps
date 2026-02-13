import {
  LayoutDashboard,
  Server,
  FolderOpen,
  TerminalSquare,
  Settings,
  ScrollText,
  Activity,
  Network,
  ShieldCheck,
  Clock,
  Box,
  Package,
  Zap,
  FolderArchive,
  Key,
  Lock,
  Globe,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const LOGO_URL = "https://storage.googleapis.com/gpt-engineer-file-uploads/rR0DyvKGIFZy0Uan8s996rt0Zt03/uploads/1770904637779-images.png";

const mainItems = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Files", url: "/files", icon: FolderOpen },
  { title: "Services", url: "/services", icon: Server },
  { title: "Processes", url: "/processes", icon: Activity },
  { title: "Logs", url: "/logs", icon: ScrollText },
  { title: "Terminal", url: "/terminal", icon: TerminalSquare },
  { title: "Network", url: "/network", icon: Network },
  { title: "Security", url: "/security", icon: ShieldCheck },
  { title: "Cron Jobs", url: "/cron", icon: Clock },
  { title: "Docker", url: "/docker", icon: Box },
  { title: "App Store", url: "/apps", icon: Package },
  { title: "Benchmarks", url: "/benchmarks", icon: Zap },
  { title: "Backups", url: "/backups", icon: FolderArchive },
  { title: "SSH Keys", url: "/ssh-keys", icon: Key },
  { title: "SSL Certs", url: "/ssl", icon: Lock },
  { title: "DNS", url: "/dns", icon: Globe },
];

const systemItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function DashboardSidebar() {
  return (
    <Sidebar className="border-r border-border/50 bg-sidebar">
      {/* Brand header */}
      <div className="flex h-11 items-center gap-2.5 border-b border-border/50 px-4">
        <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
          <img src={LOGO_URL} alt="ZeeVps" className="h-4 w-4 rounded-sm" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">ZeeVps</span>
      </div>

      <SidebarContent className="px-2 pt-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60 px-3 mb-1">
            Server
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-primary/10 text-primary font-medium border border-primary/15"
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60 px-3 mb-1">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-primary/10 text-primary font-medium border border-primary/15"
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <div className="mt-auto border-t border-border/40 px-4 py-2.5 space-y-0.5">
        <p className="text-[10px] text-muted-foreground/40 text-center">
          v1.0 • ZeeVPS Panel
        </p>
        <p className="text-[9px] text-muted-foreground/30 text-center">
          by{" "}
          <a href="https://www.linkedin.com/in/iheb-chebbi-899462237/" target="_blank" rel="noopener noreferrer" className="hover:text-primary/60 transition-colors">
            Iheb Chebbi
          </a>
        </p>
      </div>
    </Sidebar>
  );
}
