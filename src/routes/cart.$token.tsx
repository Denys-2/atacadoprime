import { createFileRoute, useParams } from "@tanstack/react-router";
import { useSharedCart } from "@/hooks/use-field";
import { Card } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/cart/$token")({
  component: SharedCartPage,
});

function SharedCartPage() {
  const { token } = useParams({ from: "/cart/$token" });
  const { data, isLoading } = useSharedCart(token);

  if (isLoading) return <Centered>Carregando carrinho…</Centered>;
  if (!data) return <Centered>Carrinho não encontrado ou expirado.</Centered>;

  const items = (data.items as any[]) ?? [];

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Seu carrinho</h1>
          <p className="text-sm text-muted-foreground">Montado pelo seu consultor durante a visita.</p>
          <Badge className="mt-2" variant={data.status === "CONVERTIDO" ? "secondary" : "outline"}>{data.status}</Badge>
        </header>
        <Card className="divide-y">
          {items.map((it, idx) => (
            <div key={idx} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{it.nome}</p>
                <p className="text-xs text-muted-foreground">{it.quantidade} × {brl(Number(it.preco))}</p>
              </div>
              <p className="font-semibold">{brl(it.quantidade * Number(it.preco))}</p>
            </div>
          ))}
        </Card>
        <div className="flex items-center justify-between mt-4 text-lg font-semibold">
          <span>Total</span>
          <span>{brl(Number(data.subtotal))}</span>
        </div>
        {data.observacoes && (
          <p className="mt-4 text-sm text-muted-foreground bg-muted/40 rounded-md p-3">{data.observacoes}</p>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen grid place-items-center p-6 text-muted-foreground">{children}</div>;
}
