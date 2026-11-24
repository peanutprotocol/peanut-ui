import Image from 'next/image'
import { LOGO_LOCKUP } from '@/assets/brand'
import { CreatorPageCta } from '../../CreatorPageCta'
import { CreatorPageMascot } from '../../CreatorPageMascot'
import { CreatorPageShell } from '../../CreatorPageShell'
import type { CreatorPageVariantProps } from '../../variant-props'
import { E1Lettering } from './e1/E1Lettering'
import tears from './e1/torn-edges.module.css'
import { NITA_E1_COPY as copy } from './nita-e1.copy'
import styles from './NitaE1.module.css'

const ASSETS = '/creator-pages/juanacervio'
const STEP_TEARS = [tears.tornStep, tears.tornStep2, tears.tornStep3]

/** Nita's page, variant E1: a poster in her own collage style, with her real post taped on it. */
export function NitaE1(props: CreatorPageVariantProps) {
    // Rendered twice: in the pinned strip, and unseen in the poster, which keeps the strip's place free.
    const dockNote = (
        <div className={styles.note}>
            <p className={`${styles.mono} ${styles.invite}`}>{copy.invite}</p>
            <p className={styles.notABank}>{copy.notABank}</p>
        </div>
    )

    return (
        <CreatorPageShell page={props} lang="es-AR" className={styles.page}>
            <div className={styles.column}>
                <section className={styles.poster}>
                    <p className={`${styles.mono} ${styles.chip}`}>{copy.chip}</p>
                    <h1 className={styles.h1}>
                        <span className="sr-only">{copy.headline.join(' ')}</span>
                        <E1Lettering lines={copy.headline} accentLine={1} />
                    </h1>

                    <Image
                        src={`${ASSETS}/e1-nita-cutout.webp`}
                        alt={copy.portraitAlt}
                        width={515}
                        height={1010}
                        priority
                        sizes="(min-width: 480px) 330px, 69vw"
                        className={styles.cut}
                    />

                    <figure className={styles.tweet}>
                        <span className={`${tears.tapeShape} ${styles.tape} ${styles.tapeTweet}`} aria-hidden />
                        <figcaption className={styles.who}>
                            <Image src={`${ASSETS}/e1-nita-avatar.webp`} alt="" width={192} height={192} sizes="80px" />
                            <span>
                                <b>{copy.post.name}</b>
                                <i>{copy.post.meta}</i>
                            </span>
                        </figcaption>
                        <blockquote>
                            {copy.post.runs.map(({ text, style }, index) =>
                                style === 'mark' ? (
                                    <mark key={index}>{text}</mark>
                                ) : style === 'link' ? (
                                    <span key={index} className={styles.link}>
                                        {text}
                                    </span>
                                ) : (
                                    text
                                )
                            )}
                        </blockquote>
                    </figure>

                    {/* The space the pinned strip covers while the poster is on screen, with the pieces
                        that stand on the strip's edge. */}
                    <div className={styles.stand}>
                        <CreatorPageMascot className={styles.sticker} />
                        <div className={styles.guest}>
                            <Image src={LOGO_LOCKUP} alt={copy.peanutAlt} />
                        </div>
                        <div className={`${styles.dockIn} ${styles.placeholder}`} aria-hidden>
                            <div className={styles.cta} />
                            {dockNote}
                        </div>
                    </div>
                </section>

                <section className={styles.how}>
                    <p className={`${styles.mono} ${styles.label}`}>{copy.how.label}</p>
                    <h2 className={`${styles.cond} ${styles.h2}`}>
                        {copy.how.headline.map((line, index) => (
                            <span key={line} className={`${styles.outlined} ${index === 1 ? styles.purple : ''}`}>
                                <span className={styles.stroke} aria-hidden>
                                    {line}
                                </span>
                                <span className={styles.fill}>{line}</span>
                            </span>
                        ))}
                    </h2>
                    <ol className={styles.steps}>
                        {copy.how.steps.map(({ title, body }, index) => (
                            <li key={title} className={`${styles.step} ${STEP_TEARS[index % STEP_TEARS.length]}`}>
                                <span className={`${styles.cond} ${styles.stepNumber}`} aria-hidden>
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <h3 className={styles.cond}>{title}</h3>
                                <p>{body}</p>
                            </li>
                        ))}
                    </ol>

                    <div className={styles.ticket}>
                        <Image
                            src={`${ASSETS}/e1-nita-avatar.webp`}
                            alt=""
                            width={192}
                            height={192}
                            sizes="80px"
                            className={styles.ticketPhoto}
                        />
                        <p className={`${styles.mono} ${styles.ticketLabel}`}>{copy.ticket.label}</p>
                        <p className={`${styles.cond} ${styles.ticketTitle}`}>{copy.ticket.title}</p>
                        <p className={styles.ticketBody}>{copy.ticket.body}</p>
                    </div>
                </section>

                <footer className={styles.end}>
                    <Image
                        src={`${ASSETS}/e1-nita-wordmark.webp`}
                        alt={copy.wordmarkAlt}
                        width={450}
                        height={189}
                        sizes="185px"
                        className={styles.wordmark}
                    />
                    <p className={styles.fine}>
                        <b>{copy.notABank}</b>
                    </p>
                    <p className={styles.fine}>{copy.fine}</p>
                    <p className={styles.fine}>{copy.quoteNote}</p>
                </footer>

                {/* Last in the column and sticky: pinned to the bottom of the visible viewport on every
                    screen of the scroll, and at rest it is the page's closing button. */}
                <div className={styles.dock}>
                    <div className={styles.dockPaper} aria-hidden>
                        <div className={tears.tornStrip} />
                    </div>
                    <div className={styles.dockIn}>
                        <CreatorPageCta
                            className={`btn btn-primary ${styles.cta}`}
                            labels={copy.cta}
                            position="sticky"
                        />
                        {dockNote}
                    </div>
                </div>
            </div>
        </CreatorPageShell>
    )
}
