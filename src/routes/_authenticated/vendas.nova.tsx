import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/vendas/nova")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/vendas/nova" });
  },
});
