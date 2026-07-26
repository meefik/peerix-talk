import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { App } from "./app.tsx";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { StorageProvider } from "@/hooks/use-storage";
import { RouterProvider } from "@/hooks/use-router";

async function main() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider>
        <StorageProvider>
          <RouterProvider>
            <App />
          </RouterProvider>
        </StorageProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

main();
