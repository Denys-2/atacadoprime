import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/field/venda-offline")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/vendas/nova" });
  },
});
