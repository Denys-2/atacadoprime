import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Loader2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import type { CartItem } from "@/hooks/use-cart";
import { useOfflineCatalog } from "@/hooks/use-offline-catalog";
import { useOfflineSales } from "@/hooks/use-offline-sales";
import { brl } from "@/lib/format";
import type { OfflineProduct } from "@/lib/offline-store";

export const Route = createFileRoute("/vendas-offline")({
  head: () => ({
    meta: [
      { title: "Venda Offline — Atacado Prime" },
      {
        name: "description",
        content: "Sistema separado para registrar vendas offline e sincronizar automaticamente quando a internet voltar.",
      },
    ],
  }),
  component: StandaloneOfflineSalesPage,
});

type PaymentType = "DINHEIRO" | "PIX" | "CARTAO";

function toCartItem(product: OfflineProduct): CartItem {
  return {
    product_id: product.id,
    nome: product.nome,
    sku: product.sku ?? "",
    image_url: product.imagem_url,
    tipo_compra: "UNITARIO",
    quantidade: 1,
    preco_unitario: Number(product.preco ?? 0),
    quantidade_pacote: Number(product.quantidade_pacote ?? 0),
    preco_pacote: product.preco_pacote != null ? Number(product.preco_pacote) : null,
  };
}

function itemTotal(item: CartItem) {
  const price = item.tipo_compra === "PACOTE" && item.preco_pacote ? item.preco_pacote : item.preco_unitario;
  return Number(price) * item.quantidade * (1 - (item.desconto_pct ?? 0) / 100);
}

function StandaloneOfflineSalesPage() {
  const { user } = useAuth();
  const catalog = useOfflineCatalog();
  const sales = useOfflineSales();

  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [payment, setPayment] = useState<PaymentType>("DINHEIRO");
  const [notes, setNotes] = useState("");
  const [freight, setFreight] = useState(0);
  const [discount, setDiscount] = useState(0);

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const products = catalog.products;
    if (!needle) return products.slice(0, 80);
    return products
      .filter((product) =>
        product.nome.toLowerCase().includes(needle) ||
        (product.sku ?? "").toLowerCase().includes(needle) ||
        (product.marca_nome ?? "").toLowerCase().includes(needle),
      )
      .slice(0, 80);
  }, [catalog.products, search]);

  const subtotal = items.reduce((total, item) => total + itemTotal(item), 0);
  const total = Math.max(0, subtotal + Number(freight || 0) - Number(discount || 0));

  function addProduct(product: OfflineProduct) {
    setItems((current) => {
      const existing = current.find((item) => item.product_id === product.id && item.tipo_compra === "UNITARIO");
      if (!existing) return [...current, toCartItem(product)];
      return current.map((item) =>
        item.product_id === product.id && item.tipo_compra === "UNITARIO"
          ? { ...item, quantidade: item.quantidade + 1 }
          : item,
      );
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setItems((current) =>
      current
        .map((item) => item.product_id === productId ? { ...item, quantidade: Math.max(0, item.quantidade + delta) } : item)
        .filter((item) => item.quantidade > 0),
    );
  }

  function resetSale() {
    setItems([]);
    setClientName("");
    setClientPhone("");
    setCity("");
    setState("");
    setNotes("");
    setFreight(0);
    setDiscount(0);
    setPayment("DINHEIRO");
  }

  async function saveSale() {
    if (items.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }

    await sales.enqueueSale({
      local_id: crypto.randomUUID(),
      created_at: Date.now(),
      status: "pending",
      new_client: {
        legal_name: clientName.trim(),
        phone: clientPhone.trim(),
        cidade: city.trim() || null,
        estado: state.trim() || null,
      },
      items,
      frete: Number(freight || 0),
      desconto: Number(discount || 0),
      acrescimo: 0,
      observacao: notes.trim() || null,
      pagamento: payment,
      origem: "VISITA",
      subtotal,
      total,
    });

    toast.success(sales.online && user ? "Venda salva e enviada para sincronização" : "Venda salva neste aparelho");
    resetSale();
  }

  return (
    <div className="min-h-dvh bg-background text-foreground pt-[var(--app-safe-top)]">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase text-primary">Sistema separado</p>
            <h1 className="text-lg font-bold leading-tight sm:text-xl">Vendas Offline</h1>
            <p className="text-xs text-muted-foreground">Salva no aparelho e envia para pedidos quando voltar online.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={sales.online ? "default" : "destructive"} className="gap-1">
              {sales.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {sales.online ? "Online" : "Offline"}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link to="/auth" search={{ mode: "login" as const, redirect: undefined }}>Sistema online</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-3">
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 text-xs text-muted-foreground">
                Catálogo: <strong className="text-foreground">{catalog.products.length}</strong> produtos
                {catalog.syncedAt ? ` · atualizado ${new Date(catalog.syncedAt).toLocaleString("pt-BR")}` : " · ainda não sincronizado"}
              </div>
              <Button size="sm" variant="outline" onClick={() => catalog.sync()} disabled={!sales.online || catalog.syncing}>
                {catalog.syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span className="ml-1">Atualizar</span>
              </Button>
            </div>
          </Card>

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar produto, SKU ou marca"
            aria-label="Buscar produto"
          />

          {catalog.loading ? (
            <Card className="grid min-h-40 place-items-center p-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </Card>
          ) : filteredProducts.length === 0 ? (
            <Card className="grid min-h-40 place-items-center p-6 text-center">
              <div className="space-y-2">
                <Package className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="font-medium">Nenhum produto no cache</p>
                <p className="text-sm text-muted-foreground">Abra esta tela com internet e toque em Atualizar antes de usar offline.</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="flex flex-col gap-2 p-3">
                  {product.imagem_url ? (
                    <img src={product.imagem_url} alt={product.nome} loading="lazy" className="aspect-square w-full rounded-md bg-muted object-cover" />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center rounded-md bg-muted text-muted-foreground">
                      <Package className="h-7 w-7" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium leading-tight">{product.nome}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{product.sku ?? "Sem SKU"}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <strong className="text-sm">{brl(product.preco)}</strong>
                    <Button size="icon" className="h-8 w-8" onClick={() => addProduct(product)} aria-label={`Adicionar ${product.nome}`}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <Card className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingCart className="h-4 w-4" /> Venda
              <Badge variant="secondary" className="ml-auto">{items.length} itens</Badge>
            </h2>

            <div className="space-y-2">
              <Input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Cliente / empresa" />
              <Input value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} placeholder="Telefone" />
              <div className="grid grid-cols-3 gap-2">
                <Input className="col-span-2 uppercase" value={city} onChange={(event) => setCity(event.target.value.toUpperCase())} placeholder="Cidade" />
                <Input value={state} onChange={(event) => setState(event.target.value.toUpperCase())} placeholder="UF" maxLength={2} />
              </div>
            </div>

            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">Toque em + nos produtos para montar a venda.</p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {items.map((item) => (
                  <div key={`${item.product_id}-${item.tipo_compra}`} className="space-y-2 border-b border-border pb-2 text-sm last:border-0">
                    <div className="flex items-start gap-2">
                      <p className="flex-1 font-medium leading-tight">{item.nome}</p>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => changeQuantity(item.product_id, -item.quantidade)} aria-label={`Remover ${item.nome}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQuantity(item.product_id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-7 text-center">{item.quantidade}</span>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQuantity(item.product_id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <strong>{brl(itemTotal(item))}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min={0} value={freight} onChange={(event) => setFreight(Number(event.target.value))} placeholder="Frete" />
              <Input type="number" min={0} value={discount} onChange={(event) => setDiscount(Number(event.target.value))} placeholder="Desconto" />
            </div>

            <Select value={payment} onValueChange={(value) => setPayment(value as PaymentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="CARTAO">Cartão</SelectItem>
              </SelectContent>
            </Select>

            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observações" rows={2} />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><strong>{brl(subtotal)}</strong></div>
              <div className="flex justify-between text-base"><span>Total</span><strong>{brl(total)}</strong></div>
            </div>

            <Button className="w-full" size="lg" onClick={saveSale} disabled={items.length === 0}>
              {sales.online && user ? <CloudUpload className="mr-2 h-4 w-4" /> : <WifiOff className="mr-2 h-4 w-4" />}
              Salvar venda offline
            </Button>
          </Card>

          {sales.queue.length > 0 && (
            <Card className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Fila de envio</h2>
                <Button size="sm" variant="outline" onClick={() => sales.sync()} disabled={!sales.online || !user || sales.syncing}>
                  {sales.syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
                  <span className="ml-1">Enviar</span>
                </Button>
              </div>
              {!user && sales.online && <p className="text-xs text-muted-foreground">Entre no sistema online para enviar as vendas pendentes.</p>}
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {sales.queue.slice().reverse().map((sale) => (
                  <div key={sale.local_id} className="flex items-center gap-2 border-b border-border py-2 text-xs last:border-0">
                    {sale.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : sale.status === "error" ? <AlertCircle className="h-3.5 w-3.5 text-destructive" /> : <CloudUpload className="h-3.5 w-3.5 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{sale.new_client?.legal_name ?? "Cliente"} · {brl(sale.total)}</p>
                      <p className="truncate text-muted-foreground">{new Date(sale.created_at).toLocaleString("pt-BR")}{sale.error ? ` · ${sale.error}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </aside>
      </main>
    </div>
  );
}