import { Icon } from '@/components/Global/Icons/Icon'
import { ChatBubble } from '@/components/Marketing/StarLp/ChatBubble'
import { LinkPreviewBubble } from '@/components/Marketing/StarLp/LinkPreviewBubble'
import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'
import { StorySequence } from '@/components/Marketing/StarLp/StorySequence'

/** A client asks where to pay, the request link lands, the client pays. Plays once in view. */
export function UsEuRequestChat() {
    return (
        <PhoneFrame
            className="md:max-w-sm"
            label="Chat: Marta asks where to send $250; you reply with a Peanut request link; Marta paid"
        >
            <p className="border-b border-border-subtle pb-2 text-center text-body-s-semibold">Marta · Studio Norte</p>
            <StorySequence
                className="flex flex-col gap-2"
                beatClassName="flex flex-col"
                beats={[
                    <ChatBubble key="ask" side="them" author="Marta">
                        Where do I send the $250?
                    </ChatBubble>,
                    <LinkPreviewBubble
                        key="link"
                        caption="valentina is requesting"
                        amount="$250"
                        url="peanut.me/valentina/…"
                    />,
                    <ChatBubble key="paid" side="them" author="Marta">
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
