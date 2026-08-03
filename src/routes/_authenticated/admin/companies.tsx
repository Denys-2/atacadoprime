import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/companies")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/empresas" });
  },
});
