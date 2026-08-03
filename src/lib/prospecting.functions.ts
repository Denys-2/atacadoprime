import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GMAPS_GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const CHAVEIROS_NET_BASE = "https://www.chaveiros.net";

export type ProspectMatch = "new" | "lead" | "client";

export type ProspectResult = {
  source: "google_maps" | "chaveiros_net";
  external_id: string;
  empresa: string;
  contato: string | null;
  telefone: string | null;
  whatsapp: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  website: string | null;
  url: string | null;
  match?: ProspectMatch;
  existing_id?: string | null;
};

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function onlyDigits(s: string | null | undefined) {
  return (s ?? "").replace(/\D/g, "");
}

function stripHtml(s: string) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteChaveirosNetUrl(href: string) {
  if (href.startsWith("http")) return href;
  return `${CHAVEIROS_NET_BASE}${href.startsWith("/") ? href : `/${href}`}`;
}

async function fetchChaveirosNetHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; AtacadoPrimeProspector/1.0)",
    },
  });
  if (!res.ok) throw new Error(`Chaveiros.net retornou HTTP ${res.status}`);
  return res.text();
}

async function findChaveirosNetCityUrl(cidade: string, estado: string) {
  const uf = estado.toLowerCase();
  const cidadeSlug = slugify(cidade);
  const ufHtml = await fetchChaveirosNetHtml(`${CHAVEIROS_NET_BASE}/uf/${uf}`);
  const cityLinkRegex = /<a\b[^>]*href=["']([^"']*(?:\/)?cidade\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = cityLinkRegex.exec(ufHtml))) {
    const href = absoluteChaveirosNetUrl(match[1]);
    const labelSlug = slugify(stripHtml(match[2]));
    if (href.includes(`/cidade/chaveiro-em-${cidadeSlug}-${uf}`) || labelSlug === `chaveiros-em-${cidadeSlug}`) {
      return href;
    }
  }

  return `${CHAVEIROS_NET_BASE}/cidade/chaveiro-em-${cidadeSlug}-${uf}`;
}

function parseChaveirosNetHtml(html: string, pageUrl: string, cidade: string, estado: string): ProspectResult[] {
  const blocks = html.split(/<div class=["']divlistaempresas["'][^>]*>/i).slice(1);
  const parsed: ProspectResult[] = [];

  blocks.forEach((block, index) => {
    const nameMatch = block.match(/<h3>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i);
    if (!nameMatch) return;

    const empresa = stripHtml(nameMatch[2]);
    if (!empresa) return;

    const phoneMatch = block.match(/href=["']tel:([^"']+)["'][^>]*>\s*([^<]+)\s*<\/a>/i) ?? block.match(/<div[^>]*class=["'][^"']*estabfone[^"']*["'][^>]*>[\s\S]*?<p[^>]*>\s*([^<]+)\s*<\/p>/i);
    const phone = phoneMatch ? (phoneMatch[2] ?? phoneMatch[1]).trim() : null;
    const addressMatch = block.match(/<span class=["']endereco["']>([\s\S]*?)<\/span>/i);
    const websiteMatch = block.match(/<a\b[^>]*title=["']acessar site["'][^>]*href=["']([^"']+)["']/i);
    const ratingMatch = block.match(/title=["']Nota\s*([\d.,]+)/i);
    const profileUrl = nameMatch[1] ? absoluteChaveirosNetUrl(nameMatch[1]) : pageUrl;

    parsed.push({
      source: "chaveiros_net",
      external_id: `${slugify(empresa)}-${onlyDigits(phone) || index}`,
      empresa,
      contato: null,
      telefone: phone,
      whatsapp: phone,
      endereco: addressMatch ? stripHtml(addressMatch[1]).replace(/Endereço copiado!?/gi, "").trim() : null,
      cidade,
      estado: estado.toUpperCase(),
      latitude: null,
      longitude: null,
      rating: ratingMatch ? Number(ratingMatch[1].replace(",", ".")) : null,
      website: websiteMatch ? websiteMatch[1] : null,
      url: profileUrl,
    });
  });

  return parsed;
}

function extractChaveirosNetPaginationUrls(html: string, cityUrl: string) {
  const urls = new Set<string>();
  const paginationRegex = /href=["']([^"']*\/cidade\/[^"']*\/pagina\d+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = paginationRegex.exec(html))) {
    const url = absoluteChaveirosNetUrl(match[1]);
    if (url.startsWith(cityUrl)) urls.add(url);
  }

  return Array.from(urls);
}

async function searchGoogleMaps(cidade: string, estado: string): Promise<ProspectResult[]> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !gmapsKey) return [];

  // Várias queries para ampliar cobertura (Places retorna até 20 por página, máx 60 com paginação)
  const queries = [
    `chaveiros em ${cidade}, ${estado}, Brasil`,
    `chaveiro 24 horas em ${cidade}, ${estado}`,
    `chaveiro automotivo em ${cidade}, ${estado}`,
    `chaveiro residencial em ${cidade}, ${estado}`,
  ];

  const all: ProspectResult[] = [];

  for (const textQuery of queries) {
    let pageToken: string | undefined = undefined;
    for (let page = 0; page < 3; page++) {
      const body: any = { textQuery, languageCode: "pt-BR", regionCode: "BR", pageSize: 20 };
      if (pageToken) body.pageToken = pageToken;
      const res = await fetch(`${GMAPS_GATEWAY}/places/v1/places:searchText`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": gmapsKey,
          "Content-Type": "application/json",
          "X-Goog-FieldMask":
            "nextPageToken,places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.googleMapsUri",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) break;
      const json: any = await res.json();
      const places: any[] = json?.places ?? [];
      for (const p of places) {
        const phone = p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null;
        all.push({
          source: "google_maps",
          external_id: p.id,
          empresa: p.displayName?.text ?? "Sem nome",
          contato: null,
          telefone: phone,
          whatsapp: phone,
          endereco: p.formattedAddress ?? null,
          cidade,
          estado: estado.toUpperCase(),
          latitude: p.location?.latitude ?? null,
          longitude: p.location?.longitude ?? null,
          rating: p.rating ?? null,
          website: p.websiteUri ?? null,
          url: p.googleMapsUri ?? null,
        });
      }
      pageToken = json?.nextPageToken;
      if (!pageToken) break;
      // Google exige pequena espera antes de consumir o nextPageToken
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return all;
}

async function searchChaveirosNet(cidade: string, estado: string): Promise<ProspectResult[]> {
  const cidadeSlug = slugify(cidade);
  const directResults: ProspectResult[] = [];

  try {
    const cityUrl = await findChaveirosNetCityUrl(cidade, estado);
    const queue = [cityUrl];
    const visited = new Set<string>();

    while (queue.length && visited.size < 12) {
      const pageUrl = queue.shift();
      if (!pageUrl || visited.has(pageUrl)) continue;
      visited.add(pageUrl);

      const html = await fetchChaveirosNetHtml(pageUrl);
      directResults.push(...parseChaveirosNetHtml(html, pageUrl, cidade, estado));

      for (const nextUrl of extractChaveirosNetPaginationUrls(html, cityUrl)) {
        if (!visited.has(nextUrl) && !queue.includes(nextUrl)) queue.push(nextUrl);
      }
    }

    if (directResults.length) return dedupe(directResults);
  } catch (e) {
    console.error("chaveiros.net direct scrape failed", e);
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return [];

  const schema = {
    type: "object",
    properties: {
      chaveiros: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nome: { type: "string" },
            telefone: { type: "string" },
            whatsapp: { type: "string" },
            endereco: { type: "string" },
          },
          required: ["nome"],
        },
      },
    },
    required: ["chaveiros"],
  };

  try {
    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const fc = new Firecrawl({ apiKey });

    const collected: any[] = [];
    let usedUrl: string | null = null;

    for (const url of [`${CHAVEIROS_NET_BASE}/uf/${estado.toLowerCase()}`, `${CHAVEIROS_NET_BASE}/cidade/chaveiro-em-${cidadeSlug}-${estado.toLowerCase()}`]) {
      try {
        const result: any = await fc.scrape(url, {
          formats: [{ type: "json", schema, prompt: "Extraia TODOS os chaveiros listados na página, com nome (obrigatório), telefone, whatsapp e endereço completo. Se houver paginação, extraia apenas desta página." } as any],
          onlyMainContent: true,
        });
        const items: any[] = result?.json?.chaveiros ?? result?.data?.json?.chaveiros ?? [];
        if (items.length) {
          collected.push(...items);
          usedUrl = url;
          break;
        }
      } catch {
        // tenta próxima URL
      }
    }

    // Fallback: Firecrawl search restrito a chaveiros.net
    if (!collected.length) {
      try {
        const search: any = await fc.search(`chaveiros ${cidade} ${estado} site:chaveiros.net`, {
          limit: 20,
          scrapeOptions: { formats: [{ type: "json", schema, prompt: "Liste todos os chaveiros (nome, telefone, whatsapp, endereço) presentes na página." } as any] as any },
        } as any);
        const webResults: any[] = search?.web ?? search?.data ?? [];
        for (const w of webResults) {
          const items: any[] = w?.json?.chaveiros ?? [];
          if (items.length) {
            collected.push(...items);
            usedUrl = usedUrl ?? w?.url ?? null;
          }
        }
      } catch (e) {
        console.error("chaveiros.net search fallback failed", e);
      }
    }

    return collected.map((it, i) => {
      const phone = it.telefone ?? it.whatsapp ?? null;
      return {
        source: "chaveiros_net" as const,
        external_id: `${cidadeSlug}-${i}-${onlyDigits(phone) || slugify(it.nome ?? "")}`,
        empresa: it.nome ?? "Sem nome",
        contato: null,
        telefone: phone,
        whatsapp: it.whatsapp ?? phone,
        endereco: it.endereco ?? null,
        cidade,
        estado: estado.toUpperCase(),
        latitude: null,
        longitude: null,
        rating: null,
        website: null,
        url: usedUrl,
      } satisfies ProspectResult;
    });
  } catch (e) {
    console.error("chaveiros.net scrape failed", e);
    return [];
  }
}

function dedupe(results: ProspectResult[]): ProspectResult[] {
  const seen = new Map<string, ProspectResult>();
  for (const r of results) {
    const phoneKey = onlyDigits(r.telefone);
    const key = phoneKey || `${slugify(r.empresa)}|${slugify(r.cidade ?? "")}`;
    const prev = seen.get(key);
    // Prefer google_maps (has coords) over chaveiros_net duplicates
    if (!prev || (prev.source === "chaveiros_net" && r.source === "google_maps")) {
      seen.set(key, r);
    }
  }
  return Array.from(seen.values());
}

export const prospectSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cidade: string; estado: string; sources?: ("google_maps" | "chaveiros_net")[] }) => {
    if (!input?.cidade?.trim()) throw new Error("Cidade obrigatória");
    if (!input?.estado?.trim() || input.estado.length !== 2) throw new Error("Estado (UF) obrigatório, 2 letras");
    return {
      cidade: input.cidade.trim().slice(0, 100),
      estado: input.estado.trim().toUpperCase().slice(0, 2),
      sources: input.sources?.length ? input.sources : ["google_maps", "chaveiros_net"],
    };
  })
  .handler(async ({ data, context }) => {
    const tasks: Promise<ProspectResult[]>[] = [];
    if (data.sources.includes("google_maps")) tasks.push(searchGoogleMaps(data.cidade, data.estado));
    if (data.sources.includes("chaveiros_net")) tasks.push(searchChaveirosNet(data.cidade, data.estado));
    const all = (await Promise.all(tasks)).flat();
    const results = dedupe(all);

    // Enrich with match status against existing leads/companies
    const [leadsRes, compsRes] = await Promise.all([
      context.supabase
        .from("leads")
        .select("id,empresa,telefone,whatsapp,cidade")
        .ilike("cidade", `%${data.cidade}%`),
      context.supabase
        .from("companies")
        .select("id,legal_name,trade_name,phone,cidade")
        .ilike("cidade", `%${data.cidade}%`),
    ]);
    const leadByPhone = new Map<string, string>();
    const leadByName = new Map<string, string>();
    (leadsRes.data ?? []).forEach((l: any) => {
      const p = onlyDigits(l.telefone) || onlyDigits(l.whatsapp);
      if (p) leadByPhone.set(p, l.id);
      leadByName.set(`${slugify(l.empresa ?? "")}|${slugify(l.cidade ?? "")}`, l.id);
    });
    const compByPhone = new Map<string, string>();
    const compByName = new Map<string, string>();
    (compsRes.data ?? []).forEach((c: any) => {
      const p = onlyDigits(c.phone);
      if (p) compByPhone.set(p, c.id);
      compByName.set(`${slugify(c.trade_name ?? c.legal_name ?? "")}|${slugify(c.cidade ?? "")}`, c.id);
    });

    const enriched: ProspectResult[] = results.map((r) => {
      const phone = onlyDigits(r.telefone) || onlyDigits(r.whatsapp);
      const nameKey = `${slugify(r.empresa)}|${slugify(r.cidade ?? "")}`;
      const compId = (phone && compByPhone.get(phone)) || compByName.get(nameKey);
      if (compId) return { ...r, match: "client", existing_id: compId };
      const leadId = (phone && leadByPhone.get(phone)) || leadByName.get(nameKey);
      if (leadId) return { ...r, match: "lead", existing_id: leadId };
      return { ...r, match: "new", existing_id: null };
    });

    return { results: enriched };
  });

export const importProspectAsLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prospect: ProspectResult }) => {
    if (!input?.prospect?.empresa) throw new Error("Prospect inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const p = data.prospect;
    const observacoes = [
      `Origem: ${p.source === "google_maps" ? "Google Maps" : "Chaveiros.net"}`,
      p.endereco ? `Endereço: ${p.endereco}` : null,
      p.website ? `Site: ${p.website}` : null,
      p.url ? `URL: ${p.url}` : null,
      p.rating != null ? `Rating: ${p.rating}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { data: row, error } = await context.supabase
      .from("leads")
      .insert({
        empresa: p.empresa,
        contato: p.contato ?? p.empresa,
        telefone: p.telefone,
        whatsapp: p.whatsapp,
        cidade: p.cidade,
        estado: p.estado,
        latitude: p.latitude,
        longitude: p.longitude,
        segmento: "CHAVEIRO",
        status: "NOVO_LEAD",
        score: 0,
        position: 0,
        observacoes,
        created_by: context.userId,
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });
