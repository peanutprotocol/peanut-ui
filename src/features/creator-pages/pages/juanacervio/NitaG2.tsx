import Image from 'next/image'
import { CreatorPageCta } from '../../CreatorPageCta'
import { CreatorPageShell } from '../../CreatorPageShell'
import type { CreatorPageProps } from '../../types'
import { NITA_G2_COPY as copy } from './nita-g2.copy'
import styles from './NitaG2.module.css'

/** Nita's page, variant G2: a frame of the Reel the visitor just left, with a bottom sheet over it. */
export function NitaG2(props: CreatorPageProps) {
    return (
        <CreatorPageShell page={props} lang="es-AR" className={styles.page}>
            <div className={styles.column}>
                <div className={styles.reel}>
                    <Image
                        src="/creator-pages/juanacervio/g2-reel.webp"
                        alt={copy.reelAlt}
                        fill
                        priority
                        sizes="(min-width: 480px) 480px, 100vw"
                        className={styles.reelImage}
                    />
                </div>

                <section className={styles.sheet}>
                    <div className={styles.grab} aria-hidden />
                    <p className={styles.eyebrow}>{copy.eyebrow}</p>
                    <h1 className={styles.headline}>
                        {copy.headline}
                        <br />
                        <em className={styles.accent}>{copy.headlineAccent}</em>
                    </h1>
                    <p className={styles.benefit}>{copy.benefit}</p>
                    <CreatorPageCta className={`btn btn-primary ${styles.cta}`} labels={copy.cta} position="hero" />
                    <div className={styles.foot}>
                        <p className={styles.invite}>{copy.invite}</p>
                        <p className={styles.legal}>
                            <span>{copy.disclosure}</span>
                            <span>{copy.legal}</span>
                        </p>
                    </div>
                </section>
            </div>
        </CreatorPageShell>
    )
}
