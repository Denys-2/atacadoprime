import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, Phone, Clock, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contact")({
  head: () => ({ meta: [{ title: "Fale conosco — Atacado" }] }),
  component: ContactPage,
});

const WHATSAPP = "5511999999999";
const EMAIL = "contato@atacadoprime.com.br";
const PHONE = "(11) 99999-9999";

function ContactPage() {
  return (
    <AppShell title="Fale conosco" description="Tire dúvidas, peça suporte ou solicite um atendimento personalizado.">
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-success/5 border-success/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-success" /> WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Resposta rápida com nosso time comercial. Horário comercial.</p>
            <Button asChild className="w-full gap-2 bg-success hover:bg-success/90 text-success-foreground">
              <a href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Olá! Preciso de ajuda no Atacado.")}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4" /> Abrir conversa
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-primary" /> E-mail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Para pedidos detalhados, propostas comerciais e suporte.</p>
            <Button asChild variant="outline" className="w-full gap-2">
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Phone className="w-5 h-5 text-primary" /> Telefone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Atendimento por voz.</p>
            <Button asChild variant="outline" className="w-full gap-2">
              <a href={`tel:${PHONE.replace(/\D/g, "")}`}>{PHONE}</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Horário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Segunda a sexta: 08h às 18h</p>
            <p>Sábados: 08h às 12h</p>
            <p className="text-muted-foreground">Fora desse horário responderemos no próximo dia útil.</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Endereço</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Atacado Prime — atendimento 100% digital aos revendedores.
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
