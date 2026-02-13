/**
 * ZeeVPS — Server Management Panel
 * Main application entry point with route configuration.
 * 
 * @author Iheb Chebbi
 * @see https://www.linkedin.com/in/iheb-chebbi-899462237/
 */

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { VpsSetupGate } from "@/components/VpsSetupGate";
import { DashboardLayout } from "@/components/DashboardLayout";
import Overview from "@/pages/Overview";
import Services from "@/pages/Services";
import FileBrowserPage from "@/pages/FileBrowserPage";
import ProcessesPage from "@/pages/ProcessesPage";
import LogsPage from "@/pages/LogsPage";
import TerminalPage from "@/pages/TerminalPage";
import NetworkPage from "@/pages/NetworkPage";
import SecurityPage from "@/pages/SecurityPage";
import CronJobsPage from "@/pages/CronJobsPage";
import DockerPage from "@/pages/DockerPage";
import AppStorePage from "@/pages/AppStorePage";
import BenchmarksPage from "@/pages/BenchmarksPage";
import BackupsPage from "@/pages/BackupsPage";
import SSHKeysPage from "@/pages/SSHKeysPage";
import SSLPage from "@/pages/SSLPage";
import DNSPage from "@/pages/DNSPage";
import DatabasePage from "@/pages/DatabasePage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <VpsSetupGate>
          <DashboardLayout>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/files" element={<FileBrowserPage />} />
              <Route path="/services" element={<Services />} />
              <Route path="/processes" element={<ProcessesPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/terminal" element={<TerminalPage />} />
              <Route path="/network" element={<NetworkPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/cron" element={<CronJobsPage />} />
              <Route path="/docker" element={<DockerPage />} />
              <Route path="/apps" element={<AppStorePage />} />
              <Route path="/benchmarks" element={<BenchmarksPage />} />
              <Route path="/backups" element={<BackupsPage />} />
              <Route path="/ssh-keys" element={<SSHKeysPage />} />
              <Route path="/ssl" element={<SSLPage />} />
              <Route path="/dns" element={<DNSPage />} />
              <Route path="/database" element={<DatabasePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DashboardLayout>
        </VpsSetupGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
