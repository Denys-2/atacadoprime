import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/admin/banners" });
  },
});
