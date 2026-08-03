import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  useNavigate,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "@/components/offline-banner";
import { registerPWA } from "@/lib/pwa-register";
import { setupQueryPersistence } from "@/lib/query-persist";
import { installGlobalErrorCapture } from "@/lib/error-logger";
import { processPendingMutations } from "@/lib/offline-mutations";
import { syncOfflineSales } from "@/lib/offline-sync";
import { supabase } from "@/integrations/supabase/client";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Atacado Prime — Portal B2B" },
      { name: "description", content: "Atacado Prime — plataforma de gestão atacadista com CRM, pedidos, BI e operações de campo." },
      { name: "theme-color", content: "#faf8f5" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Atacado Prime" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:site_name", content: "Atacado Prime" },
      { property: "og:title", content: "Atacado Prime — Portal B2B" },
      { property: "og:description", content: "Atacado Prime — plataforma de gestão atacadista com CRM, pedidos, BI e operações de campo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Atacado Prime — Portal B2B" },
      { name: "twitter:description", content: "Atacado Prime — plataforma de gestão atacadista com CRM, pedidos, BI e operações de campo." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/bfda9f81-3bf4-4092-94c8-c8df6ef6dd70/id-preview-e8789d90--f6fdd83d-738f-496c-8445-a3838d9aa7cf.lovable.app-1781793668643.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/bfda9f81-3bf4-4092-94c8-c8df6ef6dd70/id-preview-e8789d90--f6fdd83d-738f-496c-8445-a3838d9aa7cf.lovable.app-1781793668643.png" },
      { property: "og:url", content: "https://primeautomotive.app/" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest?v=4" },
      { rel: "icon", href: "/favicon.ico?v=5" },
      { rel: "icon", type: "image/png", href: "/favicon.png?v=5" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=5" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Atacado Prime",
          url: "https://primeautomotive.app/",
          logo: "https://primeautomotive.app/apple-touch-icon.png",
          contactPoint: {
            "@type": "ContactPoint",
            telephone: "+55-34-99865-1112",
            contactType: "sales",
            email: "contato@primeautomotive.app",
            areaServed: "BR",
            availableLanguage: ["Portuguese"],
          },
          address: {
            "@type": "PostalAddress",
            addressLocality: "Uberlândia",
            addressRegion: "MG",
            addressCountry: "BR",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const BOOT_WATCHDOG = `
(function(){
  if (typeof globalThis === "undefined") { (function() { if (typeof self !== "undefined") { self.globalThis = self; } else if (typeof window !== "undefined") { window.globalThis = window; } })(); }
  // Watchdog somente na maquininha POS (rotas /pos). Em desktop/preview nao exibe nada.
  if (!/^\\/pos(\\/|$)/.test(location.pathname)) return;
  var err = null;
  window.addEventListener('error', function(e){ err = (e && (e.message || (e.error && e.error.message))) || 'erro de script'; }, true);

  window.addEventListener('unhandledrejection', function(e){ err = 'promise: ' + ((e && e.reason && (e.reason.message || e.reason)) || '?'); });
  setTimeout(function(){
  if (typeof globalThis === "undefined") { (function() { if (typeof self !== "undefined") { self.globalThis = self; } else if (typeof window !== "undefined") { window.globalThis = window; } })(); }
    if (window.__APP_BOOTED) return;
    var d = document.createElement('div');
    d.setAttribute('style','position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#faf8f5;color:#1c1917;font:13px/1.5 system-ui,sans-serif;padding:16px;overflow:auto');
    d.innerHTML = '<div style="font-weight:800;font-size:15px;margin-bottom:8px">O app nao iniciou nesta maquina</div>'
      + '<div style="margin-bottom:8px">Motivo: <b>' + (err ? String(err).slice(0,200) : 'carregamento travado / sem resposta') + '</b></div>'
      + '<div style="margin-bottom:12px;word-break:break-all;color:#78716c">' + navigator.userAgent + '</div>'
      + '<button id="bw-r" style="width:100%;min-height:46px;border:0;border-radius:10px;background:#0d7377;color:#fff;font-weight:700">Tentar de novo</button>'
      + '<button id="bw-c" style="margin-top:8px;width:100%;min-height:46px;border:1px solid #e7e5e4;border-radius:10px;background:#fff;font-weight:700">Limpar cache e recarregar</button>';
    document.body.appendChild(d);
    document.getElementById('bw-r').onclick = function(){ location.reload(); };
    document.getElementById('bw-c').onclick = function(){
      try {
        if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(function(rs){ rs.forEach(function(r){ r.unregister(); }); });
        if (window.caches) caches.keys().then(function(ks){ ks.forEach(function(k){ caches.delete(k); }); });
      } catch (_) {}
      setTimeout(function(){
  if (typeof globalThis === "undefined") { (function() { if (typeof self !== "undefined") { self.globalThis = self; } else if (typeof window !== "undefined") { window.globalThis = window; } })(); } location.replace(location.pathname + '?nocache=' + Date.now()); }, 600);
    };
  }, 12000);
})();
`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
        <script dangerouslySetInnerHTML={{ __html: BOOT_WATCHDOG }} />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    const isOfflineSafeRoute = (path: string) =>
      path === "/pos" ||
      path.startsWith("/pos/") ||
      path === "/vendas-offline" ||
      path === "/field/venda-offline" ||
      path === "/offline-pendentes" ||
      path === "/offline-route";

    const redirectToOfflineMode = () => {
      if (navigator.onLine || isOfflineSafeRoute(window.location.pathname)) return;
      void navigate({ to: "/vendas-offline", replace: true });
    };

    redirectToOfflineMode();
    window.addEventListener("offline", redirectToOfflineMode);
    return () => window.removeEventListener("offline", redirectToOfflineMode);
  }, [navigate, pathname]);

  useEffect(() => {
    (window as unknown as { __APP_BOOTED?: boolean }).__APP_BOOTED = true;
    setupQueryPersistence(queryClient);

    registerPWA();
    installGlobalErrorCapture();

    // Sincroniza fila offline ao voltar a rede.
    const runSync = async () => {
      try {
        await processPendingMutations();
        const { data } = await supabase.auth.getUser();
        if (data.user?.id) await syncOfflineSales(data.user.id);
      } catch { /* silencioso */ }
    };
    const warmOfflineCatalog = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        const { loadCachedCatalog, syncCatalogFromServer } = await import("@/lib/offline-store");
        const cached = await loadCachedCatalog();
        const stale = !cached.syncedAt || Date.now() - cached.syncedAt > 6 * 3600 * 1000;
        if (!stale && cached.products.length > 0) return;
        await syncCatalogFromServer();
      } catch {
        /* silencioso */
      }
    };
    const onOnline = () => void runSync();
    const onOnlineWarm = () => void warmOfflineCatalog();
    window.addEventListener("online", onOnline);
    window.addEventListener("online", onOnlineWarm);
    // Dispara uma vez no boot
    if (typeof navigator === "undefined" || navigator.onLine) void runSync();
    if (typeof navigator === "undefined" || navigator.onLine) void warmOfflineCatalog();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("online", onOnlineWarm);
    };
  }, [queryClient]);


  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <OfflineBanner />
      <Toaster
        richColors
        position="top-right"
        offset={{ top: "calc(16px + var(--app-safe-top))", right: 16 }}
        mobileOffset={{ top: "calc(12px + var(--app-safe-top))", right: 12, left: 12 }}
      />
    </QueryClientProvider>
  );
}
