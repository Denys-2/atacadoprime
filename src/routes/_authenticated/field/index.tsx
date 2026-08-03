import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/field/")({
  beforeLoad: () => {
    throw redirect({ to: "/v3/campo" });
  },
});
