'use client'

import { useDirectSendFlow, useAddMoneyFlow, useCryptoWithdrawFlow, useRequestPayFlow } from '@/hooks/payment'

export type PaymentFlowType = 'direct_send' | 'add_money' | 'withdraw' | 'request_pay'

/**
 * Hook that returns the appropriate payment flow based on flow type
 * This replaces the complex conditional logic in the old PaymentForm
 */
export const usePaymentFlow = (flowType: PaymentFlowType) => {
    const directSendFlow = useDirectSendFlow()
    const addMoneyFlow = useAddMoneyFlow()
    const withdrawFlow = useCryptoWithdrawFlow()
    const requestPayFlow = useRequestPayFlow()

    switch (flowType) {
        case 'direct_send':
            return {
                ...directSendFlow,
                execute: directSendFlow.sendDirectly,
                type: 'direct_send' as const,
            }
        case 'add_money':
            return {
                ...addMoneyFlow,
                execute: addMoneyFlow.addMoney,
                type: 'add_money' as const,
            }
        case 'withdraw':
            return {
                ...withdrawFlow,
                execute: withdrawFlow.withdraw,
                type: 'withdraw' as const,
            }
        case 'request_pay':
            return {
                ...requestPayFlow,
                execute: requestPayFlow.payRequest,
                type: 'request_pay' as const,
            }
        default:
            throw new Error(`Unknown flow type: ${flowType}`)
    }
}
