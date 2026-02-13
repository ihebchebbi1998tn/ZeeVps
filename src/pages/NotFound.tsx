/**
 * ZeeVPS — 404 Not Found Page
 * 
 * @author Iheb Chebbi
 */

import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-5xl font-bold text-foreground font-mono">404</h1>
        <p className="text-sm text-muted-foreground">This page doesn't exist.</p>
        <a href="/" className="inline-block text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          Back to Dashboard
        </a>
        <p className="text-[10px] text-muted-foreground/40 pt-4">
          ZeeVPS by{" "}
          <a href="https://www.linkedin.com/in/iheb-chebbi-899462237/" target="_blank" rel="noopener noreferrer" className="hover:text-primary/60 transition-colors">
            Iheb Chebbi
          </a>
        </p>
      </div>
    </div>
  );
};

export default NotFound;
