import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/companies")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/empresas" });
  },
});
