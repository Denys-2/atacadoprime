import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PosShell } from "@/components/pos/PosShell";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "POS Prime — Terminal de venda" },
      { name: "description", content: "Terminal de venda otimizado para POS Android com impressão térmica." },
      { property: "og:title", content: "POS Prime — Terminal de venda" },
      { property: "og:description", content: "Terminal de venda otimizado para POS Android com impressão térmica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "viewport", content: "width=360,initial-scale=1,maximum-scale=1,viewport-fit=cover,user-scalable=no" },
      { name: "theme-color", content: "#0d7377" },
      { name: "apple-mobile-web-app-title", content: "POS Prime" },
      { httpEquiv: "Cache-Control", content: "no-store, no-cache, must-revalidate, max-age=0" },
      { httpEquiv: "Pragma", content: "no-cache" },
      { httpEquiv: "Expires", content: "0" },
    ],
    links: [{ rel: "manifest", href: "/manifest-pos.webmanifest?v=3" }],

  }),

  component: () => (
    <PosShell>
      <Outlet />
    </PosShell>
  ),
});
