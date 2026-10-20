import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'
import { SelfCustodyPasskeyGlyph } from './SelfCustodyPasskeyGlyph'

// CSS-only so the server render already holds the start frame: no flash on
// hydration, it still plays without JS, and reduced motion keeps the sheet at rest.
const SHEET_KEYFRAMES = '@keyframes sc-sheet-up{from{transform:translateY(110%)}}'

// Short phones (max-md and max-height 680px, e.g. 320x568): even at the shared
// .psh-art-fit zoom this is the tallest hero art, so the `max-md:[@media...]`
// classes drop the balance row and tighten the sheet to keep the hero CTA
// 16px or more clear of the first screen's bottom. Written out in full so Tailwind picks them up.

/** Hero art: a drawn send screen; the passkey sheet slides up once on load. */
export function SelfCustodySendScreen() {
    return (
        <PhoneFrame screen="white" className="max-w-72">
            <div className="flex items-center justify-between text-label-m text-foreground-secondary max-md:[@media(max-height:680px)]:hidden">
                <span>Send</span>
                <span>Balance $1,240.00</span>
            </div>
            <div className="mt-1 flex items-center gap-2 rounded-sm border border-border-default p-2 text-label-l max-md:[@media(max-height:680px)]:mt-0">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-avatar-pink-border bg-avatar-pink text-body-xs text-avatar-pink-foreground">
                    AR
                </span>
                Ana Ríos
                <span className="ml-auto text-body-xs text-foreground-secondary">@anarios</span>
            </div>
            <p className="font-roboto-flex-extrabold my-3 text-center text-heading-l max-md:[@media(max-height:680px)]:my-1.5">
                $120.00
            </p>
            <div className="rounded-full border-2 border-border-default bg-background-brand py-2 text-center text-label-l">
                Send
            </div>
            <style>{SHEET_KEYFRAMES}</style>
            <div className="-mx-3 mt-4 -mb-3 grid justify-items-center gap-2 rounded-t-sm border-t border-border-disabled bg-background-disabled px-4 py-6 text-center motion-safe:animate-[sc-sheet-up_0.6s_var(--ease-spring)_0.3s_both] max-md:[@media(max-height:680px)]:mt-2 max-md:[@media(max-height:680px)]:gap-1 max-md:[@media(max-height:680px)]:py-2">
                <SelfCustodyPasskeyGlyph />
                <p className="text-body-m-semibold">Use your passkey?</p>
                <div className="w-full rounded-sm border-2 border-border-default bg-background-icon-bubble-blue py-3 text-body-m-semibold text-foreground-primary max-md:[@media(max-height:680px)]:py-2">
                    Continue
                </div>
            </div>
        </PhoneFrame>
    )
}
