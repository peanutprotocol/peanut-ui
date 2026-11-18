'use client'

import { useTranslations } from 'next-intl'
import { SetupDocLink } from '@/components/Setup/components/SetupDocsDrawer'

/** The legal line under "Create passkey", the step that creates the account (mock a5). Links open dev's doc drawer. */
export function PasskeyTerms() {
    const t = useTranslations('setupRedesign.passkey')
    const link = 'whitespace-nowrap underline underline-offset-2'
    return (
        <p
            data-testid="passkey-terms"
            className="mt-3 w-full self-start border-t border-border-subtle px-1 pt-3 text-center text-body-xs text-balance text-foreground-secondary signup-sm:mt-1.5"
        >
            {t.rich('terms', {
                terms: (chunks) => (
                    <SetupDocLink kind="terms" href="/terms" className={link}>
                        {chunks}
                    </SetupDocLink>
                ),
                privacy: (chunks) => (
                    <SetupDocLink kind="privacy" href="/privacy" className={link}>
                        {chunks}
                    </SetupDocLink>
                ),
            })}
        </p>
    )
}
