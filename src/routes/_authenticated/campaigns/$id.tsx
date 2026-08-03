import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/campaigns/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/campanhas" });
  },
});
