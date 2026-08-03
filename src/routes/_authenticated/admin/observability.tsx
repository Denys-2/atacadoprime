import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/observability")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/configuracoes" });
  },
});
