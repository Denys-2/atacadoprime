import { MessageCircle } from "lucide-react";

interface WhatsAppFabProps {
  phone?: string;
  message?: string;
}

export function WhatsAppFab({
  phone = "5534998651112",
  message = "Olá! Vim pelo site do Atacado Prime e gostaria de atendimento para revendedor.",
}: WhatsAppFabProps) {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Atendimento via WhatsApp"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group"
      style={{
        background: "#25D366",
        color: "#ffffff",
        boxShadow: "0 8px 24px rgba(37, 211, 102, 0.4)",
      }}
    >
      <MessageCircle className="h-6 w-6 fill-current transition-transform duration-300 group-hover:rotate-12" />
      <span className="font-bold text-xs sm:text-sm tracking-wide hidden xs:inline-block">
        Falar com Consultor
      </span>
    </a>
  );
}
