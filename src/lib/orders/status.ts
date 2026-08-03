export type OrderStatus =
  | "PENDENTE"
  | "AGUARDANDO_PAGAMENTO"
  | "PAGO"
  | "EM_SEPARACAO"
  | "ENVIADO"
  | "ENTREGUE"
  | "CANCELADO";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  AGUARDANDO_PAGAMENTO: "PAGO",
  PAGO: "EM_SEPARACAO",
  EM_SEPARACAO: "ENVIADO",
  ENVIADO: "ENTREGUE",
};

const PAID_STATES = new Set<OrderStatus>(["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"]);
const TERMINAL_STATES = new Set<OrderStatus>(["CANCELADO", "ENTREGUE"]);

export const nextStatus = (s: string): OrderStatus | undefined =>
  NEXT_STATUS[s as OrderStatus];

export const isPaidStatus = (s: string): boolean => PAID_STATES.has(s as OrderStatus);

export const canCancel = (s: string): boolean => !TERMINAL_STATES.has(s as OrderStatus);

export const isPendingPayment = (s: string): boolean =>
  s === "AGUARDANDO_PAGAMENTO" || s === "PENDENTE";
