import mantecaIphone from '@/assets/iphone-ss/manteca_ss.webp'
import Image from 'next/image'
import MERCADO_PAGO_ICON from '@/assets/icons/mercado-pago-logo.svg'
import PIX_ICON from '@/assets/icons/pix-logo.svg'
import FLAG_AR from '@/assets/illustrations/flag-ar.svg'
import FLAG_BR from '@/assets/illustrations/flag-br.svg'
import Star from '@/assets/illustrations/star.svg'
import { PartnerLockup } from './PartnerLockup'
import { CloudsCss } from './CloudsCss'
import { AnimateOnView } from '@/components/Global/AnimateOnView'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'

const starConfigs = [
    { className: 'absolute left-12 top-10', delay: '0.2s', rotate: '22deg' },
    { className: 'absolute left-56 top-1/2', delay: '0.2s', rotate: '22deg' },
    { className: 'absolute bottom-20 left-20', delay: '0.2s', rotate: '22deg' },
    { className: 'absolute -top-16 right-20 md:top-58', delay: '0.6s', rotate: '22deg' },
    { className: 'absolute bottom-20 right-44', delay: '0.6s', rotate: '22deg' },
]

// Cream default; the homepage passes blue instead — there it follows
// RegulatedRails, which is already cream.
const DEFAULT_BG_COLOR = '#F9F4F0'

const Manteca = ({
    locale = DEFAULT_LOCALE,
    backgroundColor = DEFAULT_BG_COLOR,
}: {
    locale?: Locale
    backgroundColor?: string
}) => {
    const i18n = getTranslations(locale)

    return (
        <section
            id="qr-pay"
            className="relative overflow-hidden py-20 text-n-1 md:min-h-[850px] lg:min-h-[750px]"
            style={{ backgroundColor }}
        >
            <div className="hidden md:block">
                <CloudsCss />
            </div>

            <div className="hidden md:block">
                {starConfigs.map((config, index) => (
                    <AnimateOnView
                        key={index}
                        className={config.className}
                        delay={config.delay}
                        x="5px"
                        rotate={config.rotate}
                    >
                        <Image src={Star} alt="" width={50} height={50} />
                    </AnimateOnView>
                ))}
            </div>

            <div className="relative flex flex-col items-center justify-center px-4">
                <h1 className="font-roboto-flex-extrabold text-center text-[4rem] font-extraBlack md:text-left lg:text-headingMedium">
                    {i18n.landingPayLocalHeading}
                </h1>

                <h2 className="font-roboto-flex mt-6 text-center text-xl md:text-5xl">
                    {i18n.landingPayLocalSubheading}
                </h2>

                <h3 className="font-roboto-flex mt-6 text-center text-xl md:text-2xl">{i18n.landingPayLocalBody}</h3>
            </div>

            <div className="relative mx-auto mt-8 flex flex-col items-center gap-8 md:mt-12 md:flex-row md:justify-center md:gap-20 lg:gap-36">
                {/* On mobile the two lockups sit side by side above the phone, so the
                    sticky CTA covers the screenshot rather than either link. `md:contents`
                    drops this wrapper on desktop so they flank the phone instead. */}
                <div className="flex justify-center gap-6 md:contents">
                    <PartnerLockup
                        className="md:order-1"
                        flag={FLAG_AR}
                        flagAlt="Argentina"
                        logo={MERCADO_PAGO_ICON}
                        logoAlt="Mercado Pago"
                        logoClassName="w-[108px] md:w-[150px]"
                        href={`/${locale}/pay-with/mercadopago`}
                        ariaLabel={i18n.landingMercadoPagoAria}
                        learnMore={i18n.landingLearnMore}
                    />
                    <PartnerLockup
                        className="md:order-3"
                        flag={FLAG_BR}
                        flagAlt="Brazil"
                        logo={PIX_ICON}
                        logoAlt="PIX"
                        logoClassName="w-[95px] md:w-[132px]"
                        href={`/${locale}/pay-with/pix`}
                        ariaLabel={i18n.landingPixAria}
                        learnMore={i18n.landingLearnMore}
                    />
                </div>

                <Image src={mantecaIphone} alt="Mercado pago payment" width={250} height={250} className="md:order-2" />
            </div>
        </section>
    )
}

export default Manteca
