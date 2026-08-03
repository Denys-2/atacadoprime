import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SellerCustomer = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  tax_id: string | null;
};

type SellerState = {
  customer: SellerCustomer | null;
  tripId: string | null;
  setCustomer: (c: SellerCustomer) => void;
  setTripId: (id: string | null) => void;
  endSale: () => void;
};

export const useSellerSession = create<SellerState>()(
  persist(
    (set) => ({
      customer: null,
      tripId: null,
      setCustomer: (c) => set({ customer: c }),
      setTripId: (id) => set({ tripId: id }),
      endSale: () => set({ customer: null, tripId: null }),
    }),
    {
      name: "seller-session-v1",
      // O cliente NÃO é persistido: cada abertura do POS começa limpa.
      partialize: (state) => ({ tripId: state.tripId }),
    },
  ),
);


// Cross-tab sync: when another tab clears/sets the seller session,
// rehydrate this tab so the banner disappears/appears immediately.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "seller-session-v1") {
      useSellerSession.persist.rehydrate();
    }
  });
}
