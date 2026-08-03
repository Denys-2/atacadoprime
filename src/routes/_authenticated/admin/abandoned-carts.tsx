import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/abandoned-carts")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/admin/carrinhos" });
  },
});
