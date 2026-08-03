import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PixSettings = {
  copia_cola: string;
  qr_image_url: string;
  beneficiario: string;
  cidade: string;
};

const DEFAULTS: PixSettings = { copia_cola: "", qr_image_url: "", beneficiario: "", cidade: "" };

export function usePixSettings() {
  return useQuery({
    queryKey: ["pix-settings"],
    staleTime: 60_000,
    queryFn: async (): Promise<PixSettings> => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("chave, valor")
        .eq("categoria", "pix");
      if (error) throw error;
      const out: PixSettings = { ...DEFAULTS };
      for (const row of data ?? []) {
        const v = typeof row.valor === "string" ? row.valor : (row.valor as { value?: string })?.value ?? String(row.valor ?? "");
        if (row.chave in out) (out as Record<string, string>)[row.chave] = v;
      }
      return out;
    },
  });
}
