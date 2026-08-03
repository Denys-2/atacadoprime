import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ShieldCheck, Zap, TrendingUp } from "lucide-react";
import brandLogo from "@/assets/brand-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — Atacado Prime" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s.mode === "signup" ? ("signup" as const) : ("login" as const),
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: AuthPage,
});

/** Caminho relativo de mesma origem preservado no ?redirect= (usado no consentimento OAuth). */
function safeRedirect(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("redirect");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/** Vai para o destino preservado ou para o painel padrão. */
function goAfterAuth(navigate: ReturnType<typeof useNavigate>) {
  const target = safeRedirect();
  if (target) {
    window.location.href = target;
    return;
  }
  navigate({ to: "/dashboard" });

}

function AuthPage() {
  const navigate = useNavigate();
  const { mode, redirect } = Route.useSearch();
  const isPosAccess = redirect === "/pos" || redirect?.startsWith("/pos/") === true;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goAfterAuth(navigate);
    });
  }, [navigate]);





  return (
    <div
      className={isPosAccess
        ? "min-h-[100dvh] w-full overflow-x-hidden flex items-start justify-center px-3 py-4"
        : "min-h-[100dvh] w-full overflow-x-hidden grid lg:grid-cols-12"}
      style={{ background: "#faf8f5", color: "#3d2b1f" }}
    >
      {/* HERO BRAND — dark + orange v3 */}
      {!isPosAccess && <div
        className="hidden lg:flex lg:col-span-5 relative overflow-hidden flex-col justify-between p-12"
        style={{
          background:
            "radial-gradient(1000px 500px at 0% 0%, rgba(201,169,110,0.18) 0%, transparent 60%), radial-gradient(900px 500px at 100% 100%, rgba(201,169,110,0.08) 0%, transparent 60%), linear-gradient(160deg, #ffffff 0%, #faf8f5 100%)",
        }}
      >
        <div className="pointer-events-none absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full blur-3xl" style={{ background: "rgba(201,169,110,0.15)" }} />
        <div className="pointer-events-none absolute -bottom-40 -right-24 w-[460px] h-[460px] rounded-full blur-3xl" style={{ background: "rgba(201,169,110,0.10)" }} />

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
          }}
        />

        <Link to="/" className="relative flex items-center gap-3 font-semibold z-10">
          <div className="w-11 h-11 rounded-full grid place-items-center overflow-hidden border shadow-sm" style={{ background: "#ffffff", borderColor: "#e8e2d8" }}>
            <img src="/brand-logo.png" alt="Prime" className="w-7 h-7 object-contain rounded-full" />
          </div>
          <div className="leading-tight">
            <div className="uppercase tracking-[0.25em] text-[10px] text-[#8b7355]">B2B Platform</div>
            <div className="uppercase tracking-widest text-sm font-bold">Atacado Prime</div>
          </div>
        </Link>

        <div className="relative z-10">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest font-bold mb-5 border"
            style={{ background: "rgba(201,169,110,0.12)", color: "#c9a96e", borderColor: "rgba(201,169,110,0.35)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#c9a96e" }} />
            Plataforma online
          </div>
          <div className="border-l-4 pl-5" style={{ borderColor: "#c9a96e" }}>
            <h2 className="text-4xl xl:text-5xl font-extrabold uppercase tracking-tight leading-[0.95]">
              Acesso à
              <br />
              <span style={{ color: "#c9a96e" }}>central Prime</span>
            </h2>
            <p className="mt-5 text-[#8b7355] max-w-md text-sm leading-relaxed">
              Plataforma B2B de inteligência comercial. Catálogo, pedidos, CRM e radar de oportunidades em um só painel.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3">
            <MiniStat icon={<ShieldCheck className="w-4 h-4" />} label="Seguro" value="100%" />
            <MiniStat icon={<Zap className="w-4 h-4" />} label="Tempo real" value="LIVE" />
            <MiniStat icon={<TrendingUp className="w-4 h-4" />} label="Operação" value="24/7" />
          </div>
        </div>

        <p className="relative z-10 text-[10px] text-[#8b7355]/60 uppercase tracking-widest">
          © {new Date().getFullYear()} Atacado Prime · Todos os direitos reservados
        </p>
      </div>}

      {/* FORM */}
      <div className={isPosAccess
        ? "w-full max-w-[340px]"
        : "lg:col-span-7 flex items-start sm:items-center justify-center px-4 py-6 sm:p-6 lg:p-12 relative overflow-hidden"}>
        {!isPosAccess && <div className="pointer-events-none absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full blur-3xl" style={{ background: "rgba(201,169,110,0.08)" }} />}

        <div className={isPosAccess ? "w-full" : "w-full max-w-md relative"}>
          {isPosAccess ? (
            <div className="mb-5 flex items-center justify-center gap-2 border-b pb-4" style={{ borderColor: "#e8e2d8" }}>
              <img src="/brand-logo.png" alt="Prime Automotive" className="h-10 w-10 object-contain" />
              <div>
                <p className="text-sm font-semibold">POS Prime</p>
                <p className="text-[11px]" style={{ color: "#8b7355" }}>Acesso ao terminal de vendas</p>
              </div>
            </div>
          ) : <Link
            to="/"
            className="inline-flex items-center gap-2 mb-4 sm:mb-6 text-xs uppercase tracking-widest font-semibold hover:opacity-70 transition-opacity"
            style={{ color: "#8b7355" }}
          >
            <span aria-hidden>←</span> Voltar ao site
          </Link>}
          <div className={isPosAccess ? "mb-4" : "border-l-4 pl-4 sm:pl-5 mb-5 sm:mb-8"} style={{ borderColor: "#c9a96e" }}>
            <h1 className={isPosAccess ? "text-lg font-semibold" : "text-xl sm:text-2xl lg:text-3xl font-extrabold uppercase tracking-tight leading-none"} style={{ color: "#3d2b1f" }}>
              {isPosAccess ? "Entrar" : <>Entrar na <span style={{ color: "#c9a96e" }}>Plataforma</span></>}
            </h1>
            <p className="text-xs font-medium mt-1.5" style={{ color: "#8b7355" }}>
              {isPosAccess ? "Use seu email e senha para abrir o POS." : "Acesso restrito a revendedores e operadores cadastrados."}
            </p>
          </div>

          {isPosAccess ? <LoginForm /> : <Tabs defaultValue={mode}>
            <TabsList className="grid grid-cols-2 w-full p-1 h-11" style={{ background: "#ffffff", border: "1px solid #e8e2d8" }}>
              <TabsTrigger value="login" className="data-[state=active]:bg-[#c9a96e] data-[state=active]:text-[#3d2b1f] data-[state=active]:shadow-md uppercase text-xs tracking-wider font-bold transition-all" style={{ color: "#3d2b1f" }}>Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-[#c9a96e] data-[state=active]:text-[#3d2b1f] data-[state=active]:shadow-md uppercase text-xs tracking-wider font-bold transition-all" style={{ color: "#3d2b1f" }}>Cadastrar</TabsTrigger>
            </TabsList>
            <TabsContent value="login"><LoginForm /></TabsContent>
            <TabsContent value="signup"><SignupForm /></TabsContent>
          </Tabs>}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="relative rounded-xl p-3 border" style={{ background: "#ffffff", borderColor: "#e8e2d8" }}>
      <div className="mb-2" style={{ color: "#c9a96e" }}>{icon}</div>
      <div className="text-lg font-extrabold tracking-tight" style={{ color: "#3d2b1f" }}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#8b7355" }}>{label}</div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const code = (error as { code?: string }).code ?? "";
      const msg = error.message?.toLowerCase() ?? "";
      let friendly = "Não conseguimos entrar. Tente novamente.";
      if (code === "invalid_credentials" || msg.includes("invalid login")) {
        friendly = 'Senha incorreta ou email não cadastrado. Verifique os dados ou clique em "Esqueci minha senha".';
      } else if (code === "email_not_confirmed" || msg.includes("not confirmed")) {
        friendly = "Email ainda não confirmado. Verifique sua caixa de entrada.";
      } else if (msg.includes("rate limit") || code === "over_request_rate_limit") {
        friendly = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
      } else if (code === "user_banned") {
        friendly = "Esta conta está bloqueada. Fale com o suporte.";
      }
      toast.error(friendly, { duration: 6000 });
      return;
    }
    goAfterAuth(navigate);
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4 mt-6">
        <Field id="login-email" label="Email" type="email" value={email} onChange={setEmail} required />
        <Field id="login-password" label="Senha" type="password" value={password} onChange={setPassword} required />
        <div className="flex justify-end -mt-2">
          <button type="button" onClick={() => setForgotOpen(true)} className="text-xs font-semibold uppercase tracking-wider text-[#c9a96e] hover:underline">
            Esqueci minha senha
          </button>
        </div>
        <Button type="submit" className="w-full bg-[#c9a96e] hover:bg-[#b5935a] uppercase tracking-wider font-bold" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Entrar
        </Button>
      </form>
      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} defaultEmail={email} />
    </>
  );
}

function ForgotPasswordDialog({ open, onOpenChange, defaultEmail }: {
  open: boolean; onOpenChange: (v: boolean) => void; defaultEmail: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) setEmail(defaultEmail); }, [open, defaultEmail]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Enviamos um link de recuperação para seu email.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recuperar senha</DialogTitle>
          <DialogDescription>
            Informe o email da sua conta. Enviaremos um link para você criar uma nova senha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field id="forgot-email" label="Email" type="email" value={email} onChange={setEmail} required />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-[#c9a96e] hover:bg-[#b5935a]" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Enviar link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SignupForm() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const phoneDigits = phone.replace(/\D/g, "");
    const taxDigits = taxId.replace(/\D/g, "");
    if (phoneDigits.length > 0 && (phoneDigits.length < 10 || phoneDigits.length > 13)) {
      toast.error("Telefone inválido. Use DDD + número (ex.: 34998651112).");
      return;
    }
    if (taxDigits.length !== 11 && taxDigits.length !== 14) {
      toast.error("Documento inválido. CPF deve ter 11 dígitos e CNPJ 14.");
      return;
    }
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + (safeRedirect() ?? "/dashboard"),
        data: { full_name: fullName },
      },
    });
    if (error) { setLoading(false); toast.error(error.message); return; }

    const userId = signUpData.user?.id;
    if (userId) {
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({
          owner_id: userId,
          legal_name: legalName,
          trade_name: tradeName || null,
          tax_id: taxDigits,
          email,
          phone: phoneDigits,
          status: "pending",
        })
        .select("id")
        .single();

      if (companyError) {
        toast.error("Conta criada, mas falhou ao salvar empresa: " + companyError.message);
      } else if (company) {
        const { error: addrError } = await supabase.from("addresses").insert({
          company_id: company.id,
          kind: "both",
          label: "Principal",
          street,
          number: number || null,
          complement: complement || null,
          district: district || null,
          city,
          state,
          zip,
          country: "BR",
          is_default: true,
        });
        if (addrError) toast.error("Falhou ao salvar endereço: " + addrError.message);
      }
    }

    setLoading(false);
    toast.success("Cadastro enviado! Aguarde aprovação para liberar as compras.");
    goAfterAuth(navigate);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 mt-6">
      <div className="rounded-md border-l-4 border-[#c9a96e] bg-[#ffffff] p-3 text-xs text-[#8b7355]">
        <span className="font-bold uppercase tracking-wider text-[#3d2b1f]">Cadastro de Revendedor.</span> Contas administrativas são criadas internamente pelo time.
      </div>
      <div className="space-y-3">
        <SectionLabel>Acesso</SectionLabel>
        <Field id="signup-name" label="Nome completo" value={fullName} onChange={setFullName} required />
        <Field id="signup-email" label="Email" type="email" value={email} onChange={setEmail} required />
        <Field id="signup-password" label="Senha" type="password" value={password} onChange={setPassword} required minLength={8} />
        <Field id="signup-phone" label="Telefone / WhatsApp (opcional)" value={phone} onChange={setPhone} />
      </div>

      <div className="space-y-3 pt-2">
        <SectionLabel>Empresa</SectionLabel>
        <Field id="signup-legal" label="Razão social / Nome completo" value={legalName} onChange={setLegalName} required />
        <Field id="signup-trade" label="Nome fantasia (opcional)" value={tradeName} onChange={setTradeName} />
        <Field id="signup-tax" label="CPF (11 dígitos) ou CNPJ (14 dígitos)" value={taxId} onChange={setTaxId} required />
      </div>

      <div className="space-y-3 pt-2">
        <SectionLabel>Endereço</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Field id="signup-zip" label="CEP" value={zip} onChange={setZip} required />
          <Field id="signup-state" label="UF" value={state} onChange={setState} required />
        </div>
        <Field id="signup-street" label="Rua / Logradouro" value={street} onChange={setStreet} required />
        <div className="grid grid-cols-2 gap-3">
          <Field id="signup-number" label="Número" value={number} onChange={setNumber} />
          <Field id="signup-complement" label="Complemento" value={complement} onChange={setComplement} />
        </div>
        <Field id="signup-district" label="Bairro" value={district} onChange={setDistrict} />
        <Field id="signup-city" label="Cidade" value={city} onChange={setCity} required />
      </div>

      <Button type="submit" className="w-full bg-[#c9a96e] hover:bg-[#b5935a] uppercase tracking-wider font-bold" disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Criar conta
      </Button>
      <p className="text-xs text-[#8b7355] text-center">
        Acesso ao catálogo e preços liberado após aprovação manual da empresa.
      </p>
    </form>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-[#c9a96e] border-l-2 border-[#c9a96e] pl-2">
      {children}
    </p>
  );
}

function Field({ id, label, value, onChange, type = "text", required, minLength }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; minLength?: number;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && show ? "text" : type;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs uppercase tracking-wider font-semibold text-[#3d2b1f]/80">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          className={`bg-[#ffffff] border-[#e8e2d8] text-[#3d2b1f] placeholder:text-[#8b7355]/60 focus-visible:ring-[#c9a96e] ${isPassword ? "pr-10" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#3d2b1f]/50 hover:text-[#3d2b1f]"
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            tabIndex={-1}
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

