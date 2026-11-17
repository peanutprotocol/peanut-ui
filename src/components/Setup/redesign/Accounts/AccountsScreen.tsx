'use client'

import { useTranslations } from 'next-intl'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { StarDoodles, type StarSpec } from '@/components/Setup/redesign/shell/StarDoodles'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { CoinCharacter } from '@/components/Setup/redesign/shell/CoinCharacter'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { BankDetailsCard } from './BankDetailsCard'
import { SAMPLE_BANK_DETAILS } from './sampleBankDetails'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

/** Mock 05-accounts/screen.js LAYOUT ([left, top, rotate] in art-box design px). Small phones: more overlap, no stars. */
const LAYOUT = {
    std: { usd: [28, 282, -5], eur: [116, 392, 4] },
    sm: { usd: [30, 284, -5], eur: [112, 390, 4] },
} as const
const STARS: readonly StarSpec[] = [
    { left: 340, top: 270, size: 22 },
    { left: 22, top: 434, size: 18 },
]
/** The coin sits on the card's top-right corner (mock: right -36, top -40 on the 236 px card, an 80 px box). */
const COIN = { left: 192, top: -40, size: 80 }
/** One rig pass as each coin lands (mock COIN_DROP + 220 ms). */
const COIN_PLAY_MS = { usd: 580, eur: 700 }

/** 05 Accounts (step `advantage-fees`): USD and EUR bank details, the coin characters on the cards. */
export function AccountsScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign')
    const { handleNext, isLoading } = useSetupFlow()
    const { track } = useSignupControl()
    const layout = LAYOUT[useShellDevice()]
    const holder = [t('accounts.holder'), t('accounts.holderName')] as const
    const cards = [
        {
            coin: 'usd' as const,
            place: layout.usd,
            header: SAMPLE_BANK_DETAILS.usdHeader,
            rows: [
                holder,
                [t('accounts.account'), SAMPLE_BANK_DETAILS.account],
                [t('accounts.routing'), SAMPLE_BANK_DETAILS.routing],
            ] as const,
        },
        {
            coin: 'eur' as const,
            place: layout.eur,
            header: SAMPLE_BANK_DETAILS.eurHeader,
            rows: [holder, [SAMPLE_BANK_DETAILS.ibanLabel, SAMPLE_BANK_DETAILS.iban]] as const,
        },
    ]
    return (
        <SetupScreen
            ground="yellow"
            stage="tall"
            artTop={252}
            smArtTop={254}
            state={isLoading ? 'advancing' : 'default'}
            title={t('accounts.title')}
            art={
                <>
                    {cards.map(({ coin, place: [left, top, rotate], header, rows }, index) => (
                        <ArtPiece
                            key={coin}
                            left={left}
                            top={top}
                            rotate={rotate}
                            entrance="deal"
                            order={index * 2}
                            zIndex={5 + index}
                        >
                            <BankDetailsCard
                                header={header}
                                rows={rows}
                                testId={`setup-redesign-accounts-card-${coin}`}
                            />
                            <CoinCharacter
                                coin={coin}
                                left={COIN.left}
                                top={COIN.top}
                                size={COIN.size}
                                entrance="stamp"
                                order={4 + index * 2}
                                playAfterMs={COIN_PLAY_MS[coin]}
                            />
                        </ArtPiece>
                    ))}
                    <StarDoodles stars={STARS} order={8} />
                </>
            }
            footer={{
                primary: {
                    label: t('common.continue'),
                    loading: isLoading,
                    disabled: isLoading,
                    onClick: () => {
                        track('continue', 'tap')
                        void handleNext()
                    },
                },
            }}
        >
            <p className={SETUP_LEAD_CLASS} data-setup-screen="advantage-fees">
                {t('accounts.desc')}
            </p>
        </SetupScreen>
    )
}
