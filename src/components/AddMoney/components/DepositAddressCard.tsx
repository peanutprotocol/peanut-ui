'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { CARD_SURFACE } from '@/components/0_Bruddle/Card'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { Icon } from '@/components/Global/Icons/Icon'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { Tooltip } from '@/components/Tooltip'
import { NETWORK_LOGOS, SUPPORTED_EVM_CHAINS } from '@/constants/rhino.consts'
import type { RhinoChainType } from '@/services/services.types'

/**
 * A Rhino deposit address as every add-money surface shows it: the QR with the network's logo, then a
 * card with the address (bold ends, a copy icon) and its info tooltip. Sections a surface adds (networks,
 * tokens, provider) go in `children`, inside the same card. Used by /add-money/crypto and the card's
 * add-money drawer (TASK-25169).
 */
export function DepositAddressCard({
    address,
    network,
    children,
}: {
    address: string
    network: RhinoChainType
    children?: ReactNode
}) {
    const t = useTranslations('addMoney.crypto')
    const tooltip =
        network === 'EVM'
            ? t('tooltipEvm', { count: SUPPORTED_EVM_CHAINS.length })
            : network === 'SOL'
              ? t('tooltipSol')
              : t('tooltipTron')
    return (
        <>
            <div className="flex items-center justify-center">
                <QRCodeWrapper url={address} centerImage={NETWORK_LOGOS[network]} />
            </div>
            <div className={`flex w-full flex-col overflow-hidden ${CARD_SURFACE}`}>
                <div className="flex flex-col gap-2 p-4">
                    <div className="flex items-center gap-1">
                        <Tooltip content={tooltip} position="bottom">
                            <span className="flex items-center gap-1">
                                <span className="text-label-l">
                                    {network === 'EVM' ? t('universalDepositAddress') : t('depositAddress')}
                                </span>
                                <Icon name="info" size={16} className="text-foreground-secondary" />
                            </span>
                        </Tooltip>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-body-s break-all" data-testid="deposit-address">
                            <span className="font-semibold">{address.slice(0, 6)}</span>
                            {address.slice(6, -6)}
                            <span className="font-semibold">{address.slice(-6)}</span>
                        </p>
                        <CopyToClipboard textToCopy={address} iconSize="4" className="flex-shrink-0" />
                    </div>
                </div>
                {children}
            </div>
        </>
    )
}
