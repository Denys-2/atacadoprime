import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/sales-targets")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/admin/metas" });
  },
});
