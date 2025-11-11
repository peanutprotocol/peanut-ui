// minimum amount requirements for different payment methods (in USD)
export const MIN_BANK_TRANSFER_AMOUNT = 5
export const MIN_MERCADOPAGO_AMOUNT = 5
export const MIN_PIX_AMOUNT = 5

// deposit limits for manteca regional onramps (in USD)
export const MAX_MANTECA_DEPOSIT_AMOUNT = 2000
export const MIN_MANTECA_DEPOSIT_AMOUNT = 1

// time constants for devconnect intent cleanup
export const DEVCONNECT_INTENT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// maximum number of devconnect intents to store per user
export const MAX_DEVCONNECT_INTENTS = 10

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
