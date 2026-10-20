import { Icon } from '@/components/Global/Icons/Icon'
import { ChatBubble } from '@/components/Marketing/StarLp/ChatBubble'
import { LinkPreviewBubble } from '@/components/Marketing/StarLp/LinkPreviewBubble'
import { PhoneFrame } from '@/components/Marketing/StarLp/PhoneFrame'
import { StorySequence } from '@/components/Marketing/StarLp/StorySequence'
import { STAR_LP_PERSONA, STAR_LP_REQUEST_LINK_TEXT } from '@/components/Marketing/StarLp/starLpPersonas.consts'
import { US_EU_REQUEST_HREF } from './usEuAccounts.consts'
import { UsEuAppLink } from './UsEuAppLink'

const { main, payer } = STAR_LP_PERSONA

/**
 * A client asks where to pay, the request link lands, the client types, then
 * pays. Plays once in view. The link preview leads where the fold's CTA leads
 * (make a request link); the CTA is the keyboard path.
 */
export function UsEuRequestChat() {
    return (
        <PhoneFrame
            className="md:max-w-sm"
            label={`Chat: ${payer.short} asks where to send $250; you reply with a Peanut request link; ${payer.short} paid`}
        >
            <p className="border-b border-border-subtle pb-2 text-center text-body-s-semibold">{payer.name}</p>
            <StorySequence
                className="flex flex-col gap-2"
                beatClassName="flex flex-col"
                beats={[
                    <ChatBubble key="ask" side="them" author={payer.short}>
                        Where do I send the $250?
                    </ChatBubble>,
                    <UsEuAppLink
                        key="link"
                        href={US_EU_REQUEST_HREF.guest}
                        signedInHref={US_EU_REQUEST_HREF.signedIn}
                        className="flex origin-bottom-right flex-col motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:hover:-rotate-1 motion-safe:active:scale-[0.96]"
                    >
                        <LinkPreviewBubble
                            caption={`${main.username} is requesting`}
                            amount="$250"
                            url={STAR_LP_REQUEST_LINK_TEXT}
                        />
                    </UsEuAppLink>,
                    // The slot keeps the reply's height; the typing bubble overlays it until the reply shows.
                    <div key="paid" className="star-lp-typing-slot relative flex flex-col">
                        <div className="star-lp-typing-reply flex flex-col">
                            <ChatBubble side="them" author={payer.short}>
                                <span className="flex items-center gap-1">
                                    Paid
                                    <span className="star-lp-check-pop inline-flex">
                                        <Icon name="check" size={16} />
                                    </span>
                                </span>
                            </ChatBubble>
                        </div>
                        <div className="star-lp-typing absolute inset-x-0 top-0 flex flex-col">
                            <ChatBubble side="them" author={payer.short}>
                                <span className="flex h-5 items-center gap-1">
                                    <span className="star-lp-typing-dot h-1.5 w-1.5 rounded-full bg-foreground-secondary" />
                                    <span className="star-lp-typing-dot h-1.5 w-1.5 rounded-full bg-foreground-secondary" />
                                    <span className="star-lp-typing-dot h-1.5 w-1.5 rounded-full bg-foreground-secondary" />
                                </span>
                            </ChatBubble>
                        </div>
                    </div>,
                ]}
            />
        </PhoneFrame>
    )
}
