import { Card } from '@/components/0_Bruddle/Card'
import { Band } from '@/components/Marketing/StarLp/Band'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { CARD_PLATINUM_COPY, CARD_STATS } from './peanutCard.consts'

/** Pink fold: "Platinum. But it's pink.", how money gets in, and /shhhhh's four tiles. */
export function PeanutCardPlatinum() {
    return (
        <Band ground="pink" align="center">
            <PopIn>
                <SectionTitle size="display">
                    {CARD_PLATINUM_COPY.titleLines.map((line) => (
                        <span key={line} className="block">
                            {line}
                        </span>
                    ))}
                </SectionTitle>
            </PopIn>
            <p className="mx-auto mt-8 max-w-2xl text-body-l text-balance">{CARD_PLATINUM_COPY.body}</p>
            <ul className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                {CARD_STATS.map(({ value, label }) => (
                    <li key={label}>
                        <Card shadowSize="4" className="h-full items-center justify-center px-3 py-8 md:py-10">
                            <span className="text-heading-l md:text-heading-xl">{value}</span>
                            <span className="mt-3 text-label-m uppercase">{label}</span>
                        </Card>
                    </li>
                ))}
            </ul>
        </Band>
    )
}
