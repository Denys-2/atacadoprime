
# Versão POS — Terminal Android com impressora térmica

Objetivo: rodar o sistema num aparelho tipo Sunmi/PDA (tela 5–6", touch, impressora 58mm embutida) sem tocar no `/v3` que já está em produção. Tudo novo fica sob o prefixo `/pos`.

## Escopo (fase 1 — mínimo viável para operar)

1. **Layout dedicado `/pos`**
   - Shell próprio (`PosShell`) — sem sidebar, sem drawer. Header fino com logo + operador + botão sair.
   - Bottom navigation fixo com 4 abas: **Vender · Pedidos · Produtos · Caixa**.
   - Tipografia +2 pts, botões min 48px de altura (padrão touch), sem hover states.
   - Reaproveita paleta Warm Sand + tokens já existentes.

2. **`/pos/vender` — PDV otimizado**
   - Busca por SKU / código de barras (input com autofocus, envia no Enter — pronto pra leitor bluetooth).
   - Grid grande de produtos favoritos/recentes (atalhos).
   - Carrinho lateral colapsável.
   - Fecha venda em 2 toques: forma pgto → confirmar.
   - Após fechar: modal "Imprimir cupom / Imprimir etiqueta / Concluir".

3. **`/pos/produtos` — cadastro/etiqueta**
   - Lista simples com busca.
   - Ação principal: **Imprimir etiqueta** (nome curto + preço + EAN13 já gerado no banco).
   - Editar preço rápido inline (sem sair da tela).

4. **`/pos/pedidos` — últimos 20 pedidos**
   - Reimprimir cupom, cancelar, ver detalhe.

5. **`/pos/caixa` — abertura/fechamento simples**
   - Abre caixa com valor inicial, fecha com contagem, gera relatório do turno.
   - Não substitui o `/v3/fechamento` (esse continua sendo o oficial contábil).

## Impressão térmica

Camada única `src/lib/pos-printer.ts` com detecção de ambiente:

- **Sunmi V2/V2s** (mais comum no BR): usa `window.sunmiPrinter` via WebView bridge.
- **Genérico ESC/POS** (Bluetooth): usa Web Bluetooth API + comandos ESC/POS crus.
- **Fallback web**: `window.print()` com CSS 58mm para testar no desktop.

Dois templates:
- `renderTicket(order)` — cupom de venda (itens, total, forma pgto, código do pedido).
- `renderLabel(product)` — etiqueta (nome, preço, código de barras EAN13).

## Fora do escopo desta fase

- CRM, viagens, campanhas WhatsApp, relatórios avançados → continuam apenas no `/v3`.
- Modo offline puro (sync PWA já cobre parcialmente; se precisar mais robusto, faço numa fase 2).
- Emissão fiscal (NFC-e) — depende de contrato com SEFAZ/emissor; deixo hook preparado.

## Estrutura técnica

```text
src/
  routes/
    pos.tsx                    → layout PosShell
    pos.index.tsx              → redirect /pos → /pos/vender
    pos.vender.tsx
    pos.pedidos.tsx
    pos.pedidos.$id.tsx
    pos.produtos.tsx
    pos.caixa.tsx
  components/pos/
    PosShell.tsx
    PosBottomNav.tsx
    PosProductGrid.tsx
    PosCartPanel.tsx
    PrintDialog.tsx
  lib/
    pos-printer.ts             → abstração Sunmi / Web Bluetooth / fallback
    pos-templates.ts           → renderTicket / renderLabel
  hooks/
    use-pos-session.ts         → operador logado + caixa aberta
```

- Todas as rotas ficam **públicas do ponto de vista de auth do POS** mas exigem sessão Supabase válida (mesmo mecanismo `_authenticated` — vou colocar `pos` sob `_authenticated`).
- Reaproveita 100% das tabelas atuais (`products`, `orders`, `order_items`, `financial_transactions`) — zero migração nova nesta fase.
- Modo quiosque: adiciono meta `viewport-fit=cover` + manifest com `display: fullscreen` e `start_url: /pos`.

## Como testar sem o hardware

- Abro `/pos` no navegador em modo dispositivo (Chrome DevTools → 412×915, Pixel 5).
- Impressão cai no fallback `window.print()` com CSS 58mm — dá pra validar o layout do cupom/etiqueta antes do aparelho chegar.

## Passos de execução

1. Criar `PosShell` + rotas vazias com bottom nav navegável.
2. Portar o fluxo essencial de venda do `/v3/pdv` para `/pos/vender` (versão enxuta).
3. Implementar `pos-printer.ts` com os 3 modos + templates.
4. Modal de impressão pós-venda + botão de reimpressão em pedidos.
5. Tela de etiqueta em produtos.
6. Caixa aberto/fechado simples.

Quando você aprovar, começo pela etapa 1 e vou entregando por partes pra você validar em cada aparelho/tela.
