import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import brandLogo from "@/assets/brand-logo.png.asset.json";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Requisição de autorização inválida (authorization_id ausente).");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth", search: { mode: "login" as const, redirect: location.pathname + location.searchStr } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <Shell>
      <p className="text-sm" style={{ color: "#b91c1c" }}>
        Não foi possível carregar esta autorização: {String((error as Error)?.message ?? error)}
      </p>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center p-6" style={{ background: "#faf8f5", color: "#3d2b1f" }}>
      <div
        className="w-full max-w-md rounded-2xl border p-7 space-y-5"
        style={{ background: "#ffffff", borderColor: "#e8e2d8" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl grid place-items-center overflow-hidden border" style={{ borderColor: "#e8e2d8" }}>
            <img src={brandLogo.url} alt="Atacado Prime" className="w-7 h-7 object-contain" />
          </div>
          <div className="leading-tight">
            <div className="uppercase tracking-[0.25em] text-[10px]" style={{ color: "#8b7355" }}>
              Autorização
            </div>
            <div className="uppercase tracking-widest text-sm font-bold">Atacado Prime</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Consent() {
  const details = Route.useLoaderData() as any;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "Aplicativo externo";
  const redirectUri = details?.client?.redirect_uri ?? details?.redirect_uri ?? null;
  const scopes: string[] = String(details?.scope ?? "").split(/\s+/).filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: err } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um destino de redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  return (
    <Shell>
      <div className="space-y-2">
        <h1 className="text-lg font-bold leading-snug">Conectar {clientName} à sua conta</h1>
        <p className="text-sm" style={{ color: "#8b7355" }}>
          Isso permite que <strong>{clientName}</strong> use as ferramentas do Atacado Prime como você — consultando
          vendas, resultado, clientes, estoque e pedidos.
        </p>
      </div>

      <div className="rounded-xl border p-3 text-xs space-y-1" style={{ borderColor: "#e8e2d8", background: "#faf8f5" }}>
        {redirectUri && (
          <div>
            <span style={{ color: "#8b7355" }}>Redireciona para:</span> <span className="break-all">{redirectUri}</span>
          </div>
        )}
        <div>
          <span style={{ color: "#8b7355" }}>Permissões:</span>{" "}
          {scopes.length ? scopes.join(", ") : "perfil básico e e-mail"}
        </div>
        <div style={{ color: "#8b7355" }}>
          As regras de acesso do sistema continuam valendo — você só vê o que já tem permissão de ver.
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          disabled={busy}
          onClick={() => decide(true)}
          className="flex-1 h-11 rounded-xl font-semibold text-sm disabled:opacity-60"
          style={{ background: "#c9a96e", color: "#ffffff" }}
        >
          {busy ? "Processando…" : "Aprovar"}
        </button>
        <button
          disabled={busy}
          onClick={() => decide(false)}
          className="flex-1 h-11 rounded-xl font-semibold text-sm border disabled:opacity-60"
          style={{ borderColor: "#e8e2d8", color: "#3d2b1f" }}
        >
          Cancelar
        </button>
      </div>
    </Shell>
  );
}
