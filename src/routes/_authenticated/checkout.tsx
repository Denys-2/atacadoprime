import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth, useMyCompany } from "@/hooks/use-auth";
import { useAddresses, useCreateAddress, type AddressInput } from "@/hooks/use-addresses";
import { useCart, cartSubtotal } from "@/hooks/use-cart";
import { useSellerSession } from "@/hooks/use-seller-session";
import { useState, useMemo, useEffect } from "react";
import { useCreateOrder } from "@/hooks/use-orders";
import { usePaymentFees, usePaymentSettings, buildPlansFromFees } from "@/hooks/use-catalog";
import { calculateShipping, type ShippingOption } from "@/lib/shipping.functions";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Check, CreditCard, QrCode, Loader2, PackageCheck, UserCheck, ArrowLeft, MessageCircle } from "lucide-react";
import { WhatsAppFab } from "@/components/whatsapp-fab";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseLeadAddress } from "@/lib/lead-address";
import { usePixSettings } from "@/hooks/use-pix-settings";
import { Copy } from "lucide-react";

const REGISTRATION_ADDRESS_ID = "registration-address";

function normalizeZip(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 8);
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : "";
}
function normalizeState(value: string | null | undefined) {
  const uf = (value ?? "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
  return uf.length === 2 ? uf : "";
}
function normalizeAddressForOrder<T extends { zip?: string | null; state?: string | null }>(addr: T) {
  return { ...addr, zip: normalizeZip(addr.zip ?? ""), state: normalizeState(addr.state ?? "") };
}

function useSellerCompany(companyId: string | undefined) {
  return useQuery({
    queryKey: ["seller-company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, cidade, estado")
        .eq("id", companyId!)
        .maybeSingle();
      if (error) throw error;
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("observacoes")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (leadError) throw leadError;
      return data ? { ...data, lead_observacoes: lead?.observacoes ?? null } : null;
    },
  });
}

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Atacado" }] }),
  component: CheckoutPage,
});

const STEPS = ["Cliente", "Endereço", "Frete", "Pagamento"] as const;

function CheckoutPage() {
  const { user } = useAuth();
  const { data: ownCompany } = useMyCompany(user);
  const sellerCustomer = useSellerSession((s) => s.customer);
  const sellerTripId = useSellerSession((s) => s.tripId);
  const endSellerSale = useSellerSession((s) => s.endSale);
  const isSellerMode = !!sellerCustomer;

  // Fallback: se não há viagem explicita da sessão, usa a viagem aberta atual (se houver)
  const { data: activeTripId } = useQuery({
    queryKey: ["active-trip-id"],
    enabled: !sellerTripId,
    queryFn: async () => {
      const { data } = await supabase
        .from("trips" as never)
        .select("id")
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as { id: string } | null)?.id ?? null;
    },
  });

  const { data: sellerCompanyFull } = useSellerCompany(isSellerMode ? sellerCustomer!.id : undefined);
  const company = isSellerMode
    ? {
        id: sellerCustomer.id,
        legal_name: sellerCustomer.legal_name,
        tax_id: sellerCustomer.tax_id,
        status: "approved" as const,
        cidade: sellerCompanyFull?.cidade ?? null,
        estado: sellerCompanyFull?.estado ?? null,
      }
    : ownCompany;
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const { data: addresses = [] } = useAddresses(company?.id);
  const registrationAddress = useMemo(
    () => isSellerMode
      ? parseLeadAddress(sellerCompanyFull?.lead_observacoes, sellerCompanyFull?.cidade, sellerCompanyFull?.estado)
      : null,
    [isSellerMode, sellerCompanyFull?.cidade, sellerCompanyFull?.estado, sellerCompanyFull?.lead_observacoes],
  );
  const checkoutAddresses = useMemo(
    () => addresses.length > 0 || !registrationAddress
      ? addresses
      : [{ ...registrationAddress, id: REGISTRATION_ADDRESS_ID, kind: "both" as const }],
    [addresses, registrationAddress],
  );

  const [addressId, setAddressId] = useState<string>("");
  const [frete, setFrete] = useState(0);
  const [freteLabel, setFreteLabel] = useState<string>("");
  const [isRetirada, setIsRetirada] = useState(false);
  const [cepManual, setCepManual] = useState("");
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const calcShipping = useServerFn(calculateShipping);
  const [observacao, setObservacao] = useState("");
  const [pagamento, setPagamento] = useState<"PIX" | "CARTAO">("PIX");
  const [parcelas, setParcelas] = useState(1);
  const [multiplicador, setMultiplicador] = useState(1);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [pixAlertOpen, setPixAlertOpen] = useState(false);
  const [descontoInput, setDescontoInput] = useState(0);
  const [descontoTipo, setDescontoTipo] = useState<"BRL" | "PCT">("BRL");

  const { data: fees = [] } = usePaymentFees();
  const { data: settings = [] } = usePaymentSettings();
  const parcelasSemJuros = Number(settings.find((s) => s.key === "parcelas_sem_juros")?.value ?? 0);
  const antecMensal = Number(settings.find((s) => s.key === "antecipacao_mensal")?.value ?? 0);
  const plans = useMemo(
    () => buildPlansFromFees(fees, parcelasSemJuros, antecMensal),
    [fees, parcelasSemJuros, antecMensal],
  );

  const baseSubtotal = cartSubtotal(items);
  const fator = pagamento === "CARTAO" ? multiplicador : 1;
  const subtotal = baseSubtotal * fator;
  const acrescimo = subtotal - baseSubtotal;
  const desconto = isSellerMode
    ? descontoTipo === "PCT"
      ? subtotal * (Math.min(100, Math.max(0, descontoInput)) / 100)
      : Math.max(0, Number(descontoInput || 0))
    : 0;
  const total = Math.max(0, subtotal + frete - desconto);
  const valorParcela = pagamento === "CARTAO" && parcelas > 0 ? total / parcelas : 0;

  const create = useCreateOrder();

  const selectedAddress = checkoutAddresses.find((a) => a.id === addressId);
  useEffect(() => {
    if (selectedAddress?.zip) setCepManual(String(selectedAddress.zip));
  }, [selectedAddress?.zip]);
  useEffect(() => {
    if (!addressId && checkoutAddresses.length === 1) setAddressId(checkoutAddresses[0].id);
    if (addressId && !checkoutAddresses.some((a) => a.id === addressId)) setAddressId("");
  }, [addressId, checkoutAddresses]);

  async function handleCalcShipping() {
    const cep = (cepManual || "").replace(/\D/g, "");
    if (cep.length !== 8) {
      toast.error("Informe um CEP válido (8 dígitos).");
      return;
    }
    setShippingLoading(true);
    setShippingOptions([]);
    try {
      const opts = await calcShipping({
        data: {
          cepDestino: cep,
          items: items.map((i) => ({
            product_id: i.product_id,
            quantidade: i.quantidade,
            preco_unitario: Number(i.preco_unitario),
          })),
        },
      });
      const valid = opts.filter((o) => !o.error && o.price > 0);
      if (valid.length === 0) {
        toast.error("Nenhuma opção de frete disponível para este CEP.");
      }
      setShippingOptions(opts);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setShippingLoading(false);
    }
  }

  function pickShipping(opt: ShippingOption) {
    setIsRetirada(false);
    setFrete(opt.price);
    setFreteLabel(`${opt.company} ${opt.name} (${opt.delivery_days} dias úteis)`);
  }

  function pickRetirada() {
    setIsRetirada(true);
    setFrete(0);
    setFreteLabel("Retirada / Entrega em mãos");
    setShippingOptions([]);
  }

  function openCardDialog() {
    setPagamento("CARTAO");
    setCardDialogOpen(true);
  }

  function selectPix() {
    setPagamento("PIX");
    setParcelas(1);
    setMultiplicador(1);
    setPixAlertOpen(true);
  }

  function confirmPlan(p: { parcelas: number; multiplicador: number }) {
    setParcelas(p.parcelas);
    setMultiplicador(p.multiplicador);
    setCardDialogOpen(false);
  }

  if (!company || company.status !== "approved") {
    return (
      <CheckoutV3Shell title="Checkout B2B">
        <div className="rounded-2xl border p-6 text-sm max-w-md mx-auto my-8 text-center" style={{ background: "#ffffff", borderColor: "#e8e2d8" }}>
          {isSellerMode ? (
            "Cliente inválido para venda. Volte e escolha outro."
          ) : (
            <>
              <p className="font-bold text-base mb-2" style={{ color: "#3d2b1f" }}>Empresa em Aprovação</p>
              <p className="text-xs text-muted-foreground mb-4">Sua empresa precisa estar aprovada para finalizar pedidos no atacado.</p>
              <Link to="/companies" className="inline-flex h-10 px-5 rounded-full text-xs font-bold items-center text-white" style={{ background: "#c9a96e" }}>Ver meu cadastro</Link>
            </>
          )}
        </div>
      </CheckoutV3Shell>
    );
  }
  if (items.length === 0) {
    return (
      <CheckoutV3Shell title="Checkout B2B">
        <div className="rounded-2xl border p-8 text-center max-w-md mx-auto my-8 space-y-4" style={{ background: "#ffffff", borderColor: "#e8e2d8" }}>
          <p className="text-sm font-semibold" style={{ color: "#3d2b1f" }}>Seu carrinho está vazio.</p>
          <Link to="/" className="inline-flex h-11 px-6 rounded-full text-xs font-bold items-center text-white" style={{ background: "#c9a96e" }}>Voltar ao catálogo</Link>
        </div>
      </CheckoutV3Shell>
    );
  }

  async function finalizar() {
    if (pagamento === "CARTAO" && parcelas < 1) {
      toast.error("Selecione a quantidade de parcelas.");
      setCardDialogOpen(true);
      return;
    }
    try {
      const obsExtra = pagamento === "CARTAO"
        ? `Cartão em ${parcelas}x de ${brl(valorParcela)}${acrescimo > 0 ? ` (acréscimo ${brl(acrescimo)})` : " sem juros"}.`
        : "";
      const observacaoFinal = [observacao, obsExtra].filter(Boolean).join(" — ");
      let finalAddressId = addressId || null;
      let createdAddressId: string | null = null;
      if (finalAddressId === REGISTRATION_ADDRESS_ID && registrationAddress) {
        const normalized = normalizeAddressForOrder(registrationAddress);
        if (!normalized.zip || !normalized.state) {
          toast.error("O CEP/UF do endereço do cadastro está incompleto. Edite o cadastro do cliente ou informe um novo endereço.");
          setStep(1);
          return;
        }
        const { data, error } = await supabaseInsertAddress(company!.id, normalized);
        if (error) throw error;
        finalAddressId = data?.id ?? null;
        createdAddressId = finalAddressId;
        if (finalAddressId) setAddressId(finalAddressId);
      } else if (finalAddressId && selectedAddress) {
        if (!normalizeZip(selectedAddress.zip) || !normalizeState(selectedAddress.state)) {
          toast.error("Endereço selecionado tem CEP ou UF inválido. Edite-o antes de finalizar.");
          setStep(1);
          return;
        }
      }

      try {
        const id = await create.mutateAsync({
          company_id: company!.id,
          address_id: finalAddressId,
          origem: isSellerMode ? "VISITA" : "PORTAL",
          items,
          frete,
          desconto,
          acrescimo,
          observacao: observacaoFinal,
          pagamento,
          trip_id: sellerTripId ?? activeTripId ?? null,
        });

        clear();
        if (isSellerMode) endSellerSale();
        toast.success(isSellerMode ? "Venda finalizada! Pronto para o próximo cliente." : "Pedido criado!");
        if (isSellerMode) {
          navigate({ to: "/vendas/nova" });
        } else {
          navigate({ to: "/orders/$id", params: { id }, search: { edit: false } });
        }
      } catch (orderErr) {
        // Rollback: se criamos um endereço para este pedido e o pedido falhou, remove o endereço órfão.
        if (createdAddressId) {
          const { supabase } = await import("@/integrations/supabase/client");
          await supabase.from("addresses").delete().eq("id", createdAddressId);
          setAddressId(REGISTRATION_ADDRESS_ID);
        }
        throw orderErr;
      }

    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <CheckoutV3Shell
      title={isSellerMode ? "Finalizar Venda em Visita" : "Checkout — Finalizar Pedido"}
      description={isSellerMode ? `Cliente: ${sellerCustomer!.trade_name ?? sellerCustomer!.legal_name}` : "Conclua seu pedido em 4 passos."}
    >
      {isSellerMode && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-3 text-sm">
          <UserCheck className="h-4 w-4 text-primary shrink-0" />
          <span className="flex-1">
            Venda para <strong>{sellerCustomer!.trade_name ?? sellerCustomer!.legal_name}</strong> · CNPJ {sellerCustomer!.tax_id ?? "—"}
          </span>
          <button
            onClick={() => { endSellerSale(); clear(); navigate({ to: "/vendas/nova" }); }}
            className="text-xs underline text-muted-foreground hover:text-destructive"
          >
            Cancelar venda
          </button>
        </div>
      )}

      <ol className="flex gap-2 mb-6 overflow-x-auto">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border whitespace-nowrap",
            i === step ? "bg-primary text-primary-foreground border-primary" :
            i < step ? "bg-success/10 text-success border-success/40" :
            "bg-card text-muted-foreground border-border")}>
            {i < step && <Check className="w-3 h-3" />}
            <span className="font-medium">{i + 1}. {s}</span>
          </li>
        ))}
      </ol>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 space-y-4">
          {step === 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold">Dados do cliente</h2>
              <Field label="Empresa" value={company.legal_name} />
              <Field label="CNPJ" value={company.tax_id ?? "—"} />
              <div className="space-y-1">
                <Label>Observação (opcional)</Label>
                <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} className="w-full min-h-20 rounded-md border border-border bg-background p-2 text-sm" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <h2 className="font-semibold">Endereço de entrega</h2>
              {isSellerMode && (
                <button
                  onClick={() => { setAddressId(""); setStep(2); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-md border border-primary/40 bg-primary/5 text-sm text-left hover:bg-primary/10 transition-colors"
                >
                  <PackageCheck className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">Pular endereço — venda em loco</p>
                    <p className="text-xs text-muted-foreground">Entrega já feita em mãos. Não precisa informar endereço.</p>
                  </div>
                </button>
              )}
              {checkoutAddresses.length > 0 && (
                <div className="space-y-2">
                  {checkoutAddresses.map((a) => (
                    <label key={a.id} className={cn("flex gap-3 p-3 rounded-md border cursor-pointer transition-colors",
                      addressId === a.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}>
                      <input type="radio" name="addr" value={a.id} checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1" />
                      <div className="text-sm">
                        <p className="font-medium">{a.label ?? a.kind}</p>
                        <p className="text-muted-foreground">{a.street}, {a.number} — {a.district}, {a.city}/{a.state} · CEP {a.zip}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {checkoutAddresses.length === 0 && (
                <InlineAddressForm
                  companyId={company.id}
                  defaultCity={company.cidade ?? ""}
                  defaultState={company.estado ?? ""}
                  prefill={registrationAddress}
                  onCreated={(id) => { setAddressId(id); setStep(2); }}
                />
              )}

            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h2 className="font-semibold">Entrega</h2>

              <button
                onClick={pickRetirada}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-md border text-sm text-left transition-colors",
                  isRetirada ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                )}
              >
                <PackageCheck className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Retirada / Entrega em mãos</p>
                  <p className="text-xs text-muted-foreground">Mercadoria entregue na hora pelo vendedor. Sem custo de frete.</p>
                </div>
                <span className="font-semibold">{brl(0)}</span>
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-2 text-[11px] uppercase tracking-wider text-muted-foreground">ou calcular frete</span></div>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label>CEP de destino</Label>
                  <Input
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="00000-000"
                    value={cepManual}
                    onChange={(e) => setCepManual(e.target.value)}
                  />
                </div>
                <Button onClick={handleCalcShipping} disabled={shippingLoading} variant="outline">
                  {shippingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Calcular"}
                </Button>
              </div>

              {shippingOptions.length > 0 && (
                <div className="space-y-2 pt-2">
                  {shippingOptions.map((o) => {
                    const disabled = !!o.error || o.price <= 0;
                    const selected = !disabled && frete === o.price && freteLabel.includes(o.name);
                    return (
                      <button
                        key={o.id}
                        disabled={disabled}
                        onClick={() => pickShipping(o)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm text-left transition-colors",
                          disabled && "opacity-50 cursor-not-allowed",
                          selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                        )}
                      >
                        <div>
                          <p className="font-medium">{o.company} — {o.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {o.error ? o.error : `Entrega em ${o.delivery_days} dias úteis`}
                          </p>
                        </div>
                        <span className="font-semibold">{disabled ? "—" : brl(o.price)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {freteLabel && (
                <div className="rounded-md border border-success/40 bg-success/10 p-2 text-xs">
                  Selecionado: <strong>{freteLabel}</strong> — {brl(frete)}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold">Pagamento</h2>
              <div className="grid grid-cols-2 gap-3">
                <PayOption icon={QrCode} label="PIX" active={pagamento === "PIX"} onClick={selectPix} />
                <PayOption icon={CreditCard} label="Cartão" active={pagamento === "CARTAO"} onClick={openCardDialog} />
              </div>
              {pagamento === "CARTAO" && (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs flex items-center justify-between">
                  <span>{parcelas}× de <strong>{brl(valorParcela)}</strong>{acrescimo > 0 ? ` (acréscimo ${brl(acrescimo)})` : " — sem juros"}</span>
                  <button onClick={() => setCardDialogOpen(true)} className="underline text-primary">Alterar</button>
                </div>
              )}
              {isSellerMode && (
                <div className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Desconto na venda</Label>
                    <div className="inline-flex rounded-md border border-border overflow-hidden">
                      <button
                        type="button"
                        className={cn("px-2 text-[11px] leading-6", descontoTipo === "BRL" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                        onClick={() => setDescontoTipo("BRL")}
                      >R$</button>
                      <button
                        type="button"
                        className={cn("px-2 text-[11px] leading-6", descontoTipo === "PCT" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                        onClick={() => setDescontoTipo("PCT")}
                      >%</button>
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={descontoTipo === "PCT" ? 100 : undefined}
                    step="0.01"
                    value={descontoInput}
                    onChange={(e) => setDescontoInput(Number(e.target.value))}
                    placeholder="0"
                  />
                  {desconto > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Desconto aplicado: <strong className="text-destructive">- {brl(desconto)}</strong>
                    </p>
                  )}
                </div>
              )}
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                A integração com Mercado Pago (geração de QR Code PIX e processamento de cartão) será concluída assim que você fornecer a chave de acesso da sua conta MP. Por enquanto o pedido é criado com status <strong>Aguardando pagamento</strong>.
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-border">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !addressId && !isSellerMode}>Continuar</Button>
            ) : (
              <Button onClick={finalizar} disabled={create.isPending}>{create.isPending ? "Criando…" : "Finalizar pedido"}</Button>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 h-fit space-y-3">
          <h3 className="font-semibold text-sm">Resumo</h3>
          <ul className="space-y-1 text-xs">
            {items.map((i) => (
              <li key={`${i.product_id}-${i.tipo_compra}`} className="flex justify-between gap-2">
                <span className="truncate">{i.quantidade}× {i.nome} {i.tipo_compra === "PACOTE" ? "(pacote)" : ""}</span>
                <span>{brl((i.tipo_compra === "PACOTE" && i.preco_pacote ? Number(i.preco_pacote) : Number(i.preco_unitario)) * i.quantidade * fator)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
            <div className="flex justify-between"><span>Frete</span><span>{brl(frete)}</span></div>
            {desconto > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Desconto{descontoTipo === "PCT" ? ` (${descontoInput}%)` : ""}</span>
                <span>- {brl(desconto)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-1 border-t border-border"><span>Total</span><span>{brl(total)}</span></div>
            {pagamento === "CARTAO" && parcelas > 1 && (
              <p className="text-xs text-muted-foreground text-right">{parcelas}× de {brl(valorParcela)}</p>
            )}
          </div>
        </div>
      </div>

      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Parcelamento no cartão</DialogTitle>
            <DialogDescription>Escolha em quantas vezes deseja pagar. O total é recalculado com a taxa correspondente.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto divide-y divide-border border border-border rounded-md">
            {plans.map((p) => {
              const totalPlan = baseSubtotal * p.multiplicador + frete;
              const parcela = totalPlan / p.parcelas;
              const semJuros = p.multiplicador === 1;
              const selected = p.parcelas === parcelas;
              return (
                <button
                  key={p.id}
                  onClick={() => confirmPlan(p)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left",
                    selected && "bg-primary/10",
                  )}
                >
                  <span className="font-medium">{p.parcelas}× de {brl(parcela)}</span>
                  <span className={cn("text-xs", semJuros ? "text-success" : "text-muted-foreground")}>
                    {semJuros ? "sem juros" : `total ${brl(totalPlan)}`}
                  </span>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PixDialog open={pixAlertOpen} onOpenChange={setPixAlertOpen} total={total} />
    </CheckoutV3Shell>
  );
}

function PixDialog({ open, onOpenChange, total }: { open: boolean; onOpenChange: (v: boolean) => void; total: number }) {
  const { data: pix } = usePixSettings();
  const copiaCola = pix?.copia_cola ?? "";
  const qr = pix?.qr_image_url ?? "";

  async function copy() {
    if (!copiaCola) return toast.error("Chave PIX ainda não configurada pelo admin.");
    try {
      await navigator.clipboard.writeText(copiaCola);
      toast.success("Copiado! Cole no app do seu banco.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-2 border-warning max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold text-warning">⚠️ ATENÇÃO!</DialogTitle>
          <DialogDescription className="sr-only">Instruções para pagamento via PIX</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-warning/10 border border-warning/40 p-4">
            <p className="text-base font-semibold leading-relaxed">
              Digite o <span className="text-warning font-extrabold underline">VALOR EXATO</span> da sua compra ao pagar o PIX.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              O QR Code é <strong>sem valor pré-definido</strong>. Sem o valor exato, o sistema não identifica seu pagamento automaticamente.
            </p>
          </div>

          <div className="rounded-md bg-primary/10 border border-primary/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">Valor a pagar</p>
            <p className="text-3xl font-extrabold text-primary">{brl(total)}</p>
          </div>

          {qr ? (
            <div className="rounded-lg border border-border bg-white p-3 flex justify-center">
              <img src={qr} alt="QR Code PIX" className="w-56 h-56 object-contain" />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              QR Code ainda não configurado. Peça ao admin para cadastrar em <strong>Administração › PIX</strong>.
            </div>
          )}

          {copiaCola && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">PIX copia e cola</Label>
              <div className="mt-1 rounded-md border border-border bg-muted/40 p-2 text-[11px] font-mono break-all max-h-24 overflow-y-auto">
                {copiaCola}
              </div>
              <Button onClick={copy} variant="outline" className="w-full mt-2 gap-2">
                <Copy className="w-4 h-4" /> Copiar código PIX
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button className="w-full" onClick={() => onOpenChange(false)}>Entendi, vou pagar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function PayOption({ icon: Icon, label, active, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("border rounded-lg p-4 flex flex-col items-center gap-2 transition-colors",
      active ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}>
      <Icon className="w-6 h-6" />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

function InlineAddressForm({
  companyId,
  defaultCity,
  defaultState,
  prefill,
  onCreated,
}: {
  companyId: string;
  defaultCity?: string;
  defaultState?: string;
  prefill?: AddressInput | null;
  onCreated: (id: string) => void;
}) {
  const create = useCreateAddress(companyId);
  const [form, setForm] = useState<AddressInput>({
    label: prefill?.label ?? "Entrega",
    street: prefill?.street ?? "",
    number: prefill?.number ?? "",
    complement: prefill?.complement ?? "",
    district: prefill?.district ?? "",
    city: prefill?.city ?? defaultCity ?? "",
    state: prefill?.state ?? defaultState ?? "",
    zip: prefill?.zip ?? "",
  });


  function set<K extends keyof AddressInput>(k: K, v: AddressInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.street || !form.number || !form.city || !form.state || !form.zip) {
      toast.error("Preencha rua, número, cidade, UF e CEP.");
      return;
    }
    try {
      const { data, error } = await supabaseInsertAddress(companyId, form);
      if (error) throw error;
      toast.success("Endereço cadastrado");
      if (data?.id) onCreated(data.id);
      setForm((f) => ({ ...f, street: "", number: "", complement: "", district: "", zip: "" }));
      create.reset();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar endereço");
    }
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
      <p className="text-sm font-medium">Adicionar endereço de entrega</p>
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
        <div className="sm:col-span-4"><Label className="text-xs">Rua</Label><Input value={form.street} onChange={(e) => set("street", e.target.value)} /></div>
        <div className="sm:col-span-2"><Label className="text-xs">Número</Label><Input value={form.number} onChange={(e) => set("number", e.target.value)} /></div>
        <div className="sm:col-span-3"><Label className="text-xs">Complemento</Label><Input value={form.complement} onChange={(e) => set("complement", e.target.value)} /></div>
        <div className="sm:col-span-3"><Label className="text-xs">Bairro</Label><Input value={form.district} onChange={(e) => set("district", e.target.value)} /></div>
        <div className="sm:col-span-3"><Label className="text-xs">Cidade</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
        <div className="sm:col-span-1"><Label className="text-xs">UF</Label><Input maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} /></div>
        <div className="sm:col-span-2"><Label className="text-xs">CEP</Label><Input value={form.zip} onChange={(e) => set("zip", e.target.value)} /></div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={create.isPending}>
          {create.isPending ? "Salvando…" : "Salvar endereço"}
        </Button>
      </div>
    </div>
  );
}

async function supabaseInsertAddress(companyId: string, form: AddressInput) {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase
    .from("addresses")
    .insert({ ...form, company_id: companyId })
    .select("id")
    .single();
}

function CheckoutV3Shell({ children, title, description }: { children: React.ReactNode; title: string; description?: string }) {
  const BG = "#faf8f5";
  const SURFACE = "#ffffff";
  const BORDER = "#e8e2d8";
  const ORANGE = "#c9a96e";
  const TEXT = "#3d2b1f";
  const MUTED = "#8b7355";

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: BG, color: TEXT }}>
      {/* Header V3 */}
      <header
        className="sticky top-0 z-30 backdrop-blur border-b"
        style={{ background: "rgba(255,255,255,0.92)", borderColor: BORDER }}
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="Atacado Prime">
            <img src="/brand-logo.png" alt="Atacado Prime" width={48} height={48} className="h-11 w-11 object-contain transition-transform duration-300 group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="font-extrabold tracking-tight text-base sm:text-lg leading-none" style={{ color: TEXT }}>
                Atacado <span style={{ color: ORANGE }}>Prime</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-amber-700/80 mt-0.5">
                Checkout Seguro
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="https://wa.me/5534998651112?text=Ol%C3%A1!%20Estou%20no%20checkout%20do%20site%20e%20preciso%20de%20suporte."
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3.5 rounded-full text-xs font-bold hidden sm:inline-flex items-center gap-1.5 transition-colors border"
              style={{ borderColor: "#25D366", color: "#1b8a43", background: "rgba(37, 211, 102, 0.08)" }}
            >
              <MessageCircle className="h-3.5 w-3.5 fill-current" />
              WhatsApp
            </a>
            <Link
              to="/cart"
              className="h-9 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border transition-colors hover:bg-black/5"
              style={{ borderColor: BORDER, color: TEXT }}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao carrinho
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black" style={{ color: TEXT }}>{title}</h1>
          {description && <p className="text-sm font-medium mt-1" style={{ color: MUTED }}>{description}</p>}
        </div>
        {children}
      </main>

      {/* Footer V3 */}
      <footer className="border-t mt-auto" style={{ borderColor: BORDER, background: SURFACE }}>
        <div className="max-w-6xl mx-auto px-5 py-8 text-xs" style={{ color: MUTED }}>
          <div className="font-black text-sm tracking-[0.2em] uppercase mb-2" style={{ color: TEXT }}>
            Atacado Prime
          </div>
          <div>Uberlândia-MG · (34) 99865-1112 · contato@primeautomotive.app</div>
          <div className="mt-3 opacity-60">© {new Date().getFullYear()} Prime Automotive · Distribuidor B2B</div>
        </div>
      </footer>

      {/* WhatsApp FAB */}
      <WhatsAppFab message="Olá! Estou no checkout do Atacado Prime e preciso de suporte com meu pedido." />
    </div>
  );
}
