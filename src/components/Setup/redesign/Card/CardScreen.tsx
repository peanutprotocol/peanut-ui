'use client'

import { useTranslations } from 'next-intl'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { MascotStage } from '@/components/Setup/redesign/shell/MascotStage'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { CardFace } from '@/components/Setup/redesign/shell/CardFace'
import { StarDoodles, type StarSpec } from '@/components/Setup/redesign/shell/StarDoodles'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

/** Mock 06-card/screen.js LAYOUT, in art-box design px. Small phones: a smaller card and peanut, no stars. */
const LAYOUT = {
    std: { card: { left: 118, top: 274, width: 236 }, peanut: { left: -37, top: 333, width: 210 } },
    sm: { card: { left: 126, top: 326, width: 222 }, peanut: { left: -23, top: 361, width: 178 } },
} as const
const STARS: readonly StarSpec[] = [
    { left: 340, top: 266, size: 26 },
    { left: 100, top: 274, size: 18 },
    { left: 352, top: 432, size: 18 },
]

/** 06 Card (step `advantage-card`): the Peanut Card, pink and in dollars. */
export function CardScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign')
    const { handleNext, isLoading } = useSetupFlow()
    const { track } = useSignupControl()
    const layout = LAYOUT[useShellDevice()]
    return (
        <SetupScreen
            ground="sky"
            stage="tall"
            artTop={260}
            smArtTop={312}
            state={isLoading ? 'advancing' : 'default'}
            title={t('card.title')}
            art={
                <>
                    <ArtPiece
                        left={layout.card.left}
                        top={layout.card.top}
                        width={layout.card.width}
                        rotate={-7}
                        entrance="deal"
                        zIndex={6}
                    >
                        <CardFace width={layout.card.width} />
                    </ArtPiece>
                    <MascotStage
                        pose="pointing"
                        left={layout.peanut.left}
                        top={layout.peanut.top}
                        width={layout.peanut.width}
                        zIndex={7}
                    />
                    <StarDoodles stars={STARS} order={3} />
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
            <p className={SETUP_LEAD_CLASS} data-setup-screen="advantage-card">
                {t.rich('card.desc', {
                    pink: (chunks) => (
                        <mark className="bg-background-brand px-1 text-foreground-primary">{chunks}</mark>
                    ),
                })}
            </p>
        </SetupScreen>
    )
}
