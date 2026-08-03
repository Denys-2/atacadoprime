import { supabase } from "@/integrations/supabase/client";

/**
 * Log de erros do frontend para tabela central `error_logs`.
 * Usar em catch blocks e ErrorBoundary.
 */
export async function logError(params: {
  mensagem: string;
  stack?: string;
  contexto?: Record<string, unknown>;
  nivel?: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
}) {
  try {
    const { data: session } = await supabase.auth.getSession();
    await supabase.from("error_logs").insert({
      user_id: session.session?.user.id ?? null,
      origem: "FRONTEND",
      nivel: params.nivel ?? "ERROR",
      mensagem: params.mensagem.slice(0, 2000),
      stack: params.stack?.slice(0, 8000),
      contexto: (params.contexto ?? null) as never,
      url: typeof window !== "undefined" ? window.location.href : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // não relança — logger não deve derrubar app
  }
}

/**
 * Instala captura global de erros e promise rejections não tratadas.
 */
export function installGlobalErrorCapture() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    logError({ mensagem: e.message, stack: e.error?.stack, nivel: "ERROR" });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    logError({
      mensagem: reason?.message ?? String(reason),
      stack: reason?.stack,
      nivel: "ERROR",
      contexto: { type: "unhandledrejection" },
    });
  });
}
