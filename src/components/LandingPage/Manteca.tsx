import mantecaIphone from '@/assets/iphone-ss/manteca_ss.png'
import Image from 'next/image'
import { MEPA_ARGENTINA_LOGO, PIX_BRZ_LOGO, Star } from '@/assets'
import { CloudsCss } from './CloudsCss'
import { AnimateOnView } from '@/components/Global/AnimateOnView'

const starConfigs = [
    { className: 'absolute left-12 top-10', delay: '0.2s', rotate: '22deg' },
    { className: 'absolute left-56 top-1/2', delay: '0.2s', rotate: '22deg' },
    { className: 'absolute bottom-20 left-20', delay: '0.2s', rotate: '22deg' },
    { className: 'absolute -top-16 right-20 md:top-58', delay: '0.6s', rotate: '22deg' },
    { className: 'absolute bottom-20 right-44', delay: '0.6s', rotate: '22deg' },
]

const Manteca = () => {
    return (
        <section
            id="qr-pay"
            className="relative overflow-hidden py-20 text-n-1 md:h-[850px] lg:h-[750px]"
            style={{ backgroundColor: '#F9F4F0' }}
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
                        <img src={Star.src} alt="" width={50} height={50} />
                    </AnimateOnView>
                ))}
            </div>

            <div className="relative flex flex-col items-center justify-center px-4">
                <h1 className="font-roboto-flex-extrabold text-center text-[4rem] font-extraBlack md:text-left lg:text-headingMedium">
                    SCAN. PAY. DONE.
                </h1>

                <h2 className="font-roboto-flex mt-6 text-center text-xl md:text-5xl">
                    PAY INSTANTLY IN <b>ARGENTINA</b> AND <b>BRAZIL</b>.
                </h2>

                <h2 className="font-roboto-flex mt-6 text-center text-xl md:text-4xl">
                    JUST SCAN LOCAL QR CODES. NO BANK DETAILS NEEDED.
                </h2>

                <h3 className="font-roboto-flex mt-6 text-center text-xl md:text-xl">
                    up to <b>~15% cheaper</b> than Visa & Mastercard.
                </h3>
            </div>

            {/* Mobile layout */}
            <div className="mt-4 flex flex-col items-center justify-center gap-4 md:hidden">
                <Image src={mantecaIphone} alt="Mercado pago payment" width={250} height={250} />

                <div className="flex gap-8">
                    <Image src={MEPA_ARGENTINA_LOGO} alt="Mepa Argentina" width={100} height={100} />
                    <Image src={PIX_BRZ_LOGO} alt="Pix Brz" width={100} height={100} />
                </div>
            </div>

            {/* Desktop layout */}
            <div className="absolute -bottom-24 left-1/2 mx-auto hidden -translate-x-1/2 items-center justify-center gap-20 md:flex lg:gap-36">
                <Image src={MEPA_ARGENTINA_LOGO} alt="Mepa Argentina" width={170} height={170} />
                <Image src={mantecaIphone} alt="Mercado pago payment" width={250} height={250} />
                <Image src={PIX_BRZ_LOGO} alt="Pix Brazil" width={170} height={170} />
            </div>
        </section>
    )
}

export default Manteca
