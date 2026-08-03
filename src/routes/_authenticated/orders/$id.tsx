import { createFileRoute, Link } from "@tanstack/react-router";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { useOrder, useUpdateOrderStatus, useUpdatePaymentLink, useUpdateOrderItems, useConfirmPayment } from "@/hooks/use-orders";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { useAuth, useRoles } from "@/hooks/use-auth";
import { brl, formatDateTime } from "@/lib/format";
import { canCancel, isPaidStatus, nextStatus } from "@/lib/orders/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/orders/status-pill";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Copy, Truck, FileDown, Pencil, Save, X, Send } from "lucide-react";
import { generateOrderPdf } from "@/lib/order-pdf";
import { getOrderShare } from "@/lib/order-share.functions";
import { orderCodeHash } from "@/lib/order-code";
import { useBankAccounts } from "@/hooks/use-bank-accounts";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  head: ({ params }) => ({ meta: [{ title: `Pedido ${params.id.slice(0, 8)} — Atacado` }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    edit: search.edit === true || search.edit === "true",
  }),
  component: OrderDetail,
});


function OrderDetail() {
  const { id } = Route.useParams();
  const { edit } = Route.useSearch();
  const { data: o, isLoading } = useOrder(id);
  const { user } = useAuth();
  const { data: roles = [] } = useRoles(user);
  const isAdmin = roles.includes("admin");
  const isSeller = roles.some((r) => r === "admin" || r === "vendedor" || r === "gerente");
  const update = useUpdateOrderStatus();
  const updateLink = useUpdatePaymentLink();
  const updateItems = useUpdateOrderItems();
  const confirmPay = useConfirmPayment();
  const { data: bankAccounts = [] } = useBankAccounts();
  const [linkDraft, setLinkDraft] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payReplace, setPayReplace] = useState(false);

  const [payTipo, setPayTipo] = useState<"PIX" | "CARTAO" | "DINHEIRO" | "FATURADO">("PIX");
  const [payAccountId, setPayAccountId] = useState<string>("");
  const [payParcelas, setPayParcelas] = useState(1);
  const [payPrazo, setPayPrazo] = useState<"30" | "30-60" | "30-60-90">("30");
  const [payObs, setPayObs] = useState("");


  useEffect(() => {
    if (!payAccountId && bankAccounts.length > 0) setPayAccountId(bankAccounts[0].id);
  }, [bankAccounts, payAccountId]);


  const pay = o?.payments?.[0];
  useEffect(() => { setLinkDraft(pay?.payment_link ?? ""); }, [pay?.payment_link]);


  // Edição dos itens/valores
  const [editMode, setEditMode] = useState(false);
  type Draft = { id: string; quantidade: number; preco_final: number };
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [freteDraft, setFreteDraft] = useState(0);
  const [descontoDraft, setDescontoDraft] = useState(0);
  const canEdit = !!(isSeller && o && o.status !== "CANCELADO" && o.status !== "ENTREGUE");

  useEffect(() => {
    if (edit && canEdit) setEditMode(true);
  }, [edit, canEdit]);

  useEffect(() => {
    if (!o) return;
    setDrafts((o.order_items ?? []).map((it) => ({
      id: it.id,
      quantidade: Number(it.quantidade),
      preco_final: Number(it.preco_final),
    })));
    setFreteDraft(Number(o.frete));
    setDescontoDraft(Number(o.desconto));
  }, [o?.id, editMode]);

  const draftSubtotal = useMemo(
    () => drafts.reduce((s, d) => s + Number(d.preco_final) * Number(d.quantidade), 0),
    [drafts],
  );
  const draftTotal = draftSubtotal + Number(freteDraft || 0) - Number(descontoDraft || 0);

  if (isLoading) return <V2InternalShell title="Pedido"><p className="text-sm text-muted-foreground">Carregando…</p></V2InternalShell>;
  if (!o) return <V2InternalShell title="Pedido"><p className="text-sm text-muted-foreground">Pedido não encontrado.</p></V2InternalShell>;

  const next = nextStatus(o.status);
  const isPaid = isPaidStatus(o.status);

  return (
    <V2InternalShell title={`Pedido ${orderCodeHash(o.id, o.companies?.trade_name || o.companies?.legal_name)}`} description={formatDateTime(o.created_at)}>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Status atual</p>
              <div className="mt-2"><StatusPill status={o.status} /></div>
            </div>
            {isAdmin && next && (
              <Button onClick={() => {
                if (next === "PAGO") {
                  setPayTipo("PIX");
                  setPayParcelas(1);
                  setPayObs("");
                  setPayOpen(true);
                } else {
                  update.mutate({ id: o.id, status: next as never }, { onSuccess: () => toast.success("Status atualizado") });
                }
              }}>
                Avançar para {next.replace(/_/g, " ")}
              </Button>
            )}

            <Button variant="outline" onClick={() => generateOrderPdf({
              id: o.id,
              created_at: o.created_at,
              subtotal: o.subtotal,
              frete: o.frete,
              desconto: o.desconto,
              total: o.total,
              observacao: o.observacao,
              status: o.status,
              company: o.companies,
              address: o.addresses,
              items: (o.order_items ?? []).map((it) => ({
                nome: it.products?.nome ?? "—",
                sku: it.products?.sku,
                tipo_compra: it.tipo_compra,
                quantidade: it.quantidade,
                preco_final: it.preco_final,
                subtotal: it.subtotal,
              })),
              payment: pay ? { tipo: pay.tipo, status: pay.status, payment_link: pay.payment_link } : null,
            })}>
              <FileDown className="w-4 h-4 mr-1" /> Imprimir PDF
            </Button>

            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const share = await getOrderShare({ data: { orderId: o.id } });
                  if (!share.phone) {
                    toast.error("Cliente sem telefone cadastrado");
                    return;
                  }
                  const digits = share.phone.replace(/\D/g, "");
                  const phone = digits.startsWith("55") ? digits : `55${digits}`;
                  const url = `${window.location.origin}${share.path}`;
                  const nome = share.name ? ` ${share.name}` : "";
                  const txt = `Olá${nome}! Segue o orçamento do pedido ${orderCodeHash(o.id, o.companies?.trade_name || o.companies?.legal_name)} no valor de ${brl(Number(o.total))}.\n\nPDF: ${url}`;
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(txt)}`, "_blank", "noopener,noreferrer");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro ao gerar link");
                }
              }}
            >
              <Send className="w-4 h-4 mr-1" /> Enviar WhatsApp
            </Button>

            {isAdmin && canCancel(o.status) && (
              <Button variant="outline" onClick={() => { if (confirm("Cancelar pedido?")) update.mutate({ id: o.id, status: "CANCELADO" }); }}>
                Cancelar
              </Button>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h2 className="font-semibold">Itens</h2>
              {canEdit && !editMode && (
                <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editar valores
                </Button>
              )}
              {editMode && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>
                    <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" disabled={updateItems.isPending} onClick={() => {
                    updateItems.mutate(
                      { order_id: o.id, items: drafts, frete: Number(freteDraft || 0), desconto: Number(descontoDraft || 0) },
                      {
                        onSuccess: () => { toast.success("Pedido atualizado"); setEditMode(false); },
                        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
                      },
                    );
                  }}>
                    <Save className="w-3.5 h-3.5 mr-1" /> Salvar alterações
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {(o.order_items ?? []).map((it) => {
                const d = drafts.find((x) => x.id === it.id);
                const qty = d?.quantidade ?? Number(it.quantidade);
                const preco = d?.preco_final ?? Number(it.preco_final);
                const sub = qty * preco;
                return (
                  <div key={it.id} className="flex items-start gap-3 text-sm border-b border-border last:border-0 pb-2 last:pb-0 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <p className="font-medium">{it.products?.nome ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">SKU {it.products?.sku} · {it.tipo_compra}</p>
                    </div>
                    {editMode ? (
                      <div className="flex items-center gap-2">
                        <div>
                          <label className="text-[10px] uppercase text-muted-foreground">Qtd</label>
                          <Input type="number" min={1} className="h-8 w-20"
                            value={qty}
                            onChange={(e) => setDrafts((prev) => prev.map((x) => x.id === it.id ? { ...x, quantidade: Number(e.target.value) } : x))}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase text-muted-foreground">Preço unit.</label>
                          <Input type="number" step="0.01" min={0} className="h-8 w-28"
                            value={preco}
                            onChange={(e) => setDrafts((prev) => prev.map((x) => x.id === it.id ? { ...x, preco_final: Number(e.target.value) } : x))}
                          />
                        </div>
                        <div className="text-right min-w-[90px]">
                          <p className="text-[10px] uppercase text-muted-foreground">Subtotal</p>
                          <p className="font-semibold">{brl(sub)}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">{qty}× {brl(preco)}</p>
                        <p className="font-medium min-w-[80px] text-right">{brl(Number(it.subtotal))}</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 border-t border-border pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{brl(editMode ? draftSubtotal : Number(o.subtotal))}</span></div>
              <div className="flex justify-between items-center">
                <span>Frete</span>
                {editMode ? (
                  <Input type="number" step="0.01" min={0} className="h-8 w-28 text-right"
                    value={freteDraft} onChange={(e) => setFreteDraft(Number(e.target.value))} />
                ) : (<span>{brl(Number(o.frete))}</span>)}
              </div>
              <div className="flex justify-between items-center text-success">
                <span>Desconto</span>
                {editMode ? (
                  <Input type="number" step="0.01" min={0} className="h-8 w-28 text-right"
                    value={descontoDraft} onChange={(e) => setDescontoDraft(Number(e.target.value))} />
                ) : (Number(o.desconto) > 0 ? <span>- {brl(Number(o.desconto))}</span> : <span className="text-muted-foreground">—</span>)}
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-border">
                <span>Total</span><span>{brl(editMode ? draftTotal : Number(o.total))}</span>
              </div>
            </div>
          </div>

          {!pay && isAdmin && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h2 className="font-semibold">Forma de pagamento</h2>
              <p className="text-sm text-muted-foreground">
                Nenhum pagamento registrado neste pedido. Registre agora escolhendo PIX, cartão, dinheiro ou venda faturada.
              </p>
              <div className="flex flex-wrap gap-2">
                {(["PIX", "CARTAO", "DINHEIRO", "FATURADO"] as const).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={t === "PIX" ? "default" : "outline"}
                    onClick={() => {
                      setPayTipo(t);
                      setPayParcelas(1);
                      setPayPrazo("30");
                      setPayObs("");
                      setPayReplace(false);
                      setPayOpen(true);

                    }}
                  >
                    {t === "CARTAO" ? "Cartão" : t === "DINHEIRO" ? "Dinheiro" : t === "FATURADO" ? "Venda faturada" : "PIX"}
                  </Button>
                ))}
              </div>

            </div>
          )}


          {pay && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-semibold">Pagamento — {pay.tipo}</h2>
                <span className="text-xs px-2 py-1 rounded-full bg-muted">{pay.status}</span>
              </div>

              {pay.payment_link && !isAdmin && (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Link de pagamento</p>
                  <p className="text-sm font-mono break-all">{pay.payment_link}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button asChild size="sm">
                      <a href={pay.payment_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 mr-1" /> Pagar agora
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText(pay.payment_link!);
                      toast.success("Link copiado");
                    }}>
                      <Copy className="w-3 h-3 mr-1" /> Copiar
                    </Button>
                  </div>
                </div>
              )}

              {!pay.payment_link && !isAdmin && (
                <p className="text-sm text-muted-foreground">
                  Aguardando o time gerar o link de pagamento. Você será notificado por WhatsApp assim que estiver disponível.
                </p>
              )}

              {isAdmin && !isPaid && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Admin · gerar link manual</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Cole o link de pagamento (PIX copia-cola, Mercado Pago, etc.)"
                      value={linkDraft}
                      onChange={(e) => setLinkDraft(e.target.value)}
                    />
                    <Button
                      onClick={() => updateLink.mutate(
                        { order_id: o.id, payment_link: linkDraft.trim() },
                        { onSuccess: () => toast.success("Link salvo. O cliente já pode ver no pedido.") },
                      )}
                      disabled={!linkDraft.trim() || updateLink.isPending}
                    >Salvar</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    O envio automático via WhatsApp (Z-API) será habilitado quando os tokens forem cadastrados.
                  </p>
                </div>
              )}

              {isAdmin && isPaid && (
                <div className="pt-2 border-t border-border space-y-3">
                  <p className="text-xs text-success">Pagamento confirmado — pronto para emitir etiqueta.</p>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Alterar forma de pagamento
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(["PIX", "CARTAO", "DINHEIRO", "FATURADO"] as const).map((t) => (
                        <Button
                          key={t}
                          size="sm"
                          variant={pay.tipo === t ? "default" : "outline"}
                          onClick={() => {
                            setPayTipo(t);
                            setPayParcelas(1);
                            setPayPrazo("30");
                            setPayObs("");
                            setPayReplace(true);
                            setPayOpen(true);
                          }}
                        >
                          {t === "CARTAO" ? "Cartão" : t === "DINHEIRO" ? "Dinheiro" : t === "FATURADO" ? "Venda faturada" : "PIX"}
                        </Button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Os lançamentos financeiros deste pedido são refeitos com a nova forma escolhida. O total não muda.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" disabled>
                    <Truck className="w-3 h-3 mr-1" /> Gerar etiqueta (Melhor Envio)
                  </Button>
                </div>
              )}

            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-3">Histórico</h2>
            <ol className="space-y-2 text-sm">
              {(o.order_history ?? []).slice().reverse().map((h) => (
                <li key={h.id} className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <div>
                    <p className="font-medium">{h.status.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)} · {h.observacao}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-2">Cliente</h3>
            <p className="text-sm">{o.companies?.legal_name}</p>
            <p className="text-xs text-muted-foreground mt-1">Origem: {o.origem}</p>
          </div>
          {o.addresses && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-2">Entrega</h3>
              <p className="text-sm">{o.addresses.street}, {o.addresses.number}</p>
              <p className="text-xs text-muted-foreground">{o.addresses.district}, {o.addresses.city}/{o.addresses.state}</p>
              <p className="text-xs text-muted-foreground">CEP {o.addresses.zip}</p>
            </div>
          )}
          {o.observacao && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-2">Observação</h3>
              <p className="text-sm whitespace-pre-line">{o.observacao}</p>
            </div>
          )}
          <Button asChild variant="outline" className="w-full"><Link to="/orders">Voltar para pedidos</Link></Button>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{payReplace ? "Alterar forma de pagamento" : "Confirmar pagamento"} — {brl(Number(o.total))}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={payTipo} onValueChange={(v) => setPayTipo(v as "PIX" | "CARTAO" | "DINHEIRO" | "FATURADO")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="CARTAO">Cartão</SelectItem>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="FATURADO">Venda faturada (a prazo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Conta bancária de destino</Label>
              {bankAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cadastre uma conta bancária no Financeiro antes de confirmar.</p>
              ) : (
                <Select value={payAccountId} onValueChange={setPayAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome}{a.banco ? ` — ${a.banco}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {payTipo === "CARTAO" && (
              <div className="space-y-1.5">
                <Label>Parcelas</Label>
                <Select value={String(payParcelas)} onValueChange={(v) => setPayParcelas(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}x de {brl(Number(o.total) / n)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {payTipo === "FATURADO" && (
              <div className="space-y-1.5">
                <Label>Prazo de recebimento</Label>
                <Select value={payPrazo} onValueChange={(v) => setPayPrazo(v as "30" | "30-60" | "30-60-90")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 dias — 1x de {brl(Number(o.total))}</SelectItem>
                    <SelectItem value="30-60">30/60 dias — 2x de {brl(Number(o.total) / 2)}</SelectItem>
                    <SelectItem value="30-60-90">30/60/90 dias — 3x de {brl(Number(o.total) / 3)}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Gera contas a receber em aberto no Financeiro, com os vencimentos escolhidos.
                </p>
              </div>
            )}


            <div className="space-y-1.5">
              <Label>Observação (opcional)</Label>
              <Input placeholder="Ex: pago na hora, comprovante enviado…" value={payObs} onChange={(e) => setPayObs(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button disabled={!payAccountId || confirmPay.isPending} onClick={() => {
              const acc = bankAccounts.find((a) => a.id === payAccountId);
              if (!acc) { toast.error("Selecione uma conta bancária"); return; }
              confirmPay.mutate({
                order_id: o.id,
                company_id: o.company_id ?? null,
                total: Number(o.total),
                tipo: payTipo,
                conta: acc.nome,
                account_id: acc.id,
                parcelas: payTipo === "CARTAO" ? payParcelas : 1,
                prazos: payTipo === "FATURADO" ? payPrazo.split("-").map(Number) : undefined,
                observacao: payObs.trim() || undefined,
                replace: payReplace,
              }, {

                onSuccess: () => {
                  toast.success(payReplace ? "Forma de pagamento atualizada" : "Pagamento confirmado");
                  setPayOpen(false);
                  setPayReplace(false);
                },
                onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao confirmar"),
              });
            }}>
              {confirmPay.isPending ? "Salvando…" : payReplace ? "Salvar alteração" : "Confirmar pagamento"}
            </Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>
    </V2InternalShell>

  );
}
