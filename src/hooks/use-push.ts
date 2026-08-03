import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  saveAnonymousPushSubscription,
  savePushSubscription,
  deleteAnonymousPushSubscription,
  deletePushSubscription,
  getPushPublicKey,
} from "@/lib/push.functions";
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function buf2b64(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type PushState = "unsupported" | "denied" | "prompt" | "subscribed";

export function usePush() {
  const [state, setState] = useState<PushState>("prompt");
  const [busy, setBusy] = useState(false);
  const getKey = useServerFn(getPushPublicKey);
  const saveSub = useServerFn(savePushSubscription);
  const saveAnonymousSub = useServerFn(saveAnonymousPushSubscription);
  const deleteSub = useServerFn(deletePushSubscription);
  const deleteAnonymousSub = useServerFn(deleteAnonymousPushSubscription);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported"); return;
    }
    if (Notification.permission === "denied") { setState("denied"); return; }
    const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
    const sub = await reg?.pushManager.getSubscription();
    setState(sub ? "subscribed" : "prompt");
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const subscribe = useCallback(async () => {
    setBusy(true);
    try {
      if (typeof window === "undefined") throw new Error("Ambiente inválido");
      if (!window.isSecureContext) throw new Error("Ative HTTPS para receber notificações.");
      if (window.top !== window.self) {
        throw new Error("Abra o app fora do preview (instale como PWA ou abra em nova aba) para ativar notificações.");
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const standalone = (window.navigator as any).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
        if (isIOS && !standalone) {
          throw new Error("No iPhone/iPad, adicione o app à Tela de Início antes de ativar as notificações.");
        }
        throw new Error("Seu navegador não suporta notificações push.");
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "prompt");
        throw new Error(perm === "denied" ? "Permissão negada nas configurações do navegador." : "Permissão não concedida.");
      }
      const reg = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await getKey();
      if (!publicKey) throw new Error("Configuração do servidor incompleta (VAPID). Contate o suporte.");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json: any = sub.toJSON();
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id ?? null;
      const payload = {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? buf2b64(sub.getKey("p256dh")),
        auth: json.keys?.auth ?? buf2b64(sub.getKey("auth")),
        userAgent: navigator.userAgent,
      };

      if (userId) {
        await saveSub({ data: payload });
      } else {
        await saveAnonymousSub({ data: payload });
      }
      setState("subscribed");
    } finally { setBusy(false); }
  }, [getKey, saveAnonymousSub, saveSub]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session?.user?.id) {
          await deleteSub({ data: { endpoint: sub.endpoint } });
        } else {
          await deleteAnonymousSub({ data: { endpoint: sub.endpoint } });
        }
        await sub.unsubscribe();
      }
      setState("prompt");
    } finally { setBusy(false); }
  }, [deleteAnonymousSub, deleteSub]);

  return { state, busy, subscribe, unsubscribe, refresh };
}

