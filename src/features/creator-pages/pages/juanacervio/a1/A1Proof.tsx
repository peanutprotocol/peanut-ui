import type { ReactNode } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { NITA_A1_COPY as copy } from '../nita-a1.copy'
import { A1_AVATAR_SRC } from './a1-avatar.consts'
import { A1Mark } from './A1Mark'

type ProofItem = (typeof copy.proof.items)[number]

/** One phrase of the post, then the card that says what it is in the app. `children` is the sample app rows. */
export function A1Proof({ item, number, children }: { item: ProofItem; number: number; children: ReactNode }) {
    return (
        <div className="mt-6">
            <div className="flex items-start gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={A1_AVATAR_SRC}
                    width={32}
                    height={32}
                    alt=""
                    loading="lazy"
                    className="mt-0.5 size-8 flex-none rounded-full border border-border-button object-cover"
                />
                <p className="text-body-l">
                    <span className="block text-label-m text-foreground-secondary">{copy.proof.source}</span>
                    {`“${item.before}`}
                    <A1Mark highlight={item.highlight}>{item.phrase}</A1Mark>
                    {'”'}
                </p>
            </div>
            <Card shadowSize="4" className="relative mt-3 ml-10 border-2 px-4 pt-3 pb-4">
                <span
                    aria-hidden
                    className="absolute -top-3.5 -left-3.5 flex size-7 items-center justify-center rounded-full bg-foreground-primary text-label-l text-foreground-inverse"
                >
                    {number}
                </span>
                <h3 className="text-heading-card">{item.title}</h3>
                <p className="mt-0.5 text-body-s text-foreground-secondary">{item.body}</p>
                <div aria-hidden className="mt-3 overflow-hidden rounded-sm border border-border-default">
                    {children}
                </div>
            </Card>
        </div>
    )
}
