import Image from 'next/image'
import { CreatorPageCta } from '../../CreatorPageCta'
import { CreatorPageShell } from '../../CreatorPageShell'
import type { CreatorPageVariantProps } from '../../variant-props'
import { NITA_G2_COPY } from './nita-g2.copy'
import styles from './NitaG2.module.css'

/** Nita's page, variant G2: a frame of the Reel the visitor just left, with a bottom sheet over it. */
export function NitaG2(props: CreatorPageVariantProps) {
    const copy = NITA_G2_COPY[props.locale]
    return (
        <CreatorPageShell page={props} className={styles.page}>
            <div className={styles.column}>
                {/* The wrapper carries the image's name and the image has none: an image that fails to
                    load then leaves the plain ground of .reel, not a broken-image icon. */}
                <div className={styles.reel} role="img" aria-label={copy.reelAlt}>
                    {/* The only frame we have is 425x758. This file is that frame enlarged 2x (Lanczos)
                        to 850x1516, so a phone does not stretch it with a coarser filter. When Nita's
                        original arrives, export a 9:16 frame at least 1080 px wide (WebP, under 150 kB)
                        to the same path: nothing else changes. */}
                    <Image
                        src="/creator-pages/juanacervio/g2-reel.webp"
                        alt=""
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
                        <p className={styles.legal}>{copy.legal}</p>
                    </div>
                </section>
            </div>
        </CreatorPageShell>
    )
}
