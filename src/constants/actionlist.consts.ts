import { MERCADO_PAGO } from '@/assets'
import { METAMASK_LOGO, TRUST_WALLET_SMALL_LOGO } from '@/assets/wallets'
import binanceIcon from '@/assets/exchanges/binance.svg'

export interface PaymentMethod {
    id: string
    title: string
    description: string
    icons: any[]
    soon: boolean
}

export const ACTION_METHODS: PaymentMethod[] = [
    {
        id: 'bank',
        title: 'Bank',
        description: 'EUR, USD, ARS (more coming soon)',
        icons: [
            'https://flagcdn.com/w160/ar.png',
            'https://flagcdn.com/w160/de.png',
            'https://flagcdn.com/w160/us.png',
        ],
        soon: false,
    },
    {
        id: 'mercadopago',
        title: 'Mercado Pago',
        description: 'Instant transfers',
        icons: [MERCADO_PAGO],
        soon: true,
    },
    {
        id: 'exchange-or-wallet',
        title: 'Exchange or Wallet',
        description: 'Binance, Coinbase, Metamask and more',
        icons: [binanceIcon, TRUST_WALLET_SMALL_LOGO, METAMASK_LOGO],
        soon: false,
    },
]
