
ALTER TABLE public.whatsapp_templates 
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0;

-- Permite leitura por qualquer usuário autenticado (para usar nas campanhas)
DROP POLICY IF EXISTS "Authenticated can read wa_templates" ON public.whatsapp_templates;
CREATE POLICY "Authenticated can read wa_templates"
  ON public.whatsapp_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed dos 3 templates iniciais
INSERT INTO public.whatsapp_templates (nome, categoria, conteudo, ordem, ativo)
VALUES
(
  'Aviso 1 semana antes da viagem',
  'PRE_VIAGEM',
  E'Olá {{nome}}! Tudo bem?\n\nSou da *Atacado Prime* e passo aqui pra avisar: na próxima semana nossa equipe estará em *{{cidade}}/{{estado}}* com pronta entrega de chaves canivete, controles remotos e acessórios automotivos.\n\nTemos condições especiais pra quem reservar antes da visita — e o pagamento pode ser feito no ato da entrega, com total segurança na sua primeira compra.\n\nQuer que eu já separe algo pra você? Me responde aqui!',
  1,
  true
),
(
  'Lembrete na semana da viagem',
  'SEMANA_VIAGEM',
  E'Oi {{nome}}, tudo bem?\n\nEssa semana estaremos aí em *{{cidade}}/{{estado}}* com o estoque completo da *Atacado Prime* — chaves canivete, controles e acessórios prontos pra entrega.\n\nGaranta seu pedido antes que acabe! Pagamento na entrega, sem risco pra você.\n\nMe manda o que precisa que já reservo em separado.',
  2,
  true
),
(
  'Chegamos na cidade',
  'NA_CIDADE',
  E'{{nome}}, chegamos! 🚗\n\nA equipe da *Atacado Prime* já está em *{{cidade}}/{{estado}}* com pronta entrega de chaves canivete, controles e acessórios.\n\nÚltima chance de garantir preço especial e pagar só na entrega. Me responde qual peça você precisa que passo aí hoje mesmo!',
  3,
  true
);
