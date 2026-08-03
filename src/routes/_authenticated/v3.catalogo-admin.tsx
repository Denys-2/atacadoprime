import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/v3/catalogo-admin")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/catalog" });
  },
});
