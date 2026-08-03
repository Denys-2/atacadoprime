import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, ArrowLeft, WifiOff, Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/offline-route")({
  ssr: false,
  component: OfflineRoutePage,
});

const OFFLINE_KEY = "prime:last-route-view";

type Stop = {
  id?: string;
  name?: string;
  address?: string;
  cidade?: string | null;
  estado?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
};

type Saved = {
  planId?: string;
  planName?: string;
  stops?: Stop[];
  savedAt?: string;
};

function getLatLng(s: Stop): { lat: number; lng: number } | null {
  const lat = s.latitude ?? s.lat;
  const lng = s.longitude ?? s.lng;
  if (lat == null || lng == null) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

function openGoogleMaps(stops: Stop[], origin: { lat: number; lng: number } | null) {
  const coords = stops.map(getLatLng).filter(Boolean) as { lat: number; lng: number }[];
  if (coords.length === 0) return;
  const destination = coords[coords.length - 1];
  const waypoints = coords.slice(0, -1).slice(0, 9);
  const params = new URLSearchParams({
    api: "1",
    travelmode: "driving",
    destination: `${destination.lat},${destination.lng}`,
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  if (waypoints.length) params.set("waypoints", waypoints.map((w) => `${w.lat},${w.lng}`).join("|"));
  window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank");
}

function openWaze(stop: Stop) {
  const c = getLatLng(stop);
  if (!c) return;
  window.open(`https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes`, "_blank");
}

function OfflineRoutePage() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      /* noop */
    }
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setOrigin(null),
        { enableHighAccuracy: true, timeout: 6000 },
      );
    }
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const stops = saved?.stops ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        <Button asChild size="sm" variant="ghost" className="h-9 w-9 p-0">
          <Link to="/">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {!online && <WifiOff className="w-3 h-3" />} Modo offline
          </p>
          <h1 className="text-base font-semibold truncate">{saved?.planName ?? "Rota salva"}</h1>
        </div>
        <Badge variant="outline">{stops.length} paradas</Badge>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {stops.length === 0 ? (
          <Card className="p-6 text-center space-y-2">
            <RouteIcon className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="font-medium">Nenhuma rota salva neste dispositivo</p>
            <p className="text-sm text-muted-foreground">
              Abra uma rota online em <span className="font-mono">Rotas → Ver no mapa</span> uma vez com internet.
              Depois ela ficará disponível aqui offline.
            </p>
          </Card>
        ) : (
          <>
            <Card className="p-4 space-y-2">
              <p className="text-sm font-medium">Navegar todas as paradas</p>
              <p className="text-xs text-muted-foreground">
                Abre o Google Maps com a sequência já otimizada (até 10 pontos).
                {origin ? " Origem: sua localização atual." : " Ative o GPS para usar sua posição como origem."}
              </p>
              <Button
                className="w-full gap-2"
                onClick={() => openGoogleMaps(stops, origin)}
              >
                <Navigation className="w-4 h-4" /> Abrir no Google Maps
              </Button>
            </Card>

            <div className="space-y-2">
              {stops.map((s, i) => {
                const c = getLatLng(s);
                return (
                  <Card key={s.id ?? i} className="p-3 flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.name ?? "Parada"}</p>
                      {(s.address || s.cidade) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {s.address || [s.cidade, s.estado].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {c && (
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => openWaze(s)} disabled={!c}>
                        <Navigation className="w-3.5 h-3.5" /> Waze
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1"
                        onClick={() => c && window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving`, "_blank")}
                        disabled={!c}
                      >
                        <MapPin className="w-3.5 h-3.5" /> Mapa
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>

            {saved?.savedAt && (
              <p className="text-[11px] text-muted-foreground text-center">
                Salvo em {new Date(saved.savedAt).toLocaleString("pt-BR")}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
