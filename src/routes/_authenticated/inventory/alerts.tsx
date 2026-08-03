import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/inventory/alerts")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/estoque/alertas" });
  },
});
