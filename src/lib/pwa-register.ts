// Limpeza temporária do antigo app-shell. Algumas maquininhas mantiveram uma
// resposta de navegação obsoleta e trocavam de página durante o carregamento.
export function registerPWA() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      const scriptUrl = registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? "";
      if (scriptUrl.endsWith("/sw.js")) void registration.unregister();
    });
  });
}
