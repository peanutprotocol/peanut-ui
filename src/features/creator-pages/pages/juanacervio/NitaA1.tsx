import Image from 'next/image'
import { LOGO_LOCKUP } from '@/assets/brand'
import Sparkle from '@/assets/illustrations/sparkle.svg'
import Star from '@/assets/illustrations/star.svg'
import { PEANUT_SITTING } from '@/assets/mascot'
import { Card } from '@/components/0_Bruddle/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { CreatorPageShell } from '../../CreatorPageShell'
import type { CreatorPageVariantProps } from '../../variant-props'
import { A1_AVATAR_SRC } from './a1/a1-avatar.consts'
import { A1Cta } from './a1/A1Cta'
import { A1InviteLine } from './a1/A1InviteLine'
import { A1Post } from './a1/A1Post'
import { A1Proof } from './a1/A1Proof'
import { A1SampleBubble } from './a1/A1SampleBubble'
import { A1SampleRow } from './a1/A1SampleRow'
import { A1StickyCta } from './a1/A1StickyCta'
import { NITA_A1_COPY as copy } from './nita-a1.copy'
import styles from './NitaA1.module.css'

/** A still frame of the approved `pointing-down` mascot pose (mono assets/mascot/lottie), 256px WebP. */
const POINTING_MASCOT_SRC = '/creator-pages/juanacervio/a1-mascot-pointing-down.webp'

/**
 * Nita's page, variant A1: her X post redrawn large, with the store button inside the post.
 *
 * The markup is kept small on purpose: its server HTML must stay under 12,800 bytes, or React
 * hides the page until a script runs (see NitaA1.module.css). So elements carry few classes and
 * the stylesheet reaches them by their place in the block. Keep the order of elements in step with it.
 */
export function NitaA1(props: CreatorPageVariantProps) {
    const { proof, sample, steps, close } = copy
    const [accounts, clients, spend] = proof.items

    return (
        <CreatorPageShell page={props} lang="es-AR" className={styles.a1}>
            <section className={styles.hero}>
                <div>
                    <Image src={LOGO_LOCKUP} alt={copy.logoAlt} loading="eager" className="h-6 w-auto" />
                    <p>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a sized WebP in public/: the image optimizer would add a round trip and save nothing */}
                        <img src={A1_AVATAR_SRC} width={24} height={24} alt="" />
                        {copy.chip}
                    </p>
                </div>

                <h1>{copy.headline}</h1>
                {/* Benefit and mascot share one grid row, so the text wraps beside the mascot at any width or font size. */}
                <div className={styles.lead}>
                    <p>{copy.benefit}</p>
                    <div>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a small decorative SVG: nothing for the image optimizer to do */}
                        <img src={Star.src} alt="" />
                        {/* eslint-disable-next-line @next/next/no-img-element -- a small decorative SVG: nothing for the image optimizer to do */}
                        <img src={Sparkle.src} alt="" />
                        <Image src={PEANUT_SITTING} alt="" priority sizes="72px" />
                    </div>
                </div>
                <A1Post>
                    <A1Cta position="hero" />
                    <A1InviteLine />
                </A1Post>

                <div>
                    <p>{copy.post.added}</p>
                    <p>{copy.notABank}</p>
                    <p>{copy.more}</p>
                </div>
            </section>

            <section className={styles.proofs}>
                <p>{proof.kicker}</p>
                <h2>{proof.title}</h2>

                <A1Proof item={accounts} number={1}>
                    <A1SampleRow
                        leading={<A1SampleBubble fill="green">{sample.usdCode}</A1SampleBubble>}
                        title={sample.usd}
                        note={sample.usdNumber}
                    />
                    <A1SampleRow
                        leading={<A1SampleBubble fill="blue">{sample.eurCode}</A1SampleBubble>}
                        title={sample.eur}
                        note={sample.eurNumber}
                    />
                </A1Proof>

                <A1Proof item={clients} number={2}>
                    <A1SampleRow
                        leading={
                            <A1SampleBubble fill="green">
                                <Icon name="arrow-down" size={16} />
                            </A1SampleBubble>
                        }
                        title={sample.received}
                        note={sample.receivedNote}
                        trailing={<b>{sample.receivedAmount}</b>}
                    />
                </A1Proof>

                <A1Proof item={spend} number={3}>
                    <A1SampleRow
                        leading={
                            <A1SampleBubble fill="yellow">
                                <Icon name="qr-code" size={16} />
                            </A1SampleBubble>
                        }
                        title={sample.qr}
                        note={sample.qrNote}
                        trailing={
                            <A1SampleBubble fill="green">
                                <Icon name="check" size={16} />
                            </A1SampleBubble>
                        }
                    />
                </A1Proof>
            </section>

            <section className={styles.steps}>
                <h2>{steps.title}</h2>
                <Card shadowSize="4">
                    <ol>
                        {steps.items.map((step, index) => (
                            <li key={step.lead}>
                                <span aria-hidden>{index + 1}</span>
                                <p>
                                    <b>{step.lead}</b>
                                    {step.rest}
                                </p>
                            </li>
                        ))}
                    </ol>
                </Card>
            </section>

            <section className={styles.close}>
                <p>{close.quote}</p>
                <p>{close.by}</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- a sized WebP in public/: the image optimizer would add a round trip and save nothing */}
                <img src={POINTING_MASCOT_SRC} width={256} height={256} alt="" loading="lazy" />
                <A1Cta position="footer" />
                <A1InviteLine />
                <div>
                    <p>{close.legal}</p>
                    <p>{copy.notABank}</p>
                </div>
            </section>

            <A1StickyCta />
        </CreatorPageShell>
    )
}
