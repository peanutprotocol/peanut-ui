import { useTranslations } from 'next-intl'
import type { ISetupStep } from './Setup.types'

/**
 * The title block props a setup step gets from the catalog. `<pink>` in a
 * description marks the brand-pink word ("Oh, and it's pink.").
 */
export function useSetupStepCopy(step: ISetupStep | undefined) {
    const t = useTranslations('setup')
    if (!step) return {}
    const titleKey = `steps.${step.screenId}.title` as Parameters<typeof t>[0]
    const descriptionKey = `steps.${step.screenId}.description` as Parameters<typeof t>[0]
    return {
        title: !step.titleInView ? t(titleKey) : undefined,
        description:
            !step.descriptionInView && t.has(descriptionKey)
                ? t.rich(descriptionKey, {
                      pink: (chunks) => <span className="text-foreground-brand">{chunks}</span>,
                  })
                : undefined,
        titleSize: step.titleSize,
        descriptionInTitle: step.descriptionInTitle,
    }
}
