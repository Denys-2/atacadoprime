import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/inventory/counts")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/estoque/contagens" });
  },
});
