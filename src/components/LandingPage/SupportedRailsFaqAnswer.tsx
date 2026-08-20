'use client'

import ChainChip from '@/components/AddMoney/components/ChainChip'
import { CHAIN_LOGOS, OTHER_SUPPORTED_CHAINS, SUPPORTED_EVM_CHAINS, getSupportedTokens } from '@/constants/rhino.consts'
import { FIAT_RAILS } from '@/constants/faq.consts'
import { chainDisplayName } from '@/utils/chain-display.utils'
import { t } from '@/i18n/interpolate'
import type { LandingSupportedRailsStrings } from './landing.types'

/**
 * Rich answer body for the "which networks, tokens and banks?" landing FAQ item.
 * Renders from the same rhino.consts constants as the add-money Choose Network
 * drawer (and FIAT_RAILS shared with the plain-text SEO answer), so the FAQ
 * always advertises exactly what the app supports.
 *
 * Copy comes from the landing catalog via `strings`, like every other FAQ body —
 * the chain, token and rail names inside it stay as the app spells them.
 */
export function SupportedRailsFaqAnswer({ strings }: { strings: LandingSupportedRailsStrings }) {
    return (
        <div className="flex flex-col gap-5">
            <div>
                <p className="mb-2">
                    {t(strings.crypto, {
                        evmCount: String(SUPPORTED_EVM_CHAINS.length),
                        otherList: OTHER_SUPPORTED_CHAINS.map(chainDisplayName).join(` ${strings.joinAnd} `),
                    })}
                </p>
                <div className="flex flex-wrap gap-1 rounded-sm border border-n-1 bg-white p-2">
                    {[...SUPPORTED_EVM_CHAINS, ...OTHER_SUPPORTED_CHAINS].map((chain) => (
                        <ChainChip key={chain} chainName={chainDisplayName(chain)} chainSymbol={CHAIN_LOGOS[chain]} />
                    ))}
                </div>
            </div>
            <div>
                <p className="mb-2">{strings.tokens}</p>
                <div className="flex flex-wrap gap-1 rounded-sm border border-n-1 bg-white p-2">
                    {getSupportedTokens('EVM').map((token) => (
                        <ChainChip key={token.name} chainName={token.name} chainSymbol={token.logoUrl} />
                    ))}
                </div>
                <p className="mt-2 text-base text-grey-1">{strings.tokenNote}</p>
            </div>
            <div>
                <p className="mb-2">{strings.banks}</p>
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
            <p className="text-base text-grey-1">{strings.free}</p>
        </div>
    )
}
