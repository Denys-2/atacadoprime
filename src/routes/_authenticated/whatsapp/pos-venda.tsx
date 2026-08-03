import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/whatsapp/pos-venda")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/whatsapp/pos-venda" });
  },
});
