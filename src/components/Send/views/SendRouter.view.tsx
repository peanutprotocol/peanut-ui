'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import PIX from '@/assets/payment-apps/pix.svg'
import LinkSendFlowManager from '../link/LinkSendFlowManager'
import NavHeader from '@/components/Global/NavHeader'
import Card from '@/components/Global/Card'
import { Button } from '@/components/0_Bruddle/Button'
import Divider from '@/components/0_Bruddle/Divider'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ACTION_METHODS, type PaymentMethod } from '@/constants/actionlist.consts'
import Image from 'next/image'
import { useGeoFilteredPaymentOptions } from '@/hooks/useGeoFilteredPaymentOptions'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useMemo } from 'react'
import ContactsView from './Contacts.view'
import { ValidatedUsernameWrapper } from '@/components/Username/ValidatedUsernameWrapper'
import { DirectSendPageWrapper } from '@/features/payments/flows/direct-send/DirectSendPageWrapper'
import { isAddress } from 'viem'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'

// Lazy — only needed for address/ENS recipients, and pulls the heavy
// TokenSelector → wagmi config graph. Static-importing it bloats the common
// username path and breaks jest suites that don't mock that graph.
const SemanticRequestPageWrapper = dynamic(
    () =>
        import('@/features/payments/flows/semantic-request/SemanticRequestPageWrapper').then(
            (m) => m.SemanticRequestPageWrapper
        ),
    { ssr: false }
)

export const SendRouterView = () => {
    const t = useTranslations('send')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const searchParams = useSearchParams()
    const isSendingByLink = searchParams.get('view') === 'link' || searchParams.get('createLink') === 'true'
    const isSendingToContacts = searchParams.get('view') === 'contacts'
    // direct send to a specific user — supports both:
    // - query param: /send?recipient=kushagra (preferred for native navigation)
    // - path segment: /send/kushagra (from deep links, SPA fallback serves /send page)
    const recipientFromQuery = searchParams.get('recipient')
    const recipientFromPath =
        typeof window !== 'undefined' && window.location.pathname.startsWith('/send/')
            ? decodeURIComponent(window.location.pathname.replace('/send/', '').split('/')[0])
            : null
    const recipientUsername = recipientFromQuery || recipientFromPath || null
    const { resetWithdrawFlow } = useWithdrawFlow()
    const goBack = useSafeBack('/home')
    // replace, not push: a pushed fallback would mint a history entry that the
    // base view's own safe-back then walks right back into the subview (loop)
    const goBackToBase = useSafeBack('/send', { replace: true })

    const redirectToSendByLink = () => {
        router.push(`${window.location.pathname}?view=link`)
    }

    const handlePrev = () => {
        // sub-views (link or contacts) go back to the base send page; the base
        // view goes back through in-app history (fallback: home)
        if (isSendingByLink || isSendingToContacts) {
            goBackToBase()
        } else {
            goBack()
        }
    }

    // single navigation — the duplicate push was flagged by coderabbit on #2780
    const handleLinkCtaClick = redirectToSendByLink

    // handle click on payment method options
    const handleMethodClick = (methodId: string) => {
        posthog.capture(ANALYTICS_EVENTS.SEND_METHOD_SELECTED, { method: methodId })
        switch (methodId) {
            case 'peanut-contacts':
                // navigate to contacts/user selection page
                router.push('/send?view=contacts')
                break
            case 'bank':
                // navigate to send via bank flow.
                // fresh click = fresh intent: browser back skips the in-app NavHeader
                // reset, and a stale selectedMethod left in the app-wide context would
                // hijack the routing (Bank landing on the crypto amount step)
                resetWithdrawFlow()
                router.push('/withdraw?method=bank')
                break
            case 'exchange-or-wallet':
                // navigate to external wallet send flow
                resetWithdrawFlow()
                router.push('/withdraw?method=crypto')
                break
            case 'pix':
                // navigate to pix send flow
                resetWithdrawFlow()
                router.push('/withdraw/manteca?method=pix&country=brazil')
                break
            default:
                console.warn(`Unknown method id: ${methodId}`)
        }
    }

    // extend ACTION_METHODS with component-specific identifier icons
    // (leading bubbles per the SendLink board 17832:79996).
    // Mercado Pago is excluded here: it is a withdraw-to-OWN-account rail
    // (Manteca), so it does not belong in the send-to-others list (PR #2813
    // review). It stays available in the /withdraw flow.
    const extendedActionMethods = useMemo(() => {
        return ACTION_METHODS.filter((method) => method.id !== 'mercadopago').map((method) => {
            // add identifier icon based on method id
            switch (method.id) {
                case 'bank':
                    return {
                        ...method,
                        title: t('methods.bankTitle'),
                        description: t('methods.bankDescription'),
                        identifierIcon: <IconBubble icon="bank" size="s" color="gray" />,
                    }
                case 'exchange-or-wallet':
                    return {
                        ...method,
                        title: t('methods.exchangeOrWalletTitle'),
                        description: t('methods.exchangeOrWalletDescription'),
                        identifierIcon: <IconBubble icon="credit-card" size="s" color="yellow" />,
                    }
                case 'pix':
                    return {
                        ...method,
                        description: t('methods.instantTransfers'),
                        identifierIcon: <Image src={PIX} alt="Pix" className="size-8 min-w-8" />,
                    }
                default:
                    return method
            }
        })
    }, [t])

    // filter send options based on geolocation
    const { filteredMethods: geoFilteredMethods } = useGeoFilteredPaymentOptions({
        methods: extendedActionMethods,
    })

    // prepend peanut contacts option to the filtered methods
    const sendOptions = useMemo(() => {
        const peanutContactsOption: PaymentMethod = {
            id: 'peanut-contacts',
            identifierIcon: <IconBubble icon="user" size="s" color="green" />,
            title: t('methods.contactsTitle'),
            description: t('methods.contactsDescription'),
            icons: [],
            soon: false,
        }

        return [peanutContactsOption, ...geoFilteredMethods]
    }, [geoFilteredMethods, t])

    // direct send to a specific recipient (native app uses /send?recipient=...).
    // Mirrors the web [...recipient] dispatch: an EVM address / ENS / a recipient
    // carrying a chain (@) or amount segment (/) goes to the semantic-request flow
    // (token + chain selection, cross-chain); a plain username goes to direct send.
    if (recipientUsername) {
        const segments = recipientUsername.split('/')
        const firstSegment = segments[0]
        const identifier = firstSegment.includes('@') ? firstSegment.split('@')[0] : firstSegment
        const isSemanticRecipient =
            isAddress(identifier) || identifier.endsWith('.eth') || segments.length > 1 || firstSegment.includes('@')

        if (isSemanticRecipient) {
            return <SemanticRequestPageWrapper recipient={segments} />
        }

        return (
            <ValidatedUsernameWrapper username={recipientUsername}>
                <DirectSendPageWrapper username={recipientUsername} />
            </ValidatedUsernameWrapper>
        )
    }

    if (isSendingByLink) {
        return <LinkSendFlowManager onPrev={handlePrev} />
    }

    // contacts view
    if (isSendingToContacts) {
        return <ContactsView onPrev={handlePrev} />
    }

    return (
        <div className="space-y-8">
            <NavHeader title={tNav('send')} onPrev={handlePrev} />
            <div className="space-y-4 w-full">
                {/* link card per the SendLink board (17832:79996): yellow icon
                    bubble, centered title + sub, full-width purple cta */}
                <Card position="single" className="flex flex-col items-center gap-6 p-6">
                    <div className="flex flex-col items-center gap-2">
                        <IconBubble icon="link" size="m" color="yellow" />
                        <div className="space-y-1 text-center">
                            <div className="text-heading-card text-foreground-primary">{t('linkCard.title')}</div>
                            <div className="text-body-m text-foreground-secondary">{t('linkCard.description')}</div>
                        </div>
                    </div>
                    <Button
                        variant="purple"
                        icon="chevron-right"
                        iconPosition="right"
                        className="w-full"
                        onClick={handleLinkCtaClick}
                    >
                        {t('linkCard.cta')}
                    </Button>
                </Card>

                <Divider
                    text={tCommon('or')}
                    textClassname="text-label-m text-foreground-secondary"
                    dividerClassname="bg-border-subtle"
                />

                {/* board rows: leading bubble, title + body, trailing chevron */}
                <div className="space-y-2">
                    {sendOptions.map((option) => (
                        <ListItem
                            key={option.id}
                            leading={option.identifierIcon}
                            position="single"
                            title={option.title}
                            body={option.description}
                            onClick={() => handleMethodClick(option.id)}
                            chevron
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
