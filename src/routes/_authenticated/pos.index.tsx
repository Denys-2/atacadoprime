import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pos/")({
  beforeLoad: () => {
    throw redirect({ to: "/pos/vender" });
  },
});
