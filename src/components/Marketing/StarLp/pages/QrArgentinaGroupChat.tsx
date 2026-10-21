import Link from 'next/link'
import { Icon } from '@/components/Global/Icons/Icon'
import { ChatBubble } from '@/components/Marketing/StarLp/ChatBubble'
import { LinkPreviewBubble } from '@/components/Marketing/StarLp/LinkPreviewBubble'
import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'
import { StorySequence } from '@/components/Marketing/StarLp/StorySequence'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { STAR_LP_PERSONA, STAR_LP_REQUEST_LINK_TEXT } from '@/components/Marketing/StarLp/starLpPersonas.consts'
import { qrArDinnerShareUsd } from './qrArgentinaChat.utils'
import type { QrArgentinaGroupChatProps } from './qrArgentina.types'

const { main, payer, friend } = STAR_LP_PERSONA

/**
 * The trip's group chat after the asado: one request link lands and a friend
 * pays it. The asado is the purchase paid by QR above (Parrilla La Esquina), so
 * the request is one diner's share of that bill in dollars, at the page's rate
 * (no figure when the page has no rate).
 * The preview text matches the app's link preview ("is requesting"). The link
 * opens the request-links page, which explains this object, and only once it
 * has appeared. It is the page's only route there, so it is a real, labelled,
 * focusable link for keyboard and screen-reader users too.
 */
export function QrArgentinaGroupChat({ usdArs }: QrArgentinaGroupChatProps) {
    const share = qrArDinnerShareUsd(usdArs)
    return (
        // From lg the phone scales up as a whole (zoom), so the app-size chat text grows with it.
        // The pink shadow stays: the DS black hard shadow does not show on the black fold.
        <PhoneFrame
            className="max-w-[19.5rem] shadow-[6px_6px_0_var(--color-pink-500)] lg:[zoom:1.35]"
            interactive
            label={`Group chat: ${main.short} paid the asado by QR and sends one Peanut request link for ${share ? `${share} each` : 'each share'}, and ${payer.short} has paid it`}
        >
            <p className="border-b-2 border-border-disabled pb-2 text-center text-label-l">Trip crew · 6</p>
            <StorySequence
                className="flex flex-col gap-2"
                beatClassName="flex flex-col"
                beats={[
                    <ChatBubble key="ask" side="them" author={friend.short}>
                        Who paid for the asado??
                    </ChatBubble>,
                    <ChatBubble key="me" side="me">
                        Me, by QR. Link below
                    </ChatBubble>,
                    <Link
                        key="link"
                        href={STAR_LP_ROUTES.requestLinks}
                        prefetch={false}
                        aria-label="See how request links work"
                        className="qr-ar-chat-link flex flex-col rounded-card focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-action-focus [[data-shown=false]_&]:pointer-events-none"
                    >
                        <LinkPreviewBubble
                            caption={`${main.username} is requesting`}
                            amount={share ?? undefined}
                            url={STAR_LP_REQUEST_LINK_TEXT}
                        />
                    </Link>,
                    <ChatBubble key="paid" side="them" author={payer.short}>
                        <span className="flex items-center gap-1">
                            Paid
                            <Icon name="check" size={16} />
                        </span>
                    </ChatBubble>,
                ]}
            />
        </PhoneFrame>
    )
}
