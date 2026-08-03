import { createFileRoute } from "@tanstack/react-router";
import { V2ModulePage } from "@/components/v2/V2ModulePage";

export const Route = createFileRoute("/_authenticated/v3/crm/agenda")({
  head: () => ({ meta: [{ title: "Agenda CRM — Prime Automotive" }] }),
  component: () => <V2ModulePage moduleKey="crmAgenda" />,
});
