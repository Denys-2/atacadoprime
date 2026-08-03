import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/vendas/viagens")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/viagens" });
  },
});
