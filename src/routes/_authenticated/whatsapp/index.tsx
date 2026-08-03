import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/whatsapp/")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/whatsapp" });
  },
});
