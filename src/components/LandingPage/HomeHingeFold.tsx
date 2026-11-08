import { Band } from '@/components/Marketing/StarLp/Band'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { HomeBalanceScreen } from './HomeBalanceScreen'
import type { HomeHingeFoldProps } from './homeHinge.types'

/** f5, the hinge between earning and spending: one balance with money in from Europe and out at a till. */
export function HomeHingeFold({ strings, locale }: HomeHingeFoldProps) {
    return (
        <Band ground="cream" id="home-balance">
            <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
                <SectionTitle>{strings.heading}</SectionTitle>
                <HomeBalanceScreen strings={strings} locale={locale} />
            </div>
        </Band>
    )
}
