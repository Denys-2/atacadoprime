import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Navigation, MapPin, Loader2, Route as RouteIcon } from "lucide-react";
import { V2 } from "@/components/v2/theme";
import type { Lead } from "@/hooks/use-crm";
import { toast } from "sonner";

type Props = {
  leads: Lead[];
  cidade?: string;
};

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function nearestNeighbor(start: { lat: number; lng: number }, stops: Array<Lead & { _d: number; _lat: number; _lng: number }>) {
  const remaining = [...stops];
  const ordered: typeof stops = [];
  let cur = start;
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(cur, { lat: remaining[i]._lat, lng: remaining[i]._lng });
      if (d < bestD) { bestD = d; best = i; }
    }
    cur = { lat: remaining[best]._lat, lng: remaining[best]._lng };
    ordered.push(remaining.splice(best, 1)[0]);
  }
  return ordered;
}

export function NearMeRouteDialog({ leads, cidade }: Props) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [userTouched, setUserTouched] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(true);
  const [radiusKm, setRadiusKm] = useState(30);
  const [navIndex, setNavIndex] = useState(0);

  useEffect(() => {
    if (!open || origin) return;
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada neste dispositivo");
      return;
    }
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }); setLoadingGeo(false); },
      (err) => { setLoadingGeo(false); toast.error("Não foi possível obter sua localização: " + err.message); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [open, origin]);

  const scoped = useMemo(
    () => (cidade && cidade !== "__all__" ? leads.filter((l) => l.cidade === cidade) : leads),
    [leads, cidade],
  );

  const withCoords = useMemo(
    () => scoped
      .filter((l) => l.latitude != null && l.longitude != null)
      .map((l) => ({ ...l, _lat: Number(l.latitude), _lng: Number(l.longitude) })),
    [scoped],
  );
  const missingCoords = scoped.length - withCoords.length;

  const sorted = useMemo(() => {
    if (!origin) return [];
    const all = withCoords
      .map((l) => ({ ...l, _d: haversine(origin, { lat: l._lat, lng: l._lng }) }))
      .sort((a, b) => a._d - b._d);
    return nearbyOnly ? all.filter((l) => l._d <= radiusKm) : all;
  }, [withCoords, origin, nearbyOnly, radiusKm]);
  const filteredOutByRadius = nearbyOnly && origin
    ? withCoords.length - sorted.length
    : 0;

  useEffect(() => {
    if (open && origin && !userTouched && sorted.length > 0) {
      setSelected(new Set(sorted.slice(0, Math.min(10, sorted.length)).map((l) => l.id)));
    }
  }, [open, origin, sorted, userTouched]);

  useEffect(() => {
    setNavIndex(0);
  }, [selected]);

  const chosen = sorted.filter((l) => selected.has(l.id));

  const orderedRoute = useMemo(() => {
    if (!origin || chosen.length === 0) return [];
    return nearestNeighbor(origin, chosen);
  }, [origin, chosen]);

  function toggle(id: string) {
    setUserTouched(true);
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function selectAll() {
    setUserTouched(true);
    setSelected(new Set(sorted.map((l) => l.id)));
  }

  function deselectAll() {
    setUserTouched(true);
    setSelected(new Set());
  }

  function openInMaps() {
    if (!origin || orderedRoute.length === 0) return;
    const limited = orderedRoute.slice(0, 10); // Google Maps aceita até ~10 pontos
    const destination = limited[limited.length - 1];
    const waypoints = limited.slice(0, -1);
    const params = new URLSearchParams({
      api: "1",
      travelmode: "driving",
      dir_action: "navigate",
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination._lat},${destination._lng}`,
    });
    if (waypoints.length) params.set("waypoints", waypoints.map((w) => `${w._lat},${w._lng}`).join("|"));
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank");
    if (orderedRoute.length > 10) {
      toast.info(`Rota aberta com os 10 primeiros. Faltam ${orderedRoute.length - 10} paradas — refaça depois.`);
    }
  }

  function openWaze(l: (typeof sorted)[number]) {
    window.open(`https://waze.com/ul?ll=${l._lat},${l._lng}&navigate=yes`, "_blank");
  }

  function openRouteWaze() {
    if (!origin || orderedRoute.length === 0) return;
    const first = orderedRoute[0];
    window.open(`https://waze.com/ul?ll=${first._lat},${first._lng}&navigate=yes`, "_blank");
    if (orderedRoute.length > 1) {
      toast.info(`Waze só aceita 1 destino por vez. Iniciando pelo mais próximo (${first.empresa}). Ao chegar, volte aqui e abra o próximo.`);
    }
  }

  function openMapsOne(l: (typeof sorted)[number]) {
    if (origin) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&origin=${origin.lat},${origin.lng}&destination=${l._lat},${l._lng}`,
        "_blank",
      );
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${l._lat},${l._lng}`, "_blank");
    }
  }

  function openPoint(index: number) {
    if (!origin || orderedRoute.length === 0) return;
    const target = orderedRoute[index];
    if (!target) return;
    setNavIndex(index);
    window.open(
      `https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&origin=${origin.lat},${origin.lng}&destination=${target._lat},${target._lng}`,
      "_blank",
    );
  }

  function startPointByPoint() {
    openPoint(0);
  }

  function nextPoint() {
    openPoint(navIndex + 1);
  }


  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelected(new Set()); setUserTouched(false); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" style={{ borderColor: V2.LIGHT_BORDER }}>
          <Navigation className="w-4 h-4 mr-1" /> Rota perto de mim
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RouteIcon className="w-4 h-4" /> Clientes mais próximos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-xs" style={{ color: V2.LIGHT_MUTED }}>
            {cidade && cidade !== "__all__" ? <>Filtrando na cidade <b>{cidade}</b>. </> : <>Todas as cidades. </>}
            Selecione os clientes; a ordem será otimizada do mais perto ao mais longe.
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-md border p-2" style={{ borderColor: V2.LIGHT_BORDER }}>
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: V2.LIGHT_TEXT }}>
              <Checkbox
                checked={nearbyOnly}
                onCheckedChange={(v) => { setNearbyOnly(!!v); setSelected(new Set()); }}
              />
              Somente clientes próximos (mesma região)
            </label>
            {nearbyOnly && (
              <div className="flex items-center gap-1 ml-auto text-xs" style={{ color: V2.LIGHT_MUTED }}>
                Raio:
                {[10, 30, 50, 100].map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={radiusKm === r ? "default" : "outline"}
                    className="h-6 px-2 text-[11px]"
                    onClick={() => { setRadiusKm(r); setSelected(new Set()); }}
                    style={radiusKm === r ? { background: V2.TEAL, color: "#fff" } : { borderColor: V2.LIGHT_BORDER }}
                  >
                    {r} km
                  </Button>
                ))}
              </div>
            )}
          </div>

          {loadingGeo && (
            <div className="flex items-center gap-2 text-sm" style={{ color: V2.LIGHT_MUTED }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Obtendo sua localização...
            </div>
          )}

          {!loadingGeo && !origin && (
            <Button size="sm" variant="outline" onClick={() => { setOrigin(null); setOpen(false); setTimeout(() => setOpen(true), 50); }}>
              Tentar novamente
            </Button>
          )}

          {origin && sorted.length === 0 && (
            <div className="text-sm p-4 rounded-md border" style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}>
              Nenhum lead com coordenadas nesta seleção. Use o mapa em <b>Prospecção</b> ou geocode os endereços para habilitar a rota.
            </div>
          )}

          {origin && sorted.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs" style={{ color: V2.LIGHT_MUTED }}>
                  {sorted.length} cliente(s) próximo(s)
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    onClick={selectAll}
                    style={{ borderColor: V2.LIGHT_BORDER }}
                  >
                    Marcar todos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    onClick={deselectAll}
                    style={{ borderColor: V2.LIGHT_BORDER }}
                  >
                    Desmarcar todos
                  </Button>
                </div>
              </div>
              <div className="max-h-[40vh] overflow-y-auto rounded-md border divide-y" style={{ borderColor: V2.LIGHT_BORDER }}>

                {sorted.map((l, i) => (
                  <label key={l.id} className="flex items-start gap-3 p-2.5 cursor-pointer hover:bg-black/[0.03]">
                    <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} className="mt-0.5" />
                    <div className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold shrink-0"
                         style={{ background: V2.TEAL_LIGHT, color: V2.TEAL_DARK }}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: V2.LIGHT_TEXT }}>{l.empresa}</p>
                      <p className="text-xs flex items-center gap-1" style={{ color: V2.LIGHT_MUTED }}>
                        <MapPin className="w-3 h-3" />
                        {l.cidade}{l.estado ? ` / ${l.estado}` : ""} · <b>{l._d.toFixed(1)} km</b>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.preventDefault(); openWaze(l); }} title="Abrir no Waze">
                        <Navigation className="w-3.5 h-3.5 mr-1" /> Waze
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.preventDefault(); openMapsOne(l); }} title="Abrir no Google Maps">
                        <MapPin className="w-3.5 h-3.5 mr-1" /> Maps
                      </Button>
                    </div>
                  </label>
                ))}
              </div>
              {filteredOutByRadius > 0 && (
                <p className="text-[11px]" style={{ color: V2.LIGHT_MUTED }}>
                  {filteredOutByRadius} cliente(s) fora do raio de {radiusKm} km foram ocultados.
                </p>
              )}
              {missingCoords > 0 && (
                <p className="text-[11px]" style={{ color: V2.LIGHT_MUTED }}>
                  {missingCoords} cliente(s) desta seleção sem coordenadas foram ignorados.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full">
            <div className="text-xs" style={{ color: V2.LIGHT_MUTED }}>
              {chosen.length} selecionado(s){chosen.length > 10 ? " · Google Maps abre apenas os 10 primeiros" : ""}
              {orderedRoute.length > 0 && (
                <span className="ml-1">· Ponto {Math.min(navIndex + 1, orderedRoute.length)} de {orderedRoute.length}</span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
              <Button
                onClick={startPointByPoint}
                disabled={!origin || orderedRoute.length === 0}
                variant="outline"
                style={{ borderColor: V2.TEAL, color: V2.TEAL }}
              >
                <Navigation className="w-4 h-4 mr-1" /> Navegar ponto a ponto
              </Button>
              {navIndex < orderedRoute.length - 1 && (
                <Button
                  onClick={nextPoint}
                  disabled={!origin || orderedRoute.length === 0}
                  variant="outline"
                  style={{ borderColor: V2.TEAL, color: V2.TEAL }}
                >
                  <Navigation className="w-4 h-4 mr-1" /> Próximo ponto
                </Button>
              )}
              <Button onClick={openInMaps} disabled={!origin || chosen.length === 0} style={{ background: V2.TEAL, color: "#fff" }}>
                <Navigation className="w-4 h-4 mr-1" /> Rota completa no Maps
              </Button>
            </div>
          </div>
          <p className="text-[11px] w-full" style={{ color: V2.LIGHT_MUTED }}>
            Dica: use <b>“Navegar ponto a ponto”</b> para o GPS falar virar a direita/esquerda. A rota completa abre a visão geral do mapa.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
