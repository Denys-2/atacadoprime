import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/routes/")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/rotas" });
  },
});
