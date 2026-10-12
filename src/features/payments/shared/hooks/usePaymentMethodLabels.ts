'use client'

import type { PaymentMethod } from '@/constants/actionlist.consts'
import { useTranslations } from 'next-intl'

/**
 * A payment method's title and description in the reader's language.
 *
 * The method lists are constants with English labels, shared by several
 * screens, so a payer in pt-BR or es-419 read "Exchange or Wallet" and "Instant
 * transfers" among translated rows. The catalogue already names these methods
 * for the send screen, so the same keys are read here. Mercado Pago and Pix are
 * brand names and keep their titles; any other id keeps its constant's English.
 */
export function usePaymentMethodLabels() {
    const t = useTranslations('send.methods')
    return (method: Pick<PaymentMethod, 'id' | 'title' | 'description'>): { title: string; description: string } => {
        switch (method.id) {
            case 'bank':
                return { title: t('bankTitle'), description: t('bankDescription') }
            case 'exchange-or-wallet':
                return { title: t('exchangeOrWalletTitle'), description: t('exchangeOrWalletDescription') }
            case 'mercadopago':
            case 'pix':
                return { title: method.title, description: t('instantTransfers') }
            default:
                return { title: method.title, description: method.description }
        }
    }
}
