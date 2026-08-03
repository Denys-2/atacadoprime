import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/whatsapp/templates")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/whatsapp/templates" });
  },
});
