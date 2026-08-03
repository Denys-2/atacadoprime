import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/crm/agenda")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/crm/agenda" });
  },
});
