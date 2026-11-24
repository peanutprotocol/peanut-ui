import { Fragment, type ReactNode } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { NITA_A1_COPY as copy } from '../nita-a1.copy'
import styles from '../NitaA1.module.css'
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
        <Card shadowSize="4" className={styles.post}>
            <div>
                {/* eslint-disable-next-line @next/next/no-img-element -- a sized WebP in public/: the image optimizer would add a round trip and save nothing */}
                <img src={A1_AVATAR_SRC} width={40} height={40} alt="" />
                <div>
                    <p>{post.name}</p>
                    <p>{post.handle}</p>
                </div>
            </div>

            <p>
                {post.segments.map((segment, index) => {
                    if (segment.highlight)
                        return (
                            <Fragment key={index}>
                                <A1Mark highlight={segment.highlight}>{segment.text}</A1Mark>
                                <span aria-hidden>{segment.marker}</span>
                            </Fragment>
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

            <p>
                <A1XGlyph />
                {post.meta}
            </p>

            <div>{children}</div>
        </Card>
    )
}
