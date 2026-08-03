import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Route as RouteIcon, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoutes, useCreateRoute, useAddRouteItem, todayISO } from "@/hooks/use-field";
import { toast } from "sonner";

type Props = {
  leadId?: string | null;
  companyId?: string | null;
  label?: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  iconOnly?: boolean;
};

export function AddToRouteDialog({ leadId, companyId, label = "Adicionar à rota", size = "sm", variant = "outline", iconOnly }: Props) {
  const { user } = useAuth();
  const { data: routes = [] } = useRoutes(user?.id);
  const createRoute = useCreateRoute();
  const addItem = useAddRouteItem();
  const [open, setOpen] = useState(false);
  const [routeId, setRouteId] = useState<string>("");
  const [newNome, setNewNome] = useState("");
  const [newData, setNewData] = useState(todayISO());

  const planejadas = routes.filter((r) => r.status !== "CONCLUIDA");

  async function submit() {
    if (!user) return;
    try {
      let targetId = routeId;
      if (targetId === "__new__" || !targetId) {
        if (!newNome) return toast.error("Informe o nome da nova rota");
        const r = await createRoute.mutateAsync({ user_id: user.id, nome: newNome, data: newData });
        targetId = r.id;
      }
      await addItem.mutateAsync({ route_id: targetId, lead_id: leadId ?? null, company_id: companyId ?? null });
      toast.success("Adicionado à rota");
      setOpen(false);
      setRouteId("");
      setNewNome("");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant={variant} onClick={(e) => e.stopPropagation()} title={label}>
          <RouteIcon className={iconOnly ? "w-4 h-4" : "w-4 h-4 mr-1"} />
          {!iconOnly && label}
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()} className="max-w-md">
        <DialogHeader><DialogTitle>Adicionar à rota</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Rota existente</Label>
            <Select value={routeId} onValueChange={setRouteId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione ou crie nova..." /></SelectTrigger>
              <SelectContent>
                {planejadas.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.data} · {r.nome}{r.cidade ? ` (${r.cidade})` : ""}</SelectItem>
                ))}
                <SelectItem value="__new__"><Plus className="w-3 h-3 inline mr-1" />Criar nova rota</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(routeId === "__new__" || (planejadas.length === 0 && !routeId)) && (
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">Nome da nova rota</Label>
                <Input className="mt-1" placeholder="Ex: Centro - terça" value={newNome} onChange={(e) => setNewNome(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Data</Label>
                <Input type="date" className="mt-1" value={newData} onChange={(e) => setNewData(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={addItem.isPending || createRoute.isPending}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
