export type PayChannel = "upi_intent" | "upi_id" | "upi_qr" | "card" | "netbanking" | "wallet" | "paylater";
export type PayRequest = { orderId: string; orderCode: string; amount: number; customer: { name: string; phone: string } };
export type PayResult = { success: boolean; channel: PayChannel; reference: string; failureReason?: string };
