import type { ReactNode } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import type { NitaA1Copy } from '../nita-a1.copy'
import styles from '../NitaA1.module.css'
import { A1_AVATAR_SRC } from './a1-avatar.consts'
import { A1Mark } from './A1Mark'

type ProofItem = NitaA1Copy['proof']['items'][number]

/**
 * One phrase of the post, then the card that says what it is in the app. `children` is the sample app rows.
 * `source` is the label over the phrase ("Nita, on X").
 */
export function A1Proof({
    item,
    source,
    number,
    children,
}: {
    item: ProofItem
    source: string
    number: number
    children: ReactNode
}) {
    return (
        <div className={styles.proof}>
            <div>
                {/* eslint-disable-next-line @next/next/no-img-element -- a sized WebP in public/: the image optimizer would add a round trip and save nothing */}
                <img src={A1_AVATAR_SRC} width={32} height={32} alt="" loading="lazy" />
                <p>
                    <span>{source}</span>
                    {/* Her words, in Spanish on every locale's page. */}
                    <span lang="es-AR">
                        {`“${item.before}`}
                        <A1Mark highlight={item.highlight}>{item.phrase}</A1Mark>
                        {'”'}
                    </span>
                </p>
            </div>
            <Card shadowSize="4">
                <span aria-hidden>{number}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <div aria-hidden>{children}</div>
            </Card>
        </div>
    )
}
