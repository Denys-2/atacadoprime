import { createFileRoute } from "@tanstack/react-router";
import { V2ModulePage } from "@/components/v2/V2ModulePage";

export const Route = createFileRoute("/_authenticated/v3/admin/banners")({
  head: () => ({ meta: [{ title: "Banners — Prime Automotive" }] }),
  component: () => <V2ModulePage moduleKey="adminBanners" />,
});
