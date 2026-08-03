import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/v3/")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
