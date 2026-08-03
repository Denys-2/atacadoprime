import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AddressInput = {
  label: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zip: string;
};

const key = (companyId: string | undefined) => ["addresses", companyId] as const;

export function useAddresses(companyId: string | undefined) {
  return useQuery({
    queryKey: key(companyId),
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateAddress(companyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: AddressInput) => {
      if (!companyId) throw new Error("Sem empresa selecionada");
      const { error } = await supabase
        .from("addresses")
        .insert({ ...form, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(companyId) }),
  });
}

export function useDeleteAddress(companyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(companyId) }),
  });
}
