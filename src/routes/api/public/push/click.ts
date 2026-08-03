import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/push/click")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { deliveryId } = await request.json();
          if (!deliveryId || typeof deliveryId !== "string") {
            return new Response("bad", { status: 400 });
          }
          const supabase = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
          );
          await supabase
            .from("push_deliveries")
            .update({ clicked_at: new Date().toISOString() })
            .eq("id", deliveryId);
          return new Response("ok");
        } catch {
          return new Response("ok"); // never fail the click
        }
      },
    },
  },
});
