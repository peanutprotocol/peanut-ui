import Link from 'next/link'
import type { ReactNode } from 'react'
import MercadoPagoIcon from '@/assets/payment-apps/mercado-pago.svg'
import PixIcon from '@/assets/payment-apps/pix.svg'
import { Band } from '@/components/Marketing/StarLp/Band'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { TillSticker } from '@/components/Marketing/StarLp/TillSticker'
import { QrArgentinaScanFrame } from '@/components/Marketing/StarLp/pages/QrArgentinaScanFrame'
import type { HomePayLocalFoldProps } from './homeFolds.types'

const LEAD_LINK_CLASS = 'font-bold underline decoration-2 underline-offset-4'

/** The sticker link: no tab stop and hidden from assistive tech, because the lead's links go to the same pages.
    Widths keep frame + two stickers inside the column from 320 up (half columns from md). */
const STICKER_LINK_CLASS = 'group block w-28 text-center text-foreground-primary xs:w-36 md:w-32 lg:w-40 xl:w-48'

const CAPTION_CLASS = 'mt-2 block text-body-s-semibold underline decoration-2 underline-offset-4'

/** Splits the lead at its `{argentina}` and `{brazil}` slots and links each country to its QR page. */
function leadWithLinks(lead: string, argentina: string, brazil: string): ReactNode[] {
    return lead.split(/(\{argentina\}|\{brazil\})/).map((part, i) => {
        if (part === '{argentina}')
            return (
                <Link key={i} href={STAR_LP_ROUTES.qrArgentina} className={LEAD_LINK_CLASS}>
                    {argentina}
                </Link>
            )
        if (part === '{brazil}')
            return (
                <Link key={i} href={STAR_LP_ROUTES.qrBrazil} className={LEAD_LINK_CLASS}>
                    {brazil}
                </Link>
            )
        return part
    })
}

/**
 * f7: the Mercado Pago and Pix till stickers inside the app's scanner frame
 * (no scan line: review), beside "Pay like a local." Each sticker and its
 * country caption lead to that country's QR page. The sticker lines stay in
 * the till's language in every locale. Art first from md; stacked, the title
 * comes first.
 */
export function HomePayLocalFold({ strings, locale }: HomePayLocalFoldProps) {
    return (
        <Band ground="yellow" id="home-pay-local">
            <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
                <div className="md:order-last">
                    <SectionTitle>{strings.heading}</SectionTitle>
                    <p className="mt-6 text-body-l">{leadWithLinks(strings.lead, strings.argentina, strings.brazil)}</p>
                </div>
                <QrArgentinaScanFrame scanLine={false} className="mt-0 w-fit p-4 md:w-fit lg:p-6 xl:p-8">
                    <div className="flex items-start gap-3 xs:gap-4 lg:gap-6 xl:gap-8">
                        <Link
                            href={STAR_LP_ROUTES.qrArgentina}
                            tabIndex={-1}
                            aria-hidden
                            className={`${STICKER_LINK_CLASS} -rotate-3`}
                        >
                            <TillSticker
                                mark={MercadoPagoIcon}
                                markAlt="Mercado Pago"
                                label="Pagá con QR"
                                lang="es-AR"
                                campaign="qr-argentina"
                                slot="home-sticker"
                                qrContext={{ page: 'home', placement: 'pay-local-ar', locale }}
                            />
                            <span className={CAPTION_CLASS}>{strings.argentina}</span>
                        </Link>
                        <Link
                            href={STAR_LP_ROUTES.qrBrazil}
                            tabIndex={-1}
                            aria-hidden
                            className={`${STICKER_LINK_CLASS} mt-4 rotate-[2.5deg]`}
                        >
                            <TillSticker
                                mark={PixIcon}
                                markAlt="Pix"
                                label="Pague com Pix"
                                lang="pt-BR"
                                campaign="qr-brazil"
                                slot="home-sticker"
                                qrContext={{ page: 'home', placement: 'pay-local-br', locale }}
                            />
                            <span className={CAPTION_CLASS}>{strings.brazil}</span>
                        </Link>
                    </div>
                </QrArgentinaScanFrame>
            </div>
        </Band>
    )
}
