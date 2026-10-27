import Link from 'next/link'
import MercadoPagoIcon from '@/assets/payment-apps/mercado-pago.svg'
import PixIcon from '@/assets/payment-apps/pix.svg'
import { Band } from '@/components/Marketing/StarLp/Band'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { TillSticker } from '@/components/Marketing/StarLp/TillSticker'
import { QrArgentinaScanFrame } from '@/components/Marketing/StarLp/pages/QrArgentinaScanFrame'
import type { HomePayLocalFoldProps } from './homeFolds.types'
import { homePayLocalHrefs, leadWithLinks } from './homePayLocal.utils'

/** The sticker link: no tab stop and hidden from assistive tech, because the lead's links go to the same pages.
    Widths keep frame + two stickers inside the column from 320 up (half columns from md). */
const STICKER_LINK_CLASS = 'group block w-28 text-center text-foreground-primary xs:w-36 md:w-32 lg:w-40 xl:w-48'

const CAPTION_CLASS = 'mt-2 block text-body-s-semibold underline decoration-2 underline-offset-4'

/**
 * f7: the Mercado Pago and Pix till stickers inside the app's scanner frame
 * (no scan line: review), beside "Pay like a local." Each sticker and its
 * country caption lead to that country's QR page (the English star LP on
 * the English home, the localized pay-with page elsewhere). The sticker lines stay in
 * the till's language in every locale. Art first from md; stacked, the title
 * comes first.
 */
export function HomePayLocalFold({ strings, locale }: HomePayLocalFoldProps) {
    const hrefs = homePayLocalHrefs(locale)
    return (
        <Band ground="yellow" id="home-pay-local">
            <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
                <div className="md:order-last">
                    <SectionTitle>{strings.heading}</SectionTitle>
                    <p className="mt-6 text-body-l">{leadWithLinks(strings.lead, strings, hrefs)}</p>
                </div>
                <QrArgentinaScanFrame scanLine={false} className="mt-0 w-fit p-4 md:w-fit lg:p-6 xl:p-8">
                    <div className="flex items-start gap-3 xs:gap-4 lg:gap-6 xl:gap-8">
                        <Link
                            href={hrefs.argentina}
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
                            href={hrefs.brazil}
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
