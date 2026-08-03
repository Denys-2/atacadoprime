import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/catalog")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/v3", search: search as Record<string, unknown> });
  },
});
