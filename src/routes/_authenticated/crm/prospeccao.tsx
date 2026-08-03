import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/crm/prospeccao")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/prospeccao" });
  },
});
