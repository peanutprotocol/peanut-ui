import type { StarLpFaqItem } from '@/components/Marketing/StarLp/starLp.types'
import type { Locale } from '@/i18n/types'
import type { LandingStrings } from './landingStrings'

export interface HomeFoldsProps {
    locale: Locale
    strings: LandingStrings
    /** The FAQ items from the landing content file, each with its help link if it has one. */
    faqItems: StarLpFaqItem[]
    /** The hero's own CTA from the landing content file: the close repeats it word for word. */
    closeCta: { label: string; href: string }
}
