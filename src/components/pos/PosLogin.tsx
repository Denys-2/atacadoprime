import { useState, type FormEvent } from "react";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import brandLogo from "@/assets/brand-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { rememberTerminal } from "@/lib/pos-terminal";

export function PosLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error("Email ou senha incorretos.");
      return;
    }

    rememberTerminal(data.session?.refresh_token);
    toast.success("Terminal liberado. Não vai pedir login novamente.");
  }

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-foreground">
      <div className="mx-auto w-full max-w-[340px]">
        <header className="mb-5 flex items-center justify-center gap-2 border-b border-border pb-4">
          <img src={brandLogo.url} alt="Prime Automotive" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="text-sm font-semibold">POS Prime</h1>
            <p className="text-[11px] text-muted-foreground">Terminal de vendas</p>
          </div>
        </header>

        <section aria-labelledby="pos-login-title">
          <h2 id="pos-login-title" className="text-lg font-semibold">Entrar</h2>
          <p className="mt-1 text-xs text-muted-foreground">Use seu email e senha para abrir o POS.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pos-email">Email</Label>
              <Input
                id="pos-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 text-base"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-password">Senha</Label>
              <Input
                id="pos-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 text-base"
                required
              />
            </div>
            <Button type="submit" className="h-12 w-full font-semibold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Entrar no POS
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}