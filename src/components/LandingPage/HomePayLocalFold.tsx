import Link from 'next/link'
import MercadoPagoIcon from '@/assets/payment-apps/mercado-pago.svg'
import PixIcon from '@/assets/payment-apps/pix.svg'
import { Band } from '@/components/Marketing/StarLp/Band'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { TillSticker } from '@/components/Marketing/StarLp/TillSticker'
import { QrArgentinaScanFrame } from '@/components/Marketing/StarLp/pages/QrArgentinaScanFrame'
import { getStarLpLink } from '@/components/Marketing/StarLp/starLpNavigation'
import type { HomePayLocalFoldProps } from './homeFolds.types'
import { HOME_STICKER_CAPTION_CLASS, HOME_STICKER_LINK_CLASS } from './homeFolds.consts'
import { HomePayLocalLead } from './HomePayLocalLead'
import { homePayLocalHrefs } from './homePayLocal.utils'

/**
 * f7: the Mercado Pago and Pix till stickers inside the app's scanner frame
 * (one scan and a detected pulse), beside "Pay like a local." Each sticker and its
 * country caption lead to that country's QR star page. The sticker lines stay in
 * the till's language in every locale. Art first from md; stacked, the title
 * comes first.
 */
export function HomePayLocalFold({ strings, locale }: HomePayLocalFoldProps) {
    const hrefs = homePayLocalHrefs(locale)
    const { languageLabel } = getStarLpLink('qrArgentina', locale)
    return (
        <Band ground="yellow" id="home-pay-local">
            <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
                <div className="md:order-last">
                    <SectionTitle>{strings.heading}</SectionTitle>
                    <p className="mt-6 text-body-l">
                        <HomePayLocalLead
                            lead={strings.lead}
                            names={strings}
                            hrefs={hrefs}
                            languageLabel={languageLabel}
                        />
                    </p>
                </div>
                <QrArgentinaScanFrame className="mt-0 w-fit p-4 md:w-fit lg:p-6 xl:p-8">
                    <div className="flex items-start gap-3 xs:gap-4 lg:gap-6 xl:gap-8">
                        <Link
                            href={hrefs.argentina}
                            hrefLang="en"
                            tabIndex={-1}
                            aria-hidden
                            className={`${HOME_STICKER_LINK_CLASS} -rotate-3`}
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
                            <span className={HOME_STICKER_CAPTION_CLASS}>{strings.argentina}</span>
                        </Link>
                        <Link
                            href={hrefs.brazil}
                            hrefLang="en"
                            tabIndex={-1}
                            aria-hidden
                            className={`${HOME_STICKER_LINK_CLASS} mt-4 rotate-[2.5deg]`}
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
                            <span className={HOME_STICKER_CAPTION_CLASS}>{strings.brazil}</span>
                        </Link>
                    </div>
                </QrArgentinaScanFrame>
            </div>
        </Band>
    )
}
