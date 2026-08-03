import { createFileRoute } from "@tanstack/react-router";
import { V2ModulePage } from "@/components/v2/V2ModulePage";

export const Route = createFileRoute("/_authenticated/v3/campo")({
  head: () => ({ meta: [{ title: "Campo — Prime Automotive" }] }),
  component: () => <V2ModulePage moduleKey="field" />,
});