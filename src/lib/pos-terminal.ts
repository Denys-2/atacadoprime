import { supabase } from "@/integrations/supabase/client";

const COOKIE_NAME = "pa_pos_terminal";
const STORAGE_KEY = "pa_pos_terminal_token";
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

/** Saves the refresh token so the terminal never asks for login again. */
export function rememberTerminal(refreshToken: string | null | undefined) {
  if (!refreshToken) return;
  writeCookie(COOKIE_NAME, refreshToken, ONE_YEAR);
  try {
    localStorage.setItem(STORAGE_KEY, refreshToken);
  } catch {
    /* storage may be blocked in POS webviews */
  }
}

export function forgetTerminal() {
  writeCookie(COOKIE_NAME, "", 0);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function storedToken(): string | null {
  let local: string | null = null;
  try {
    local = localStorage.getItem(STORAGE_KEY);
  } catch {
    local = null;
  }
  return readCookie(COOKIE_NAME) ?? local;
}

export function hasTerminalToken(): boolean {
  return !!storedToken();
}

/** Restores the paired terminal session silently. Returns true on success. */
export async function restoreTerminalSession(): Promise<boolean> {
  const refresh_token = storedToken();
  if (!refresh_token) return false;

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error || !data.session) {
    forgetTerminal();
    return false;
  }

  rememberTerminal(data.session.refresh_token);
  return true;
}
