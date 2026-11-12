import type { ComponentProps } from 'react'
import { useTranslations } from 'next-intl'
import { useWelcomeHeadlineExperiment } from '@/features/setup/WelcomeHeadlineExperimentProvider'
import { WELCOME_HEADLINE_VARIANTS, type WelcomeHeadlineVariant } from '@/features/setup/welcomeHeadlineExperiment'
import SetupTitleBlock from './SetupTitleBlock'

export default function WelcomeHeadlineTitleBlock(props: ComponentProps<typeof SetupTitleBlock>) {
    const t = useTranslations('setup.steps.landing')
    const { variant, reserveSpace } = useWelcomeHeadlineExperiment()
    const copy = (arm: WelcomeHeadlineVariant) =>
        arm === 'control'
            ? { title: props.title, description: props.description }
            : { title: t(`variants.${arm}.title`), description: t(`variants.${arm}.description`) }

    if (!reserveSpace) return <SetupTitleBlock {...props} {...copy(variant ?? 'control')} />
    return (
        <div className="grid">
            {WELCOME_HEADLINE_VARIANTS.map((arm) => (
                <div
                    key={arm}
                    className={`col-start-1 row-start-1 ${variant === arm ? 'visible' : 'invisible'}`}
                    aria-hidden={variant !== arm}
                >
                    <SetupTitleBlock {...props} {...copy(arm)} />
                </div>
            ))}
        </div>
    )
}
