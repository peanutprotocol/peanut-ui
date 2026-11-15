/**
 * English landing alias, including for signed-in visitors.
 * Render its fragment targets before hydration, as on the localized homes.
 * The canonical still points at `/` (see ./layout.tsx).
 */

import { LandingPageShell } from '@/components/LandingPage/LandingPageShell'
import { LandingPageContent } from '@/components/LandingPage/LandingPageContent'
import { DEFAULT_LOCALE } from '@/i18n/types'

export default function LPPage() {
    return (
        <LandingPageShell>
            <LandingPageContent locale={DEFAULT_LOCALE} />
        </LandingPageShell>
    )
}
