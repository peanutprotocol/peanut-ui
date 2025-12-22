import { DEVCONNECT_LOGO, MERCADO_PAGO, PIX } from '@/assets'
import { METAMASK_LOGO, TRUST_WALLET_SMALL_LOGO } from '@/assets/wallets'
import binanceIcon from '@/assets/exchanges/binance.svg'

export interface PaymentMethod {
    id: string
    identifierIcon?: React.ReactNode
    title: string
    description: string
    icons: any[]
    soon: boolean
}

export const ACTION_METHODS: PaymentMethod[] = [
    {
        id: 'bank',
        title: 'Bank',
        description: 'EUR, USD, MXN, ARS & more',
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
        soon: false,
    },
    {
        id: 'pix',
        title: 'Pix',
        description: 'Instant transfers',
        icons: [PIX],
        soon: false,
    },
    {
        id: 'exchange-or-wallet',
        title: 'Exchange or Wallet',
        description: 'Binance, Metamask and more',
        icons: [binanceIcon, TRUST_WALLET_SMALL_LOGO, METAMASK_LOGO],
        soon: false,
    },
]

export const DEVCONNECT_CLAIM_METHODS: PaymentMethod[] = [
    {
        id: 'devconnect',
        title: 'Devconnect',
        description: 'Claim to your Devconnect wallet',
        icons: [DEVCONNECT_LOGO],
        soon: false,
    },
    {
        id: 'exchange-or-wallet',
        title: 'Exchange or Wallet',
        description: 'Binance, Metamask and more',
        icons: [binanceIcon, TRUST_WALLET_SMALL_LOGO, METAMASK_LOGO],
        soon: false,
    },
]
