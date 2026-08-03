import { createFileRoute } from "@tanstack/react-router";
import { V2ModulePage } from "@/components/v2/V2ModulePage";

export const Route = createFileRoute("/_authenticated/v3/campanhas")({
  head: () => ({ meta: [{ title: "Campanhas — Prime Automotive" }] }),
  component: () => <V2ModulePage moduleKey="campaigns" />,
});