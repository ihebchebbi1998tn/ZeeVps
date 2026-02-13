/**
 * ZeeVPS — Dashboard Layout
 * Wraps all authenticated pages with sidebar navigation and header.
 * 
 * @author Iheb Chebbi
 */

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <DashboardSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-11 items-center justify-between border-b border-border/60 bg-card/50 backdrop-blur-md px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
            <span className="text-[11px] text-muted-foreground/60">
              © {new Date().getFullYear()} ZeeVPS —{" "}
              <a href="https://www.linkedin.com/in/iheb-chebbi-899462237/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors font-medium">
                Iheb Chebbi
              </a>
            </span>
          </header>
          <main className="flex-1 overflow-auto p-5">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
