import { createFileRoute } from "@tanstack/react-router";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { StatCard } from "@/components/ui/data-cards";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Package, AlertTriangle, XCircle, Tag, FolderTree, Percent, Upload, ImageIcon, Search, ArrowUp, ArrowDown, ArrowUpDown, FileText } from "lucide-react";
import { useBrands, useCategories, useAllProductsAdmin, useCatalogStats, useInstallmentPlans } from "@/hooks/use-catalog";
import { brl } from "@/lib/format";
import { generateCatalogPdf } from "@/lib/catalog-pdf";

export const Route = createFileRoute("/_authenticated/admin/catalog")({
  head: () => ({ meta: [{ title: "Catálogo (admin) — Atacado" }] }),
  component: AdminCatalog,
});

function AdminCatalog() {
  const { data: stats } = useCatalogStats();

  return (
    <V2InternalShell title="Produtos" eyebrow="Estoque" description="Gerencie produtos, marcas e categorias.">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total" value={stats?.total ?? 0} icon={Package} tone="blue" />
        <StatCard label="Ativos" value={stats?.ativos ?? 0} icon={Package} tone="green" />
        <StatCard label="Baixo estoque" value={stats?.baixo ?? 0} icon={AlertTriangle} tone="orange" />
        <StatCard label="Sem estoque" value={stats?.sem ?? 0} icon={XCircle} tone="red" />
        <StatCard label="Marcas" value={stats?.marcas ?? 0} icon={Tag} tone="purple" />
        <StatCard label="Categorias" value={stats?.cats ?? 0} icon={FolderTree} tone="indigo" />
      </div>

      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="marcas">Marcas</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="parcelamento"><Percent className="w-3.5 h-3.5 mr-1" />Parcelamento</TabsTrigger>
        </TabsList>
        <TabsContent value="produtos" className="mt-4"><ProductsTab /></TabsContent>
        <TabsContent value="marcas" className="mt-4"><BrandsTab /></TabsContent>
        <TabsContent value="categorias" className="mt-4"><CategoriesTab /></TabsContent>
        <TabsContent value="parcelamento" className="mt-4"><InstallmentsTab /></TabsContent>
      </Tabs>
    </V2InternalShell>
  );
}



/* ============ PRODUCTS ============ */
function ProductsTab() {
  const { data: products = [], isLoading } = useAllProductsAdmin();
  const [pdfLoading, setPdfLoading] = useState(false);
  const { data: brands = [] } = useBrands();
  const { data: cats = [] } = useCategories();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"nome" | "sku" | "marca" | "preco_custo" | "preco_unitario" | "preco_pacote" | "estoque">("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products-admin"] });
      qc.invalidateQueries({ queryKey: ["catalog-stats"] });
      toast.success("Produto removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const norm = (s: unknown) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/-/g, "");


  const filteredSorted = useMemo(() => {
    const q = norm(query.trim());
    const base = q
      ? products.filter((p) => {
          const hay = [p.nome, p.sku, p.codigo_fabricante, p.modelo, p.brands?.nome, p.categories?.nome]
            .map(norm)
            .join(" ");
          return hay.includes(q);
        })
      : products;
    const getVal = (p: typeof products[number]) => {
      switch (sortKey) {
        case "sku": {
          const n = Number(String(p.sku ?? "").replace(/\D/g, ""));
          return Number.isFinite(n) ? n : 0;
        }
        case "marca": return norm(p.brands?.nome);
        case "preco_custo": return Number(p.preco_custo ?? 0);
        case "preco_unitario": return Number(p.preco_unitario ?? 0);
        case "preco_pacote": return Number(p.preco_pacote ?? 0);
        case "estoque": return Number(p.estoque ?? 0);
        case "nome":
        default: return norm(p.nome);
      }
    };
    const sorted = [...base].sort((a, b) => {
      const va = getVal(a); const vb = getVal(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [products, query, sortKey, sortDir]);

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };
  const SortIcon = ({ k }: { k: typeof sortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 inline ml-1 text-primary" />
      : <ArrowDown className="w-3 h-3 inline ml-1 text-primary" />;
  };
  const Th = ({ k, label, align = "left" }: { k: typeof sortKey; label: string; align?: "left" | "right" }) => (
    <th className={`px-4 py-2 ${align === "right" ? "text-right" : "text-left"} cursor-pointer select-none hover:text-foreground`} onClick={() => toggleSort(k)}>
      {label}<SortIcon k={k} />
    </th>
  );

  if (editing || creating) {
    return (
      <ProductForm
        id={editing}
        brands={brands}
        cats={cats}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nome, SKU, código, marca…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {query ? `${filteredSorted.length} de ${products.length}` : `${products.length}`} produto(s)
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={pdfLoading}
            onClick={async () => {
              setPdfLoading(true);
              try {
                const items = filteredSorted.map((p) => {
                  const imgs = (p.product_images ?? []) as { image_url: string; tipo_imagem: string; ordem: number }[];
                  const imagem =
                    imgs.find((i) => i.tipo_imagem === "principal")?.image_url ??
                    imgs[0]?.image_url ??
                    null;
                  return {
                    nome: p.nome,
                    sku: p.sku,
                    tipo: p.tipo,
                    categoria: p.categories?.nome ?? null,
                    marca: p.brands?.nome ?? null,
                    descricao_curta: p.descricao_curta ?? p.descricao_completa ?? null,
                    preco_unitario: p.preco_unitario,
                    preco_pacote: p.preco_pacote,
                    quantidade_pacote: p.quantidade_pacote ?? null,
                    imagem,
                  };
                });
                await generateCatalogPdf(items, { brandName: "Atacado Prime" });
              } catch {
                toast.error("Não foi possível gerar o catálogo em PDF.");
              } finally {
                setPdfLoading(false);
              }
            }}
          >
            <FileText className="w-4 h-4 mr-1" /> {pdfLoading ? "Gerando…" : "Catálogo PDF (com fotos)"}
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1" /> Novo produto</Button>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 w-14"></th>
              <Th k="nome" label="Nome" />
              <Th k="sku" label="SKU" />
              <Th k="marca" label="Marca" />
              <Th k="preco_custo" label="Preço custo" align="right" />
              <Th k="preco_unitario" label="Preço venda" align="right" />
              <Th k="preco_pacote" label="Preço pacote" align="right" />
              <Th k="estoque" label="Estoque" align="right" />
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="px-4 py-4 text-muted-foreground">Carregando…</td></tr>}
            {!isLoading && filteredSorted.length === 0 && <tr><td colSpan={9} className="px-4 py-4 text-muted-foreground">{query ? "Nenhum produto encontrado para a busca." : "Nenhum produto."}</td></tr>}
            {filteredSorted.map((p) => {
              const imgs = (p.product_images ?? []) as { image_url: string; tipo_imagem: string; ordem: number }[];
              const thumb = imgs.find((i) => i.tipo_imagem === "principal")?.image_url ?? imgs[0]?.image_url;
              return (
              <tr key={p.id} className="border-t border-border">
                <td className="px-2 py-2">
                  {thumb ? (
                    <img src={thumb} alt={p.nome} className="w-10 h-10 rounded object-cover border border-border" />
                  ) : (
                    <div className="w-10 h-10 rounded border border-dashed border-destructive/50 bg-destructive/5 grid place-items-center" title="Sem foto">
                      <XCircle className="w-4 h-4 text-destructive/70" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 font-medium">{p.nome}</td>
                <td className="px-4 py-2 text-muted-foreground">{p.sku}</td>
                <td className="px-4 py-2">{p.brands?.nome ?? "—"}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{p.preco_custo ? brl(p.preco_custo) : "—"}</td>
                <td className="px-4 py-2 text-right">{brl(p.preco_unitario)}</td>
                <td className="px-4 py-2 text-right">{p.preco_pacote ? brl(p.preco_pacote) : "—"}</td>
                <td className="px-4 py-2 text-right">{p.estoque}</td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(p.id)}><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${p.nome}?`)) del.mutate(p.id); }}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type BrandRow = { id: string; nome: string };
type CategoryRow = { id: string; nome: string; parent_id?: string | null };

function ProductForm({ id, brands, cats, onClose }: { id: string | null; brands: BrandRow[]; cats: CategoryRow[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nome: "", sku: "", codigo_fabricante: "", modelo: "",
    categoria_id: "", marca_id: "", tipo: "",
    descricao_curta: "", descricao_completa: "",
    frequencia: "", quantidade_botoes: 0,
    estoque: 0, estoque_minimo: 0, localizacao: "",
    preco_custo: 0, preco_unitario: 0, quantidade_pacote: 1, preco_pacote: 0,
    status: true,
  });
  const [loaded, setLoaded] = useState(!id);
  const [compats, setCompats] = useState<string[]>([]);
  const [novaCompat, setNovaCompat] = useState("");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [existingImages, setExistingImages] = useState<{ id: string; image_url: string; tipo_imagem: string }[]>([]);
  const [margemInput, setMargemInput] = useState<string>("");
  const [editingMargem, setEditingMargem] = useState(false);

  const margemCalculada = form.preco_custo > 0 && form.preco_unitario > 0
    ? (((form.preco_unitario - form.preco_custo) / form.preco_custo) * 100).toFixed(2).replace(".", ",")
    : "";

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("products").select("*, compatibilities(*), product_images(*)").eq("id", id).maybeSingle();
      if (data) {
        setForm({
          nome: data.nome, sku: data.sku, codigo_fabricante: data.codigo_fabricante ?? "", modelo: data.modelo ?? "",
          categoria_id: data.categoria_id ?? "", marca_id: data.marca_id ?? "", tipo: data.tipo ?? "",
          descricao_curta: data.descricao_curta ?? "", descricao_completa: data.descricao_completa ?? "",
          frequencia: data.frequencia ?? "", quantidade_botoes: data.quantidade_botoes ?? 0,
          estoque: data.estoque, estoque_minimo: data.estoque_minimo, localizacao: data.localizacao ?? "",
          preco_custo: Number((data as { preco_custo?: number }).preco_custo ?? 0),
          preco_unitario: Number(data.preco_unitario), quantidade_pacote: data.quantidade_pacote,
          preco_pacote: Number(data.preco_pacote ?? 0), status: data.status,
        });
        setCompats((data.compatibilities ?? []).map((c: { descricao: string }) => c.descricao));
        setExistingImages(data.product_images ?? []);
      }
      setLoaded(true);
    })();
  }, [id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        sku: form.sku?.trim() ? form.sku.trim() : null,
        categoria_id: form.categoria_id || null,
        marca_id: form.marca_id || null,
        tipo: (form.tipo || null) as Database["public"]["Enums"]["product_tipo"] | null,
        preco_custo: form.preco_custo || null,
        preco_pacote: form.preco_pacote || null,
      };
      let pid = id;
      if (id) {
        const { error } = await supabase.from("products").update(payload as never).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload as never).select("id").single();
        if (error) throw error;
        pid = data.id;
      }


      // sync compats: simplest — wipe and reinsert
      await supabase.from("compatibilities").delete().eq("product_id", pid!);
      if (compats.length > 0) {
        await supabase.from("compatibilities").insert(compats.map((d) => ({ product_id: pid!, descricao: d })));
      }
      // upload image
      if (imgFile && pid) {
        const path = `${pid}/${Date.now()}-${imgFile.name}`;
        const { error: upErr } = await supabase.storage.from("product-images").upload(path, imgFile, { upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        const url = signed?.signedUrl;
        if (url) {
          await supabase.from("product_images").insert({ product_id: pid, image_url: url, tipo_imagem: existingImages.length === 0 ? "principal" : "secundaria", ordem: existingImages.length });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products-admin"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["catalog-stats"] });
      toast.success("Produto salvo");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!loaded) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5 bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">{id ? "Editar produto" : "Novo produto"}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nome" required><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></Field>
        <Field label="SKU (auto se vazio)"><Input value={form.sku ?? ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Gerado automaticamente" /></Field>
        <Field label="Código Fabricante"><Input value={form.codigo_fabricante} onChange={(e) => setForm({ ...form, codigo_fabricante: e.target.value })} /></Field>
        <Field label="Modelo"><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} /></Field>
        <Field label="Categoria">
          <select className="h-9 px-2 rounded-md border border-border bg-background text-sm w-full" value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
            <option value="">—</option>
            {cats.filter((c) => !c.parent_id).flatMap((parent) => {
              const subs = cats.filter((c) => c.parent_id === parent.id);
              return [
                <option key={parent.id} value={parent.id}>{parent.nome}</option>,
                ...subs.map((s) => (
                  <option key={s.id} value={s.id}>{`\u00A0\u00A0\u00A0\u00A0${parent.nome} › ${s.nome}`}</option>
                )),
              ];
            })}
          </select>
        </Field>


        <Field label="Marca">
          <select className="h-9 px-2 rounded-md border border-border bg-background text-sm w-full" value={form.marca_id} onChange={(e) => setForm({ ...form, marca_id: e.target.value })}>
            <option value="">—</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select className="h-9 px-2 rounded-md border border-border bg-background text-sm w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="">—</option>
            {["controle","carcaca","alarme","modulo","transponder","lamina","bateria","acessorio"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Frequência"><Input value={form.frequencia} onChange={(e) => setForm({ ...form, frequencia: e.target.value })} placeholder="433MHz" /></Field>
        <Field label="Qtd Botões"><Input type="number" value={form.quantidade_botoes} onChange={(e) => setForm({ ...form, quantidade_botoes: Number(e.target.value) })} /></Field>
        <Field label="Localização"><Input value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} placeholder="Prateleira A3" /></Field>
        <Field label="Estoque"><Input type="number" value={form.estoque} onChange={(e) => setForm({ ...form, estoque: Number(e.target.value) })} /></Field>
        <Field label="Estoque mínimo"><Input type="number" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })} /></Field>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Precificação</p>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Preço de custo (compra)">
            <Input type="number" step="0.01" value={form.preco_custo} onChange={(e) => setForm({ ...form, preco_custo: Number(e.target.value) })} />
          </Field>
          <Field label="Margem de lucro (%)">
            <Input
              type="text"
              inputMode="decimal"
              value={editingMargem ? margemInput : margemCalculada}
              onFocus={() => {
                setEditingMargem(true);
                setMargemInput(margemCalculada);
              }}
              onChange={(e) => {
                const raw = e.target.value.replace(/%/g, "");
                setMargemInput(raw);
                const num = Number(raw.replace(",", "."));
                if (raw.trim() === "" || Number.isNaN(num)) return;
                if (form.preco_custo > 0) {
                  const venda = form.preco_custo * (1 + num / 100);
                  setForm((f) => ({ ...f, preco_unitario: Number(venda.toFixed(2)) }));
                }
              }}
              onBlur={() => {
                setEditingMargem(false);
                setMargemInput("");
              }}
              disabled={form.preco_custo <= 0}
              placeholder={form.preco_custo <= 0 ? "Informe o custo" : "Ex.: 70"}
            />
          </Field>


          <Field label="Preço de venda (unitário)">
            <Input type="number" step="0.01" value={form.preco_unitario} onChange={(e) => setForm({ ...form, preco_unitario: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Qtd no pacote">
            <Input
              type="number"
              value={form.quantidade_pacote}
              onChange={(e) => {
                const qtd = Number(e.target.value);
                const bruto = form.preco_unitario * qtd;
                const desc = bruto > 0 && form.preco_pacote > 0 ? (1 - form.preco_pacote / bruto) * 100 : 0;
                setForm({ ...form, quantidade_pacote: qtd, preco_pacote: bruto * (1 - desc / 100) });
              }}
            />
          </Field>
          <Field label="Desconto no pacote (%)">
            <Input
              type="number"
              step="0.01"
              value={
                form.preco_unitario > 0 && form.quantidade_pacote > 0 && form.preco_pacote > 0
                  ? Number((((form.preco_unitario * form.quantidade_pacote - form.preco_pacote) / (form.preco_unitario * form.quantidade_pacote)) * 100).toFixed(2))
                  : 0
              }
              onChange={(e) => {
                const desc = Number(e.target.value);
                const bruto = form.preco_unitario * form.quantidade_pacote;
                setForm({ ...form, preco_pacote: Number((bruto * (1 - desc / 100)).toFixed(2)) });
              }}
            />
          </Field>
          <Field label="Preço do pacote">
            <Input
              type="number"
              step="0.01"
              value={form.preco_pacote}
              onChange={(e) => setForm({ ...form, preco_pacote: Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>



      <Field label="Descrição curta"><Input value={form.descricao_curta} onChange={(e) => setForm({ ...form, descricao_curta: e.target.value })} /></Field>
      <Field label="Descrição completa">
        <textarea className="min-h-24 w-full rounded-md border border-border bg-background p-2 text-sm" value={form.descricao_completa} onChange={(e) => setForm({ ...form, descricao_completa: e.target.value })} />
      </Field>

      <div>
        <Label>Compatibilidades</Label>
        <div className="flex gap-2 mt-1">
          <Input value={novaCompat} onChange={(e) => setNovaCompat(e.target.value)} placeholder="Ex.: Positron PX80" />
          <Button type="button" variant="outline" onClick={() => { if (novaCompat.trim()) { setCompats([...compats, novaCompat.trim()]); setNovaCompat(""); } }}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {compats.map((c, i) => (
            <span key={i} className="text-xs px-2 py-1 rounded-md bg-muted border border-border inline-flex items-center gap-1">
              {c}
              <button type="button" onClick={() => setCompats(compats.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <Label>Adicionar imagem</Label>
        <Input type="file" accept="image/*" onChange={(e) => setImgFile(e.target.files?.[0] ?? null)} className="mt-1" />
        {existingImages.length > 0 && (
          <div className="grid grid-cols-6 gap-2 mt-3">
            {existingImages.map((img) => (
              <div key={img.id} className="relative group aspect-square bg-muted rounded-md overflow-hidden border border-border">
                <img src={img.image_url} alt={img.tipo_imagem} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Excluir esta imagem?")) return;
                    const { error } = await supabase.from("product_images").delete().eq("id", img.id);
                    if (error) { toast.error("Erro ao excluir imagem"); return; }
                    try {
                      const u = new URL(img.image_url);
                      const idx = u.pathname.indexOf("/product-images/");
                      if (idx >= 0) {
                        const key = decodeURIComponent(u.pathname.slice(idx + "/product-images/".length).split("?")[0]);
                        await supabase.storage.from("product-images").remove([key]);
                      }
                    } catch { /* noop */ }
                    setExistingImages((prev) => prev.filter((x) => x.id !== img.id));
                    toast.success("Imagem excluída");
                  }}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground text-xs grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  aria-label="Excluir imagem"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.status} onChange={(e) => setForm({ ...form, status: e.target.checked })} /> Ativo
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar"}</Button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}

/* ============ BRANDS ============ */
function BrandsTab() {
  const { data: brands = [], isLoading } = useBrands();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("brands").insert({ nome: nome.trim() });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brands"] }); setNome(""); toast.success("Marca criada"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brands"] }); toast.success("Removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); if (nome.trim()) add.mutate(); }} className="flex gap-2">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nova marca" />
        <Button type="submit"><Plus className="w-4 h-4" /></Button>
      </form>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {brands.map((b) => (
            <div key={b.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
              <span className="font-medium text-sm">{b.nome}</span>
              <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${b.nome}?`)) del.mutate(b.id); }}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ CATEGORIES ============ */
function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
async function uniqueCategorySlug(nome: string, ignoreId?: string): Promise<string> {
  const base = slugify(nome) || "categoria";
  let q = supabase.from("categories").select("slug").like("slug", `${base}%`);
  if (ignoreId) q = q.neq("id", ignoreId);
  const { data } = await q;
  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
function CategoriesTab() {
  const { data: cats = [], isLoading } = useCategories();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [parent, setParent] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const slug = await uniqueCategorySlug(nome);
      const { error } = await supabase.from("categories").insert({ nome: nome.trim(), slug, parent_id: parent || null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); setNome(""); setParent(""); toast.success("Categoria criada"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); if (nome.trim()) add.mutate(); }} className="flex flex-wrap gap-2">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nova categoria" className="flex-1 min-w-48" />
        <select className="h-9 px-2 rounded-md border border-border bg-background text-sm" value={parent} onChange={(e) => setParent(e.target.value)}>
          <option value="">Sem categoria pai</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <Button type="submit"><Plus className="w-4 h-4" /></Button>
      </form>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 w-1/3">Menu</th>
                <th className="text-left px-4 py-2">Submenu</th>
                <th className="px-4 py-2 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {cats.filter((c) => !c.parent_id).flatMap((parent) => {
                const subs = cats.filter((c) => c.parent_id === parent.id);
                const rows = [
                  <tr key={parent.id} className="border-t border-border bg-muted/20">
                    <td className="px-4 py-2 font-semibold">{parent.nome}</td>
                    <td className="px-4 py-2 text-muted-foreground italic">—</td>
                    <td className="px-4 py-2"><CategoryRowActions cat={parent} allCats={cats} onDelete={() => { if (confirm(`Remover ${parent.nome}?`)) del.mutate(parent.id); }} /></td>
                  </tr>,
                  ...subs.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-2 text-muted-foreground pl-8">↳ {parent.nome}</td>
                      <td className="px-4 py-2">{s.nome}</td>
                      <td className="px-4 py-2"><CategoryRowActions cat={s} allCats={cats} onDelete={() => { if (confirm(`Remover ${s.nome}?`)) del.mutate(s.id); }} /></td>
                    </tr>
                  )),
                ];
                return rows;
              })}
              {cats.filter((c) => c.parent_id && !cats.some((p) => p.id === c.parent_id)).map((orphan) => (
                <tr key={orphan.id} className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground italic">(órfã)</td>
                  <td className="px-4 py-2">{orphan.nome}</td>
                  <td className="px-4 py-2"><CategoryRowActions cat={orphan} allCats={cats} onDelete={() => { if (confirm(`Remover ${orphan.nome}?`)) del.mutate(orphan.id); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CategoryRowActions({ cat, allCats, onDelete }: { cat: { id: string; nome: string; parent_id: string | null; image_url?: string | null }; allCats: { id: string; nome: string; parent_id: string | null }[]; onDelete: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState(cat.nome);
  const [parentId, setParentId] = useState<string>(cat.parent_id ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function saveEdit() {
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const slug = await uniqueCategorySlug(nome, cat.id);
    const { error } = await supabase.from("categories").update({ nome: nome.trim(), slug, parent_id: parentId || null }).eq("id", cat.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["categories"] });
    setEditing(false);
    toast.success("Atualizada");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${cat.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("category-images").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from("category-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr) throw signErr;
      const { error: dbErr } = await supabase.from("categories").update({ image_url: signed.signedUrl }).eq("id", cat.id);
      if (dbErr) throw dbErr;
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Imagem atualizada");
    } catch (err) { toast.error((err as Error).message); }
    finally { setUploading(false); e.target.value = ""; }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-7 text-xs" />
        <select className="h-7 px-2 rounded-md border border-border bg-background text-xs" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">Sem pai</option>
          {allCats.filter((o) => o.id !== cat.id).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <div className="flex gap-1">
          <Button size="sm" className="h-6 text-[11px] px-2" onClick={saveEdit} disabled={saving}>{saving ? "…" : "OK"}</Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={() => { setEditing(false); setNome(cat.nome); setParentId(cat.parent_id ?? ""); }}>X</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 justify-end">
      <button onClick={() => setEditing(true)} className="text-[11px] text-primary hover:underline px-1">Editar</button>
      <label className="text-[11px] text-primary hover:underline cursor-pointer px-1">
        {uploading ? "…" : cat.image_url ? "Trocar" : "Foto"}
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
    </div>
  );
}



function CategoryCard({ cat, allCats, onDelete }: { cat: { id: string; nome: string; parent_id: string | null; image_url?: string | null }; allCats: { id: string; nome: string; parent_id: string | null }[]; onDelete: () => void }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState(cat.nome);
  const [parentId, setParentId] = useState<string>(cat.parent_id ?? "");
  const [saving, setSaving] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${cat.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("category-images").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from("category-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr) throw signErr;
      const { error: dbErr } = await supabase.from("categories").update({ image_url: signed.signedUrl }).eq("id", cat.id);
      if (dbErr) throw dbErr;
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Imagem atualizada");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function removeImage() {
    const { error } = await supabase.from("categories").update({ image_url: null }).eq("id", cat.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["categories"] });
    toast.success("Imagem removida");
  }

  async function saveEdit() {
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const slug = await uniqueCategorySlug(nome, cat.id);
    const { error } = await supabase.from("categories").update({ nome: nome.trim(), slug, parent_id: parentId || null }).eq("id", cat.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["categories"] });
    setEditing(false);
    toast.success("Categoria atualizada");
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
      <div className="w-14 h-14 rounded-md bg-muted overflow-hidden grid place-items-center shrink-0">
        {cat.image_url ? (
          <img src={cat.image_url} alt={cat.nome} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-1.5">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-8 text-sm" />
            <select className="h-8 px-2 rounded-md border border-border bg-background text-xs w-full" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Sem categoria pai</option>
              {allCats.filter((o) => o.id !== cat.id).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditing(false); setNome(cat.nome); setParentId(cat.parent_id ?? ""); }}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="font-medium text-sm truncate">{cat.nome}</p>
            {cat.parent_id && <p className="text-[10px] text-muted-foreground">subcategoria</p>}
            <div className="flex gap-2 mt-1 flex-wrap">
              <button onClick={() => setEditing(true)} className="text-[11px] text-primary hover:underline">Editar</button>
              <label className="text-[11px] text-primary hover:underline cursor-pointer inline-flex items-center gap-1">
                <Upload className="w-3 h-3" />
                {uploading ? "Enviando…" : cat.image_url ? "Trocar" : "Enviar foto"}
                <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
              </label>
              {cat.image_url && (
                <button onClick={removeImage} className="text-[11px] text-muted-foreground hover:text-destructive">Remover foto</button>
              )}
            </div>
          </>
        )}
      </div>
      {!editing && <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
    </div>
  );
}


/* ============ INSTALLMENTS ============ */
function InstallmentsTab() {
  const { data: plans = [], isLoading } = useInstallmentPlans();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { multiplicador: number; ativo: boolean }>>({});

  const save = useMutation({
    mutationFn: async (row: { id: string; multiplicador: number; ativo: boolean }) => {
      const { error } = await supabase.from("installment_plans").update({ multiplicador: row.multiplicador, ativo: row.ativo }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["installment-plans"] }); toast.success("Atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const upsertN = useMutation({
    mutationFn: async (parcelas: number) => {
      const { error } = await supabase.from("installment_plans").insert({ parcelas, multiplicador: 1 });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["installment-plans"] }); toast.success("Plano criado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const missing = [1,2,3,4,5,6,7,8,9,10,11,12].filter((n) => !plans.some((p) => p.parcelas === n));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configure o multiplicador aplicado ao preço para cada quantidade de parcelas. Ex.: 1.05 = +5%. O cliente vê <strong>"Nx de R$ Y"</strong> na vitrine.</p>
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">Adicionar:</span>
          {missing.map((n) => (
            <Button key={n} size="sm" variant="outline" onClick={() => upsertN.mutate(n)}><Plus className="w-3 h-3 mr-1" />{n}x</Button>
          ))}
        </div>
      )}
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Parcelas</th><th className="text-left px-4 py-2">Multiplicador</th><th className="text-left px-4 py-2">Ativo</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const e = edits[p.id] ?? { multiplicador: Number(p.multiplicador), ativo: p.ativo };
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-2 font-semibold">{p.parcelas}x</td>
                    <td className="px-4 py-2">
                      <Input type="number" step="0.0001" value={e.multiplicador}
                        onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, multiplicador: Number(ev.target.value) } })}
                        className="h-8 w-32" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={e.ativo} onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, ativo: ev.target.checked } })} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" onClick={() => save.mutate({ id: p.id, ...e })}>Salvar</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
