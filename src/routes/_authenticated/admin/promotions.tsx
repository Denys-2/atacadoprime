import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/promotions")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/admin/promocoes" });
  },
});
