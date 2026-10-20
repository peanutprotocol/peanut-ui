import { Icon } from '@/components/Global/Icons/Icon'
import { ChatBubble } from '@/components/Marketing/StarLp/ChatBubble'
import { LinkPreviewBubble } from '@/components/Marketing/StarLp/LinkPreviewBubble'
import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'
import { StorySequence } from '@/components/Marketing/StarLp/StorySequence'

/**
 * The trip's group chat after the asado: one request link lands and a friend
 * pays it. Names and the amount are illustrative; the preview text matches
 * the app's link preview ("is requesting").
 */
export function QrArgentinaGroupChat() {
    return (
        <PhoneFrame
            className="max-w-[19.5rem] shadow-[6px_6px_0_var(--color-pink-500)]"
            label="Group chat: one Peanut request link for $12.60 for the asado, and a friend has paid it"
        >
            <p className="border-b-2 border-border-disabled pb-2 text-center text-label-l">Trip crew · 6</p>
            <StorySequence
                className="flex flex-col gap-2"
                beatClassName="flex flex-col"
                beats={[
                    <ChatBubble key="ask" side="them" author="Lena">
                        Who paid for the asado??
                    </ChatBubble>,
                    <ChatBubble key="me" side="me">
                        Me, by QR. Link below
                    </ChatBubble>,
                    <LinkPreviewBubble
                        key="link"
                        caption="valen is requesting"
                        amount="$12.60"
                        url="peanut.me/valen/…"
                    />,
                    <ChatBubble key="paid" side="them" author="Tom">
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
