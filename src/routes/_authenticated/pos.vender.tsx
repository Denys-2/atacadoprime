import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart, cartEffectiveSubtotal, effectiveUnitPrice, type CartItem } from "@/hooks/use-cart";
import { useCreateOrder, useConfirmPayment } from "@/hooks/use-orders";
import { useBankAccounts } from "@/hooks/use-bank-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { V2 } from "@/components/v2/theme";
import { Search, Plus, Minus, Trash2, QrCode, CreditCard, Banknote, Printer, Loader2, X, CheckCircle2, ScanBarcode, ImageOff, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNativePrinterReady, printHTML, POS_PRINT_COLOR } from "@/lib/pos-printer";
import { renderTicket, pagamentoLabel } from "@/lib/pos-templates";
import { formatDateTime } from "@/lib/format";
import { orderCode } from "@/lib/order-code";
import { useSellerSession } from "@/hooks/use-seller-session";
import { PosCustomerDialog } from "@/components/pos/PosCustomerDialog";
import { User, UserPlus } from "lucide-react";


export const Route = createFileRoute("/_authenticated/pos/vender")({
  head: () => ({ meta: [{ title: "Vender — POS Prime" }] }),
  component: PosVender,
});

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type Product = {
  id: string; nome: string; sku: string; ean13: string | null;
  preco_unitario: number; preco_pacote: number | null;
  preco_nivel_1: number | null; preco_nivel_2: number | null; preco_nivel_3: number | null;
  quantidade_pacote: number | null;
  product_images?: { image_url: string }[];
};

function PosVender() {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const items = useCart((s) => s.items);
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const setPreco = useCart((s) => s.setPreco);
  const [picked, setPicked] = useState<Product | null>(null);
  const pickedExisting = picked ? items.find((i) => i.product_id === picked.id) ?? null : null;
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [modoScanner, setModoScanner] = useState(false);
  const customer = useSellerSession((s) => s.customer);
  const endSale = useSellerSession((s) => s.endSale);



  const { data: products = [] } = useQuery({
    queryKey: ["pos", "products", q],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id,nome,sku,ean13,preco_unitario,preco_pacote,preco_nivel_1,preco_nivel_2,preco_nivel_3,quantidade_pacote,product_images(image_url)")
        .eq("status", true)
        .order("nome")
        .limit(500);
      if (q.trim()) {
        query = query.or(`nome.ilike.%${q}%,sku.ilike.%${q}%,ean13.eq.${q}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  const { subtotal, tier } = cartEffectiveSubtotal(items);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-add quando escaneia código de barras (EAN13 = 13 dígitos)
  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const val = q.trim();
    if (!val) return;
    const exact = products.find((p) => p.ean13 === val || p.sku === val);
    if (exact && modoScanner) {
      addProduct(exact);
      setQ("");
      toast.success(`${exact.nome} adicionado`);
      return;
    }
    const target = exact ?? products[0];
    if (target) {
      setPicked(target);
      setQ("");
    }
  }

  function addProduct(p: Product, opts?: { quantidade?: number; tipo?: "UNITARIO" | "PACOTE"; preco?: number }) {
    const tipo = opts?.tipo ?? "UNITARIO";
    add({
      product_id: p.id,
      nome: p.nome,
      sku: p.sku,
      image_url: p.product_images?.[0]?.image_url ?? null,
      tipo_compra: tipo,
      quantidade: opts?.quantidade ?? 1,
      preco_unitario: Number(p.preco_unitario),
      preco_pacote: p.preco_pacote != null ? Number(p.preco_pacote) : null,
      quantidade_pacote: Number(p.quantidade_pacote ?? 1),
      preco_nivel_1: p.preco_nivel_1 != null ? Number(p.preco_nivel_1) : null,
      preco_nivel_2: p.preco_nivel_2 != null ? Number(p.preco_nivel_2) : null,
      preco_nivel_3: p.preco_nivel_3 != null ? Number(p.preco_nivel_3) : null,
    });
    if (opts?.preco != null && Number.isFinite(opts.preco)) {
      setPreco(p.id, tipo, opts.preco);
    }
  }

  return (
    <div className="p-3 space-y-3">
      {/* Cliente */}
      <div
        className="rounded-lg border p-3 flex items-center gap-2"
        style={{ background: customer ? V2.TEAL_LIGHT : V2.LIGHT_SURFACE, borderColor: customer ? V2.TEAL : V2.LIGHT_BORDER }}
      >
        <User className="h-4 w-4 shrink-0" style={{ color: V2.TEAL }} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: V2.LIGHT_MUTED }}>Cliente</div>
          <div className="text-sm font-medium truncate">
            {customer ? (customer.trade_name ?? customer.legal_name) : "Nenhum cliente selecionado"}
          </div>
        </div>
        {customer ? (
          <button className="text-xs underline shrink-0" style={{ color: V2.TEAL }} onClick={() => setCustomerOpen(true)}>
            trocar
          </button>
        ) : (
          <Button className="h-9 px-3 text-xs shrink-0" style={{ background: V2.TEAL, color: "#fff" }} onClick={() => setCustomerOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Escolher
          </Button>
        )}
      </div>

      <PosCustomerDialog open={customerOpen} onOpenChange={setCustomerOpen} />

      {/* Busca / scanner */}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Escaneie ou busque por nome, SKU, código"
            className="pl-8 h-12 text-base"
          />
        </div>
        <button
          type="button"
          onClick={() => setModoScanner((v) => !v)}
          className={cn(
            "shrink-0 h-12 px-3 rounded-md border flex items-center gap-1.5 text-xs font-semibold transition-colors",
            modoScanner ? "border-transparent text-white" : "text-foreground"
          )}
          style={{ background: modoScanner ? V2.TEAL : V2.LIGHT_SURFACE, borderColor: modoScanner ? V2.TEAL : V2.LIGHT_BORDER }}
          aria-pressed={modoScanner}
          title={modoScanner ? "Modo scanner ativo: leitura adiciona direto" : "Ativar modo scanner contínuo"}
        >
          <ScanBarcode className="h-4 w-4" /> {modoScanner ? "Scan ON" : "Scan"}
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px]" style={{ color: V2.LIGHT_MUTED }}>
        <span>{products.length} produto{products.length === 1 ? "" : "s"}</span>
        {modoScanner && <span className="font-medium" style={{ color: V2.TEAL }}>Leitura direta ativada</span>}
      </div>

      {/* Grid de produtos */}
      <div className="grid grid-cols-2 gap-2">
        {products.map((p) => {
          const inCart = items.filter((it) => it.product_id === p.id);
          const qtyInCart = inCart.reduce(
            (s, it) => s + (it.tipo_compra === "PACOTE" ? it.quantidade * (it.quantidade_pacote ?? 1) : it.quantidade),
            0,
          );
          const already = qtyInCart > 0;
          return (
            <button
              key={p.id}
              onClick={() => setPicked(p)}
              className="relative text-left p-2 rounded-lg border-2 active:scale-[.98] transition"
              style={{
                background: already ? V2.TEAL_LIGHT : V2.LIGHT_SURFACE,
                borderColor: already ? V2.TEAL : V2.LIGHT_BORDER,
              }}
            >
              {already && (
                <>
                  <span
                    className="absolute top-1.5 right-1.5 h-6 min-w-6 px-1.5 rounded-full text-[11px] font-bold grid place-items-center shadow"
                    style={{ background: V2.TEAL, color: "#fff" }}
                  >
                    {qtyInCart}
                  </span>
                  <CheckCircle2 className="absolute bottom-1.5 right-1.5 h-4 w-4" style={{ color: "#16a34a" }} />
                </>
              )}
              <div className="flex gap-2">
                {p.product_images?.[0]?.image_url ? (
                  <img
                    src={p.product_images[0].image_url}
                    alt={p.nome}
                    loading="lazy"
                    className="h-11 w-11 shrink-0 rounded-md object-cover border"
                    style={{ borderColor: V2.LIGHT_BORDER, background: "#fff" }}
                  />
                ) : (
                  <div
                    className="h-11 w-11 shrink-0 rounded-md border grid place-items-center"
                    style={{ borderColor: V2.LIGHT_BORDER, background: "#fff" }}
                  >
                    <ImageOff className="h-4 w-4" style={{ color: V2.LIGHT_MUTED }} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm line-clamp-2 min-h-[36px] pr-7">{p.nome}</div>
                  <div className="text-[11px] truncate" style={{ color: V2.LIGHT_MUTED }}>{p.sku}</div>
                </div>
              </div>

              <div className="font-bold text-sm mt-1" style={{ color: V2.TEAL }}>
                {brl(Number(p.preco_nivel_1 ?? p.preco_unitario))}
              </div>
              {already && (
                <div className="text-[10px] mt-0.5" style={{ color: V2.TEAL }}>toque para editar</div>
              )}
            </button>
          );
        })}
      </div>


      <AddItemModal
        product={picked}
        existing={pickedExisting}
        onClose={() => setPicked(null)}
        onRemove={() => {
          if (pickedExisting) {
            remove(pickedExisting.product_id, pickedExisting.tipo_compra);
            toast.success("Item removido");
          }
          setPicked(null);
        }}
        onConfirm={(opts) => {
          if (!picked) return;
          if (pickedExisting) {
            if (opts.tipo !== pickedExisting.tipo_compra) {
              remove(pickedExisting.product_id, pickedExisting.tipo_compra);
              addProduct(picked, opts);
            } else {
              setQty(picked.id, opts.tipo!, opts.quantidade ?? 1);
              if (opts.preco != null && Number.isFinite(opts.preco)) setPreco(picked.id, opts.tipo!, opts.preco);
            }
            toast.success("Item atualizado");
          } else {
            addProduct(picked, opts);
          }
          setPicked(null);
        }}
      />



      {/* Carrinho */}
      {items.length > 0 && (
        <div className="rounded-lg border" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: V2.LIGHT_BORDER }}>
            <div className="text-sm font-semibold">Carrinho ({items.length})</div>
            <button onClick={clear} className="text-xs" style={{ color: V2.LIGHT_MUTED }}>
              limpar
            </button>
          </div>
          <div className="max-h-[42vh] overflow-y-auto divide-y" style={{ borderColor: V2.LIGHT_BORDER }}>
            {items.map((i) => {
              const unit = effectiveUnitPrice(i, tier);
              return (
                <div key={`${i.product_id}-${i.tipo_compra}`} className="px-3 py-2 flex items-center gap-2">
                  {i.image_url ? (
                    <img
                      src={i.image_url}
                      alt={i.nome}
                      loading="lazy"
                      className="h-9 w-9 shrink-0 rounded-md object-cover border"
                      style={{ borderColor: V2.LIGHT_BORDER, background: "#fff" }}
                    />
                  ) : (
                    <div
                      className="h-9 w-9 shrink-0 rounded-md border grid place-items-center"
                      style={{ borderColor: V2.LIGHT_BORDER, background: "#fff" }}
                    >
                      <ImageOff className="h-3.5 w-3.5" style={{ color: V2.LIGHT_MUTED }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">

                    <div className="text-sm font-medium truncate">{i.nome}</div>
                    <div className="text-[11px]" style={{ color: V2.LIGHT_MUTED }}>
                      {brl(unit)} · {brl(unit * i.quantidade)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="h-8 w-8 rounded border flex items-center justify-center"
                      style={{ borderColor: V2.LIGHT_BORDER }}
                      onClick={() => setQty(i.product_id, i.tipo_compra, Math.max(1, i.quantidade - 1))}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{i.quantidade}</span>
                    <button
                      className="h-8 w-8 rounded border flex items-center justify-center"
                      style={{ borderColor: V2.LIGHT_BORDER }}
                      onClick={() => setQty(i.product_id, i.tipo_compra, i.quantidade + 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="h-8 w-8 rounded flex items-center justify-center text-red-500"
                      onClick={() => remove(i.product_id, i.tipo_compra)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t flex items-center justify-between" style={{ borderColor: V2.LIGHT_BORDER }}>
            <div>
              <div className="text-[11px]" style={{ color: V2.LIGHT_MUTED }}>Total</div>
              <div className="text-xl font-bold" style={{ color: V2.TEAL }}>{brl(subtotal)}</div>
            </div>
            <Button
              onClick={() => {
                if (!customer) { toast.error("Selecione o cliente antes de cobrar"); setCustomerOpen(true); return; }
                setCheckoutOpen(true);
              }}
              className="h-12 px-6 text-base font-semibold"
              style={{ background: V2.TEAL, color: "#fff" }}
            >
              Cobrar
            </Button>
          </div>
        </div>
      )}

      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        total={subtotal}
        onDone={() => {
          clear();
          endSale();
          setCheckoutOpen(false);
        }}
      />

    </div>
  );
}

type AddOpts = { quantidade: number; tipo: "UNITARIO" | "PACOTE"; preco: number };

function AddItemModal({
  product, existing, onClose, onConfirm, onRemove,
}: {
  product: Product | null;
  existing?: CartItem | null;
  onClose: () => void;
  onConfirm: (opts: AddOpts) => void;
  onRemove?: () => void;
}) {
  const [tipo, setTipo] = useState<"UNITARIO" | "PACOTE">("UNITARIO");
  const [qtd, setQtd] = useState(1);
  const [preco, setPreco] = useState("");

  const basePreco = (t: "UNITARIO" | "PACOTE") =>
    t === "PACOTE"
      ? Number(product?.preco_pacote ?? 0)
      : Number(product?.preco_nivel_1 ?? product?.preco_unitario ?? 0);

  useEffect(() => {
    if (!product) return;
    const t = existing?.tipo_compra ?? "UNITARIO";
    setTipo(t);
    setQtd(existing?.quantidade ?? 1);
    const atual = existing
      ? t === "PACOTE"
        ? Number(existing.preco_pacote ?? 0)
        : Number(existing.preco_nivel_1 ?? existing.preco_unitario)
      : basePreco(t);
    setPreco(atual.toFixed(2));
  }, [product?.id]);

  if (!product) return null;

  const precoNum = Number(String(preco).replace(",", ".")) || 0;
  const total = precoNum * qtd;
  const temPacote = product.preco_pacote != null && Number(product.preco_pacote) > 0;

  return (
    <Dialog open={!!product} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug">
            {existing ? "Editar item" : product.nome}
          </DialogTitle>
          {existing && <div className="text-sm">{product.nome}</div>}
        </DialogHeader>


        <div className="space-y-3">
          <div className="text-[11px]" style={{ color: V2.LIGHT_MUTED }}>{product.sku}</div>

          {temPacote && (
            <div className="grid grid-cols-2 gap-2">
              {(["UNITARIO", "PACOTE"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTipo(t); setPreco(basePreco(t).toFixed(2)); }}
                  className="h-10 rounded-lg border text-sm font-medium"
                  style={{
                    background: tipo === t ? V2.TEAL : V2.LIGHT_SURFACE,
                    color: tipo === t ? "#fff" : "inherit",
                    borderColor: V2.LIGHT_BORDER,
                  }}
                >
                  {t === "UNITARIO" ? "Unidade" : `Pacote (${product.quantidade_pacote ?? 1})`}
                </button>
              ))}
            </div>
          )}

          <div>
            <div className="text-xs mb-1" style={{ color: V2.LIGHT_MUTED }}>Quantidade</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-12 w-12" onClick={() => setQtd((v) => Math.max(1, v - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                value={qtd}
                onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 1))}
                className="h-12 text-center text-lg font-semibold"
              />
              <Button variant="outline" className="h-12 w-12" onClick={() => setQtd((v) => v + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <div className="text-xs mb-1" style={{ color: V2.LIGHT_MUTED }}>
              Preço {tipo === "PACOTE" ? "do pacote" : "unitário"}
            </div>
            <Input
              type="text"
              inputMode="decimal"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="h-12 text-base"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: V2.LIGHT_BG }}>
            <span className="text-xs" style={{ color: V2.LIGHT_MUTED }}>Total do item</span>
            <span className="text-lg font-bold" style={{ color: V2.TEAL }}>{brl(total)}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:flex-row">
          {existing ? (
            <Button
              variant="outline"
              className="h-12 flex-1 text-red-600 border-red-200"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Remover
            </Button>
          ) : (
            <Button variant="outline" className="h-12 flex-1" onClick={onClose}>Cancelar</Button>
          )}
          <Button
            className="h-12 flex-1 font-semibold"
            style={{ background: V2.TEAL, color: "#fff" }}
            onClick={() => onConfirm({ quantidade: qtd, tipo, preco: precoNum })}
          >
            {existing ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

}


function CheckoutModal({
  open, onOpenChange, total, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; total: number; onDone: () => void }) {
  const items = useCart((s) => s.items);
  const customer = useSellerSession((s) => s.customer);
  const [tipo, setTipo] = useState<"PIX" | "CARTAO" | "DINHEIRO" | "FATURADO">("PIX");
  const [modalidade, setModalidade] = useState<"CREDITO" | "DEBITO">("CREDITO");
  const [parcelas, setParcelas] = useState(1);
  const [prazo, setPrazo] = useState<"30" | "30-60" | "30-60-90">("30");

  const { data: accounts = [] } = useBankAccounts();
  const [accountId, setAccountId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const createOrder = useCreateOrder();
  const confirmPay = useConfirmPayment();
  const [printPrompt, setPrintPrompt] = useState<null | { orderId: string; codigo: string }>(null);
  const [soldItems, setSoldItems] = useState<CartItem[]>([]);
  const [soldTier, setSoldTier] = useState(1 as ReturnType<typeof cartEffectiveSubtotal>["tier"]);
  const [soldTotal, setSoldTotal] = useState(0);
  const [soldPayment, setSoldPayment] = useState<{ tipo: "PIX" | "CARTAO" | "DINHEIRO" | "FATURADO"; modalidade?: "CREDITO" | "DEBITO"; parcelas?: number; prazos?: number[] } | null>(null);
  const [printing, setPrinting] = useState(false);
  const clearCart = useCart((s) => s.clear);
  const queryClient = useQueryClient();
  const { tier } = cartEffectiveSubtotal(items);

  useEffect(() => {
    if (open && !accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [open, accounts, accountId]);

  useEffect(() => {
    if (tipo !== "CARTAO") { setModalidade("CREDITO"); setParcelas(1); }
  }, [tipo]);

  const submittingRef = useRef(false);

  async function finalizar() {
    if (submittingRef.current) return;
    if (items.length === 0) { toast.error("Carrinho vazio"); return; }
    if (!customer) { toast.error("Selecione o cliente"); return; }
    submittingRef.current = true;
    setSaving(true);
    try {
      const priced = items.map((i) => ({
        ...i,
        preco_unitario: i.tipo_compra === "UNITARIO" ? effectiveUnitPrice(i, tier) : i.preco_unitario,
      }));
      const companyId = customer.id;
      const orderId = await createOrder.mutateAsync({
        company_id: companyId,
        address_id: null,
        origem: "VISITA",
        items: priced,
        frete: 0,
        desconto: 0,
        pagamento: tipo === "CARTAO" ? "CARTAO" : "PIX",
      });
      const account = accounts.find((a) => a.id === accountId);
      await confirmPay.mutateAsync({
        order_id: orderId,
        company_id: companyId,
        total,
        tipo,
        modalidade: tipo === "CARTAO" ? modalidade : undefined,
        bandeira: null,
        antecipado: false,
        conta: account?.nome ?? "—",
        account_id: accountId || null,
        parcelas: tipo === "CARTAO" ? parcelas : 1,
        prazos: tipo === "FATURADO" ? prazo.split("-").map(Number) : undefined,
      });
      const codigo = orderCode(orderId, customer.trade_name ?? customer.legal_name);
      setSoldItems(items);
      setSoldTier(tier);
      setSoldTotal(total);
      setSoldPayment({
        tipo,
        modalidade: tipo === "CARTAO" ? modalidade : undefined,
        parcelas: tipo === "CARTAO" ? parcelas : 1,
        prazos: tipo === "FATURADO" ? prazo.split("-").map(Number) : undefined,
      });

      setPrintPrompt({ orderId, codigo });
      queryClient.invalidateQueries({ queryKey: ["pos", "recent-orders"] });
      // limpa imediatamente os itens marcados nos cards de produto
      clearCart();

    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao finalizar");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  function buildTicketHtml() {
    if (!printPrompt) return null;
    return renderTicket({
      codigo: printPrompt.codigo,
      data: formatDateTime(new Date()),
      itens: soldItems.map((i) => {
        const unit = effectiveUnitPrice(i, soldTier);
        return { nome: i.nome, qtd: i.quantidade, unit, total: unit * i.quantidade };
      }),
      cliente: customer ? (customer.trade_name ?? customer.legal_name) : null,
      subtotal: soldTotal,
      total: soldTotal,
      pagamento: !soldPayment
        ? "—"
        : soldPayment.tipo === "FATURADO"
          ? `Faturado ${(soldPayment.prazos ?? [30]).join("/")} dias`
          : pagamentoLabel(soldPayment.tipo, { modalidade: soldPayment.modalidade ?? null, parcelas: soldPayment.parcelas ?? 1 }),
    });
  }

  async function doPrint(preview = false) {
    const html = buildTicketHtml();
    if (!html) { toast.error("Cupom indisponível"); return; }
    setPrinting(true);
    try {
      await printHTML(html, { preview });
      if (!preview) {
        // Impressão enviada: encerra a venda e volta limpo para a tela de venda.
        toast.success("Cupom enviado para impressão");
        setPrintPrompt(null);
        onDone();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao acessar a impressora interna";
      toast.error(message, { duration: 8000 });
    } finally {
      setPrinting(false);
    }
  }


  const nativePrinterReady = useNativePrinterReady();



  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPrintPrompt(null); onDone(); } onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{printPrompt ? "Venda concluída" : "Cobrar"}</DialogTitle>
        </DialogHeader>

        {!printPrompt ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-xs" style={{ color: V2.LIGHT_MUTED }}>Total</div>
              <div className="text-3xl font-bold" style={{ color: V2.TEAL }}>{brl(total)}</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([
                { k: "PIX", icon: QrCode, label: "PIX" },
                { k: "CARTAO", icon: CreditCard, label: "Cartão" },
                { k: "DINHEIRO", icon: Banknote, label: "Dinheiro" },
                { k: "FATURADO", icon: CalendarClock, label: "Faturado" },
              ] as const).map((p) => {

                const Icon = p.icon;
                const active = tipo === p.k;
                return (
                  <button
                    key={p.k}
                    onClick={() => setTipo(p.k)}
                    className="h-16 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-semibold"
                    style={active
                      ? { background: V2.TEAL, color: "#fff", borderColor: V2.TEAL }
                      : { background: V2.LIGHT_SURFACE_2, color: V2.LIGHT_TEXT, borderColor: V2.LIGHT_BORDER }}
                  >
                    <Icon className="h-5 w-5" />
                    {p.label}
                  </button>
                );
              })}
            </div>

            {tipo === "CARTAO" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs mb-1" style={{ color: V2.LIGHT_MUTED }}>Modalidade</div>
                  <select
                    value={modalidade}
                    onChange={(e) => setModalidade(e.target.value as "CREDITO" | "DEBITO")}
                    className="w-full h-11 rounded border px-2 text-sm"
                    style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
                  >
                    <option value="CREDITO">Crédito</option>
                    <option value="DEBITO">Débito</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: V2.LIGHT_MUTED }}>Parcelas</div>
                  <select
                    value={parcelas}
                    onChange={(e) => setParcelas(Number(e.target.value))}
                    className="w-full h-11 rounded border px-2 text-sm"
                    style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>{n}x {modalidade === "CREDITO" ? "crédito" : "débito"}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {tipo === "FATURADO" && (
              <div>
                <div className="text-xs mb-1" style={{ color: V2.LIGHT_MUTED }}>Prazo de recebimento</div>
                <select
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value as "30" | "30-60" | "30-60-90")}
                  className="w-full h-11 rounded border px-2 text-sm"
                  style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
                >
                  <option value="30">30 dias — 1x de {brl(total)}</option>
                  <option value="30-60">30/60 dias — 2x de {brl(total / 2)}</option>
                  <option value="30-60-90">30/60/90 dias — 3x de {brl(total / 3)}</option>
                </select>
              </div>
            )}



            <div>
              <div className="text-xs mb-1" style={{ color: V2.LIGHT_MUTED }}>Conta destino</div>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-11 rounded border px-2 text-sm"
                style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
              >
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>

            <Button
              onClick={finalizar}
              disabled={saving}
              className="w-full h-12 text-base font-semibold"
              style={{ background: V2.TEAL, color: "#fff" }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar venda"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-center text-sm">Pedido <strong>{printPrompt.codigo}</strong></div>
            <Button type="button" disabled={printing} onClick={() => { void doPrint(false); }} className="w-full h-12" style={{ background: POS_PRINT_COLOR, color: "#fff" }}>
              {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Printer className="h-4 w-4 mr-2" /> Imprimir</>}
            </Button>
            {!nativePrinterReady && (
              <div className="text-center text-[11px]" style={{ color: V2.LIGHT_MUTED }}>
                Ponte nativa ainda não detectada — o botão tenta imprimir mesmo assim.
              </div>
            )}
            <Button type="button" variant="outline" onClick={() => { void doPrint(true); }} className="w-full h-11">
              Ver cupom na tela
            </Button>
            <Button
              variant="outline"
              onClick={() => { setPrintPrompt(null); onDone(); }}
              className="w-full h-11"
            >
              Concluir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
