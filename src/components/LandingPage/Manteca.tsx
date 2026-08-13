import mantecaIphone from '@/assets/iphone-ss/manteca_ss.webp'
import Image from 'next/image'
import Link from 'next/link'
import MEPA_ARGENTINA_LOGO from '@/assets/logos/mepa-arg.svg'
import PIX_BRZ_LOGO from '@/assets/logos/pix-brz.svg'
import Star from '@/assets/illustrations/star.svg'
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

// Cream, as on /quests. The homepage passes blue instead — there it follows
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

            {/* Mobile layout */}
            <div className="mt-4 flex flex-col items-center justify-center gap-4 md:hidden">
                <Image src={mantecaIphone} alt="Mercado pago payment" width={250} height={250} />

                <div className="flex gap-8">
                    <Link href={`/${locale}/pay-with/mercadopago`} aria-label={i18n.landingMercadoPagoAria}>
                        <Image src={MEPA_ARGENTINA_LOGO} alt="Mepa Argentina" width={100} height={100} />
                    </Link>
                    <Link href={`/${locale}/pay-with/pix`} aria-label={i18n.landingPixAria}>
                        <Image src={PIX_BRZ_LOGO} alt="Pix Brz" width={100} height={100} />
                    </Link>
                </div>
            </div>

            {/* Desktop layout */}
            <div className="mx-auto mt-12 hidden flex-col items-center justify-center gap-8 md:flex">
                <div className="flex items-center justify-center gap-20 lg:gap-36">
                    <Link href={`/${locale}/pay-with/mercadopago`} aria-label={i18n.landingMercadoPagoAria}>
                        <Image src={MEPA_ARGENTINA_LOGO} alt="Mepa Argentina" width={170} height={170} />
                    </Link>
                    <Image src={mantecaIphone} alt="Mercado pago payment" width={250} height={250} />
                    <Link href={`/${locale}/pay-with/pix`} aria-label={i18n.landingPixAria}>
                        <Image src={PIX_BRZ_LOGO} alt="Pix Brazil" width={170} height={170} />
                    </Link>
                </div>

                <p className="font-roboto-flex text-center text-sm opacity-70">{i18n.landingPayLocalSettles}</p>
            </div>

            <p className="font-roboto-flex relative mt-12 text-center text-sm opacity-70 md:hidden">
                {i18n.landingPayLocalSettles}
            </p>
        </section>
    )
}

export default Manteca
