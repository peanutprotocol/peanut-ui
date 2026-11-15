import type { ReactNode } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { NITA_A1_COPY as copy } from '../nita-a1.copy'
import { A1_AVATAR_SRC } from './a1-avatar.consts'
import { A1Mark } from './A1Mark'
import { A1XGlyph } from './A1XGlyph'

/**
 * Nita's X post, redrawn as a card. `children` is the store button, inside the post.
 * Under 360px wide the card is tighter, so the button stays on the first screen of a 320×568 phone
 * before the pinned bar can show (no script yet).
 */
export function A1Post({ children }: { children: ReactNode }) {
    const { post } = copy
    return (
        <Card shadowSize="4" className="border-2 p-3 xs:p-4">
            <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a sized WebP in public/: the image optimizer would add a round trip and save nothing */}
                <img
                    src={A1_AVATAR_SRC}
                    width={40}
                    height={40}
                    alt=""
                    className="size-10 flex-none rounded-full border border-border-button object-cover"
                />
                <div className="min-w-0">
                    <p className="text-body-m-semibold">{post.name}</p>
                    <p className="text-body-s text-foreground-secondary">{post.handle}</p>
                </div>
            </div>

            <p className="mt-2 text-body-l max-[359px]:leading-6">
                {post.segments.map((segment, index) => {
                    if (segment.highlight)
                        return (
                            <span key={index}>
                                <A1Mark highlight={segment.highlight}>{segment.text}</A1Mark>
                                <span
                                    aria-hidden
                                    className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-foreground-primary align-text-bottom text-label-m text-foreground-inverse"
                                >
                                    {segment.marker}
                                </span>
                            </span>
                        )
                    if (segment.kind === 'mention')
                        return (
                            <span key={index} className="text-avatar-blue-foreground">
                                {segment.text}
                            </span>
                        )
                    if (segment.kind === 'cut')
                        return (
                            <span key={index} className="text-foreground-secondary">
                                {segment.text}
                            </span>
                        )
                    return segment.text
                })}
            </p>

            <p className="mt-2 flex items-center gap-2 text-body-s text-foreground-secondary">
                <A1XGlyph className="size-3.5 flex-none text-foreground-primary" />
                {post.meta}
            </p>

            <div className="mt-3 border-t border-border-disabled pt-3 max-[359px]:mt-2 max-[359px]:pt-2">
                {children}
            </div>
        </Card>
    )
}
