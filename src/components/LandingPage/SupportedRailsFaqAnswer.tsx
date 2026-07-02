'use client'

import ChainChip from '@/components/AddMoney/components/ChainChip'
import { CHAIN_LOGOS, OTHER_SUPPORTED_CHAINS, SUPPORTED_EVM_CHAINS, getSupportedTokens } from '@/constants/rhino.consts'
import { FIAT_RAILS } from '@/constants/faq.consts'
import { chainDisplayName } from '@/utils/chain-display.utils'

/**
 * Rich answer body for the "which networks, tokens and banks?" landing FAQ item.
 * Renders from the same rhino.consts constants as the add-money Choose Network
 * drawer (and FIAT_RAILS shared with the plain-text SEO answer), so the FAQ
 * always advertises exactly what the app supports.
 */
export function SupportedRailsFaqAnswer() {
    return (
        <div className="flex flex-col gap-5">
            <div>
                <p className="mb-2">
                    Crypto — one deposit address for all {SUPPORTED_EVM_CHAINS.length} EVM networks, plus{' '}
                    {OTHER_SUPPORTED_CHAINS.map(chainDisplayName).join(' and ')}:
                </p>
                <div className="flex flex-wrap gap-1 rounded-sm border border-n-1 bg-white p-2">
                    {[...SUPPORTED_EVM_CHAINS, ...OTHER_SUPPORTED_CHAINS].map((chain) => (
                        <ChainChip key={chain} chainName={chainDisplayName(chain)} chainSymbol={CHAIN_LOGOS[chain]} />
                    ))}
                </div>
            </div>
            <div>
                <p className="mb-2">Tokens:</p>
                <div className="flex flex-wrap gap-1 rounded-sm border border-n-1 bg-white p-2">
                    {getSupportedTokens('EVM').map((token) => (
                        <ChainChip key={token.name} chainName={token.name} chainSymbol={token.logoUrl} />
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
                            <span className="text-base text-grey-1">
                                {rail.currency} · {rail.region}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
            <p className="text-base text-grey-1">Deposits are free — Peanut covers the gas.</p>
        </div>
    )
}
