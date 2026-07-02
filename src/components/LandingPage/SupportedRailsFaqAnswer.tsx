'use client'

import ChainChip from '@/components/AddMoney/components/ChainChip'
import { CHAIN_LOGOS, SUPPORTED_EVM_CHAINS, getSupportedTokens, TOKEN_LOGOS } from '@/constants/rhino.consts'
import { chainDisplayName } from '@/constants/faq.consts'

const FIAT_RAILS = [
    { flag: '🇺🇸', name: 'ACH & Wire', detail: 'USD · United States' },
    { flag: '🇪🇺', name: 'SEPA', detail: 'EUR · 36 countries' },
    { flag: '🇬🇧', name: 'Faster Payments', detail: 'GBP · United Kingdom' },
    { flag: '🇲🇽', name: 'SPEI', detail: 'MXN · Mexico' },
    { flag: '🇦🇷', name: 'Mercado Pago', detail: 'ARS · Argentina' },
    { flag: '🇧🇷', name: 'Pix', detail: 'BRL · Brazil' },
] as const

/**
 * Rich answer body for the "which networks, tokens and banks?" landing FAQ item.
 * Renders from the same rhino.consts constants as the add-money Choose Network
 * drawer, so the FAQ always advertises exactly what the app supports.
 */
export function SupportedRailsFaqAnswer() {
    return (
        <div className="flex flex-col gap-5">
            <div>
                <p className="mb-2">
                    Crypto — one deposit address for all {SUPPORTED_EVM_CHAINS.length} EVM networks, plus Solana and
                    Tron:
                </p>
                <div className="flex flex-wrap gap-1 rounded-sm border border-n-1 bg-white p-2">
                    {SUPPORTED_EVM_CHAINS.map((chain) => (
                        <ChainChip key={chain} chainName={chainDisplayName(chain)} chainSymbol={CHAIN_LOGOS[chain]} />
                    ))}
                    <ChainChip chainName="Solana" chainSymbol={CHAIN_LOGOS.SOLANA} />
                    <ChainChip chainName="Tron" chainSymbol={CHAIN_LOGOS.TRON} />
                </div>
            </div>
            <div>
                <p className="mb-2">Tokens:</p>
                <div className="flex flex-wrap gap-1 rounded-sm border border-n-1 bg-white p-2">
                    {getSupportedTokens('EVM').map((token) => (
                        <ChainChip key={token.name} chainName={token.name} chainSymbol={TOKEN_LOGOS[token.name]} />
                    ))}
                </div>
                <p className="mt-2 text-base text-grey-1">
                    USDC & USDT on every network · ETH on EVM networks · Tron is USDT-only
                </p>
            </div>
            <div>
                <p className="mb-2">Banks & local payment apps:</p>
                <ul className="flex flex-col gap-1.5">
                    {FIAT_RAILS.map((rail) => (
                        <li key={rail.name} className="flex items-baseline gap-2">
                            <span>{rail.flag}</span>
                            <span>{rail.name}</span>
                            <span className="text-base text-grey-1">{rail.detail}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <p className="text-base text-grey-1">Deposits are free — Peanut covers the gas.</p>
        </div>
    )
}
