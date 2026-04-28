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
            className="relative overflow-hidden py-20 text-n-1 md:min-h-[850px] lg:min-h-[750px]"
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
                    PAY LIKE A LOCAL.
                </h1>

                <h2 className="font-roboto-flex mt-6 text-center text-xl md:text-5xl">
                    RECEIVE FROM ANYWHERE. NO LOCAL ID NEEDED.
                </h2>

                <h3 className="font-roboto-flex mt-6 text-center text-xl md:text-2xl">
                    Pay MercadoPago QR in Argentina. Send PIX in Brazil. Just your passport.
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
            <div className="mx-auto mt-12 hidden flex-col items-center justify-center gap-8 md:flex">
                <div className="flex items-center justify-center gap-20 lg:gap-36">
                    <Image src={MEPA_ARGENTINA_LOGO} alt="Mepa Argentina" width={170} height={170} />
                    <Image src={mantecaIphone} alt="Mercado pago payment" width={250} height={250} />
                    <Image src={PIX_BRZ_LOGO} alt="Pix Brazil" width={170} height={170} />
                </div>

                <p className="font-roboto-flex text-center text-sm opacity-70">
                    Settles in digital dollars at the real exchange rate.
                </p>
            </div>

            <p className="font-roboto-flex relative mt-12 text-center text-sm opacity-70 md:hidden">
                Settles in digital dollars at the real exchange rate.
            </p>
        </section>
    )
}

export default Manteca
