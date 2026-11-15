import Image from 'next/image'
import { LOGO_LOCKUP } from '@/assets/brand'
import Sparkle from '@/assets/illustrations/sparkle.svg'
import Star from '@/assets/illustrations/star.svg'
import { PEANUT_SITTING } from '@/assets/mascot'
import { Card } from '@/components/0_Bruddle/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { CreatorPageShell } from '../../CreatorPageShell'
import type { CreatorPageProps } from '../../types'
import { A1_AVATAR_SRC } from './a1/a1-avatar.consts'
import { A1Cta } from './a1/A1Cta'
import { A1InviteLine } from './a1/A1InviteLine'
import { A1Post } from './a1/A1Post'
import { A1Proof } from './a1/A1Proof'
import { A1SampleCopy } from './a1/A1SampleCopy'
import { A1SampleBubble } from './a1/A1SampleBubble'
import { A1SampleRow } from './a1/A1SampleRow'
import { A1StickyCta } from './a1/A1StickyCta'
import { NITA_A1_COPY as copy } from './nita-a1.copy'
import styles from './NitaA1.module.css'

const POINTING_MASCOT_SRC = '/creator-pages/juanacervio/a1-mascot-pointing-down.webp'

/** Nita's page, variant A1: her X post redrawn large, with the store button inside the post. */
export function NitaA1(props: CreatorPageProps) {
    const { proof, sample, steps, close } = copy
    const [accounts, clients, spend] = proof.items

    return (
        <CreatorPageShell
            page={props}
            lang="es-AR"
            className="mx-auto min-h-dvh w-full max-w-120 overflow-x-clip bg-background-page text-foreground-primary"
        >
            <section className="relative border-b-2 border-border-default bg-background-marketing-sky px-4 pt-3 pb-6">
                <div className="flex items-center justify-between gap-2">
                    <Image src={LOGO_LOCKUP} alt={copy.logoAlt} priority className="h-6 w-auto" />
                    <p className="flex items-center gap-2 rounded-full border border-border-button bg-background-default py-1 pr-3 pl-1 text-label-m">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={A1_AVATAR_SRC}
                            width={24}
                            height={24}
                            alt=""
                            className="size-6 rounded-full object-cover"
                        />
                        {copy.chip}
                    </p>
                </div>

                <h1 className={`mt-3 max-w-72 text-heading-m xs:text-heading-l ${styles.besideMascot}`}>
                    {copy.headline}
                </h1>
                <p className={`mt-2 max-w-64 text-body-m-semibold ${styles.besideMascot}`}>{copy.benefit}</p>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={Star.src} alt="" aria-hidden className="absolute top-16 right-6 size-6" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={Sparkle.src} alt="" aria-hidden className="absolute top-28 right-24 size-4" />

                <div className="relative mt-4">
                    <Image
                        src={PEANUT_SITTING}
                        alt=""
                        priority
                        sizes="96px"
                        className={`pointer-events-none absolute right-3 bottom-full -mb-3 h-auto w-24 ${styles.mascot}`}
                    />
                    <A1Post>
                        <A1Cta position="hero" />
                        <A1InviteLine className="text-foreground-secondary" />
                    </A1Post>
                </div>

                <div className="mt-6 text-center text-body-s text-foreground-over-color-secondary">
                    <p className="text-body-s-semibold text-foreground-over-color-primary">{copy.more}</p>
                    <p>{copy.notABank}</p>
                </div>
            </section>

            <section className="px-4 pt-8 pb-10">
                <p className="text-label-m text-foreground-secondary uppercase">{proof.kicker}</p>
                <h2 className="mt-2 text-heading-s">{proof.title}</h2>

                <A1Proof item={accounts} number={1}>
                    <A1SampleRow
                        leading={
                            <A1SampleBubble fillClassName="bg-background-icon-bubble-green">
                                {sample.usdSign}
                            </A1SampleBubble>
                        }
                        title={sample.usd}
                        note={sample.usdNumber}
                        trailing={<A1SampleCopy />}
                    />
                    <A1SampleRow
                        leading={
                            <A1SampleBubble fillClassName="bg-background-icon-bubble-blue">
                                {sample.eurSign}
                            </A1SampleBubble>
                        }
                        title={sample.eur}
                        note={sample.eurNumber}
                        trailing={<A1SampleCopy />}
                    />
                </A1Proof>

                <A1Proof item={clients} number={2}>
                    <A1SampleRow
                        leading={
                            <A1SampleBubble fillClassName="bg-background-icon-bubble-green">
                                <Icon name="arrow-down" size={16} />
                            </A1SampleBubble>
                        }
                        title={sample.received}
                        note={sample.receivedNote}
                        trailing={<span className="text-body-m-semibold">{sample.receivedAmount}</span>}
                    />
                </A1Proof>

                <A1Proof item={spend} number={3}>
                    <A1SampleRow
                        leading={
                            <A1SampleBubble fillClassName="bg-background-icon-bubble-yellow">
                                <Icon name="qr-code" size={16} />
                            </A1SampleBubble>
                        }
                        title={sample.qr}
                        note={sample.qrNote}
                        trailing={
                            <A1SampleBubble fillClassName="bg-background-icon-bubble-green">
                                <Icon name="check" size={16} />
                            </A1SampleBubble>
                        }
                    />
                </A1Proof>
            </section>

            <section className="border-y-2 border-border-default bg-background-accent-yellow px-4 py-8">
                <h2 className="text-heading-xs">{steps.title}</h2>
                <Card shadowSize="4" className="mt-4 border-2 px-4">
                    <ol>
                        {steps.items.map((step, index) => (
                            <li
                                key={step.lead}
                                className="flex items-start gap-3 border-border-disabled py-3 not-first:border-t"
                            >
                                <span
                                    aria-hidden
                                    className="flex size-6 flex-none items-center justify-center rounded-full bg-foreground-primary text-label-m text-foreground-inverse"
                                >
                                    {index + 1}
                                </span>
                                <p className="text-body-m">
                                    <b className="font-extrabold">{step.lead}</b>
                                    {step.rest}
                                </p>
                            </li>
                        ))}
                    </ol>
                </Card>
            </section>

            <section className={`bg-background-marketing-sky px-4 pt-8 text-center ${styles.closeFold}`}>
                <p className="text-heading-m">{close.quote}</p>
                <p className="mt-2 text-body-s-semibold">{close.by}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={POINTING_MASCOT_SRC}
                    width={256}
                    height={256}
                    alt=""
                    loading="lazy"
                    className="mx-auto mt-2 size-28"
                />
                <A1Cta position="footer" />
                <A1InviteLine className="text-foreground-over-color-secondary" />
                <p className="mt-6 text-left text-body-xs text-foreground-over-color-secondary">
                    <b className="font-extrabold text-foreground-over-color-primary">{copy.notABank}</b>
                    {close.legal}
                </p>
            </section>

            <A1StickyCta />
        </CreatorPageShell>
    )
}
