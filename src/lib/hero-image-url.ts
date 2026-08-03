import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

/**
 * image_url no banco pode ser:
 *  - um path do bucket (ex: "slides/123.png")  -> gera signed URL
 *  - uma URL completa (legado)                  -> usa direto
 */
export function useHeroImageUrl(value: string | null | undefined) {
  return useQuery({
    queryKey: ["hero-image-url", value],
    enabled: !!value,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!value) return "";
      // Extrai path se for uma URL pública legada do bucket hero-images
      let path = value;
      const marker = "/hero-images/";
      const i = value.indexOf(marker);
      if (i !== -1) {
        path = value.slice(i + marker.length);
      } else if (value.startsWith("http://") || value.startsWith("https://")) {
        // URL externa não-Supabase: usa direto
        return value;
      }
      const { data, error } = await supabase.storage
        .from("hero-images")
        .createSignedUrl(path, 60 * 60 * 24); // 24h
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
