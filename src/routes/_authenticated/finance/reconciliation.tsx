import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/finance/reconciliation")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/financeiro/conciliacao" });
  },
});
