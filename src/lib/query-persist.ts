import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

// Persiste o cache do TanStack Query em localStorage.
// Assim, telas já visitadas voltam a mostrar dados mesmo sem internet.
export function setupQueryPersistence(queryClient: QueryClient) {
  if (typeof window === "undefined") return;

  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: "atacado-prime-query-cache-v1",
    throttleTime: 1000,
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
    buster: "v1",
    dehydrateOptions: {
      shouldDehydrateQuery: (q) => {
        // Não persiste erros, queries pausadas, ou dados sensíveis de auth
        if (q.state.status !== "success") return false;
        const key = q.queryKey[0];
        if (typeof key !== "string") return false;
        // Bloqueia coisas que mudam demais/são sensíveis
        const blocked = ["profile", "roles", "my-company"];
        if (blocked.includes(key)) return false;
        return true;
      },
    },
  });
}
