// minimum amount requirements for different payment methods (in USD)
export const MIN_BANK_TRANSFER_AMOUNT = 5
export const MIN_MERCADOPAGO_AMOUNT = 5
export const MIN_PIX_AMOUNT = 5

// deposit limits for manteca regional onramps (in USD)
export const MAX_MANTECA_DEPOSIT_AMOUNT = 2000
export const MIN_MANTECA_DEPOSIT_AMOUNT = 1

// withdraw limits for manteca regional offramps (in USD)
export const MAX_MANTECA_WITHDRAW_AMOUNT = 2000
export const MIN_MANTECA_WITHDRAW_AMOUNT = 1

// QR payment limits for manteca (PIX, MercadoPago, QR3)
export const MIN_MANTECA_QR_PAYMENT_AMOUNT = 0.1 // Manteca provider minimum
export const MAX_QR_PAYMENT_AMOUNT_FOREIGN = 2000 // max per transaction for foreign users

/**
 * validate if amount meets minimum requirement for a payment method
 * @param amount - amount in USD
 * @param methodId - payment method identifier
 * @returns true if amount is valid, false otherwise
 */
export const validateMinimumAmount = (amount: number, methodId: string): boolean => {
    const minimums: Record<string, number> = {
        bank: MIN_BANK_TRANSFER_AMOUNT,
        mercadopago: MIN_MERCADOPAGO_AMOUNT,
        pix: MIN_PIX_AMOUNT,
    }
    return amount >= (minimums[methodId] ?? 0)
}
