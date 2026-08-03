import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/bi/")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/bi" });
  },
});
