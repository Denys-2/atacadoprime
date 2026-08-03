import { createFileRoute } from "@tanstack/react-router";
import { V2ModulePage } from "@/components/v2/V2ModulePage";

export const Route = createFileRoute("/_authenticated/v3/whatsapp/pos-venda")({
  head: () => ({ meta: [{ title: "Pós-venda WhatsApp — Prime Automotive" }] }),
  component: () => <V2ModulePage moduleKey="postSale" />,
});
