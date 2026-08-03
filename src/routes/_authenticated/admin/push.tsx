import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/push")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/admin/push" });
  },
});
