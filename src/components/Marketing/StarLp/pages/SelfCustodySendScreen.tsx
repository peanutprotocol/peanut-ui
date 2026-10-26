import Image from 'next/image'
import sendCapture from '@/assets/star-lp/self-custody-send.webp'
import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'
import { SelfCustodyAppLink } from './SelfCustodyAppLink'
import { SelfCustodyPasskeyGlyph } from './SelfCustodyPasskeyGlyph'

// CSS, so the server render already holds the start frame: no flash on
// hydration, it still plays without JS, and reduced motion shows the end frame
// (sheet up, no press, no scan). Beats, once: Send is pressed (0.9s), the
// passkey sheet rises (1.1s), a scan line sweeps the face mark (1.8s), the mark
// pulses (2.5s). It ends on "Continue": nothing is ever sent.
const BEAT_KEYFRAMES = [
    '@keyframes sc-press{50%{opacity:.14;transform:scale(.96)}}',
    '@keyframes sc-sheet-up{from{transform:translateY(110%)}}',
    '@keyframes sc-scan{0%{opacity:1;transform:translateY(-4px)}80%{opacity:1}100%{opacity:0;transform:translateY(34px)}}',
    '@keyframes sc-glyph-beat{40%{transform:scale(1.22)}70%{transform:scale(.94)}}',
].join('')

/**
 * Hero art: the app's real send screen (fixture `send`, recipient set to the
 * page's payer persona). The passkey sheet is OS UI, so it stays drawn. The
 * phone leads where the CTA leads (signup, where the passkey is made).
 * From md the screen is wider and cut just under the amount card, and the
 * sheet is one row, so the art grows without pushing the CTA out of the first
 * screen; the cut-off Send button takes no press there.
 */
export function SelfCustodySendScreen() {
    return (
        <SelfCustodyAppLink className="mx-auto w-full max-w-80 md:max-w-[30rem] lg:max-w-[35rem]">
            <PhoneFrame className="max-w-none transition-shadow duration-instant group-active:shadow-none">
                <div className="relative -m-3 overflow-hidden md:aspect-[780/580] lg:aspect-[780/560]">
                    <style>{BEAT_KEYFRAMES}</style>
                    <Image
                        src={sendCapture}
                        alt=""
                        sizes="(min-width: 1024px) 560px, (min-width: 768px) 480px, 80vw"
                        className="h-auto w-full"
                        priority
                    />
                    {/* the press on the capture's "Send with Peanut" button */}
                    <span
                        aria-hidden
                        className="absolute inset-x-[4%] bottom-[2%] h-[11.5%] rounded-full bg-foreground-primary opacity-0 motion-safe:animate-[sc-press_180ms_ease-out_0.9s_both] md:hidden"
                    />
                    {/* The sheet is set in px while the capture scales: below md it is packed tight,
                        from md it is one row, so its top edge stays under the capture's balance line. */}
                    <div className="absolute inset-x-0 bottom-0 grid justify-items-center gap-1 rounded-t-sm border-t border-border-disabled bg-background-disabled px-4 pt-2 pb-2 text-center motion-safe:animate-[sc-sheet-up_0.6s_var(--ease-spring)_1.1s_both] md:flex md:items-center md:gap-3 md:py-3 md:text-left">
                        <span className="relative inline-block overflow-hidden motion-safe:animate-[sc-glyph-beat_0.5s_var(--ease-spring)_2.5s_both]">
                            <SelfCustodyPasskeyGlyph className="h-8 w-8" />
                            <span
                                aria-hidden
                                className="absolute inset-x-0 top-0 h-0.5 bg-background-brand opacity-0 motion-safe:animate-[sc-scan_0.7s_ease-in-out_1.8s_both]"
                            />
                        </span>
                        <p className="text-body-m-semibold md:flex-1">Use your passkey?</p>
                        <div className="w-full rounded-sm border-2 border-border-default bg-background-icon-bubble-blue py-2 text-center text-body-m-semibold text-foreground-primary md:w-auto md:px-8">
                            Continue
                        </div>
                    </div>
                </div>
            </PhoneFrame>
        </SelfCustodyAppLink>
    )
}
