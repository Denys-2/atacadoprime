import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/catalog/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/v3" });
  },
});
