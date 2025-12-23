'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { MERCADO_PAGO, PIX } from '@/assets'
import LinkSendFlowManager from '../link/LinkSendFlowManager'
import NavHeader from '@/components/Global/NavHeader'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'
import Divider from '@/components/0_Bruddle/Divider'
import { ActionListCard } from '@/components/ActionListCard'
import IconStack from '@/components/Global/IconStack'
import { ACTION_METHODS, type PaymentMethod } from '@/constants/actionlist.consts'
import Image from 'next/image'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { useGeoFilteredPaymentOptions } from '@/hooks/useGeoFilteredPaymentOptions'
import { useContacts } from '@/hooks/useContacts'
import { getInitialsFromName } from '@/utils/general.utils'
import { useCallback, useMemo } from 'react'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import ContactsView from './Contacts.view'

export const SendRouterView = () => {
    const router = useRouter()
    const searchParams = useSearchParams()
    const isSendingByLink = searchParams.get('view') === 'link' || searchParams.get('createLink') === 'true'
    const isSendingToContacts = searchParams.get('view') === 'contacts'
    // only fetch 3 contacts for avatar display
    const { contacts, isLoading: isFetchingContacts } = useContacts({ limit: 3 })

    // fallback initials when no contacts
    const fallbackInitials = ['PE', 'AN', 'UT']

    const recentContactsAvatarInitials = useCallback(() => {
        // if we have contacts, use them (already limited to 3 by API)
        if (contacts.length > 0) {
            return contacts.map((contact) => {
                return getInitialsFromName(
                    contact.showFullName ? contact.fullName || contact.username : contact.username
                )
            })
        }
        // fallback to default initials if no data
        return fallbackInitials
    }, [contacts])

    const contactsAvatars = useMemo(() => {
        // show loading skeleton while fetching
        if (isFetchingContacts) {
            return (
                <div className="flex flex-row items-center -space-x-1.5">
                    {[0, 1, 2].map((index) => (
                        <div
                            key={index}
                            style={{ zIndex: index }}
                            className="size-6 min-h-6 min-w-6 animate-pulse rounded-full bg-gray-200"
                        />
                    ))}
                </div>
            )
        }

        // show avatars (either real data or fallback)
        return (
            <div className="flex flex-row items-center -space-x-2">
                {recentContactsAvatarInitials().map((initial, index) => {
                    return (
                        <div key={initial} style={{ zIndex: index }}>
                            <AvatarWithBadge name={initial} size="tiny" />
                        </div>
                    )
                })}
            </div>
        )
    }, [isFetchingContacts, recentContactsAvatarInitials])

    const redirectToSendByLink = () => {
        router.push(`${window.location.pathname}?view=link`)
    }

    const handlePrev = () => {
        // when in sub-views (link or contacts), go back to base send page
        // otherwise, go to home
        if (isSendingByLink || isSendingToContacts) {
            router.push('/send')
        } else {
            router.push('/home')
        }
    }

    const handleLinkCtaClick = () => {
        router.push(`${window.location.pathname}?view=link`)
        redirectToSendByLink()
    }

    // handle click on payment method options
    const handleMethodClick = (methodId: string) => {
        switch (methodId) {
            case 'peanut-contacts':
                // navigate to contacts/user selection page
                router.push('/send?view=contacts')
                break
            case 'bank':
                // navigate to send via bank flow
                router.push('/withdraw?method=bank')
                break
            case 'exchange-or-wallet':
                // navigate to external wallet send flow
                router.push('/withdraw?method=crypto')
                break
            case 'mercadopago':
                // navigate to mercado pago send flow
                router.push('/withdraw/manteca?method=mercado-pago&country=argentina')
                break
            case 'pix':
                // navigate to pix send flow
                router.push('/withdraw/manteca?method=pix&country=brazil')
                break
            default:
                console.warn(`Unknown method id: ${methodId}`)
        }
    }

    // extend ACTION_METHODS with component-specific identifier icons
    const extendedActionMethods = useMemo(() => {
        return ACTION_METHODS.map((method) => {
            // add identifier icon based on method id
            switch (method.id) {
                case 'bank':
                    return {
                        ...method,
                        identifierIcon: (
                            <div className="flex size-8 min-w-8 items-center justify-center rounded-full bg-black">
                                <Icon name="bank" size={14} fill="white" />
                            </div>
                        ),
                    }
                case 'exchange-or-wallet':
                    return {
                        ...method,
                        identifierIcon: (
                            <div className="flex size-8 min-w-8 items-center justify-center rounded-full bg-yellow-1">
                                <Icon name="wallet-outline" size={14} />
                            </div>
                        ),
                    }
                case 'mercadopago':
                    return {
                        ...method,
                        identifierIcon: <Image src={MERCADO_PAGO} alt="Mercado Pago" className="size-8 min-w-8" />,
                    }
                case 'pix':
                    return {
                        ...method,
                        identifierIcon: <Image src={PIX} alt="Pix" className="size-8 min-w-8" />,
                    }
                default:
                    return method
            }
        })
    }, [])

    // filter send options based on geolocation
    const { filteredMethods: geoFilteredMethods } = useGeoFilteredPaymentOptions({
        methods: extendedActionMethods,
    })

    // prepend peanut contacts option to the filtered methods
    const sendOptions = useMemo(() => {
        const peanutContactsOption: PaymentMethod = {
            id: 'peanut-contacts',
            identifierIcon: (
                <div className="flex size-8 min-w-8 items-center justify-center rounded-full bg-secondary-3">
                    <Icon name="user" size={14} />
                </div>
            ),
            title: 'Peanut contacts',
            description: "Peanuts you've interacted with",
            icons: [],
            soon: false,
        }

        return [peanutContactsOption, ...geoFilteredMethods]
    }, [geoFilteredMethods])

    if (isSendingByLink) {
        return <LinkSendFlowManager onPrev={handlePrev} />
    }

    // contacts view
    if (isSendingToContacts) {
        return <ContactsView />
    }

    return (
        <div className="space-y-8">
            <NavHeader title="Send" onPrev={handlePrev} />
            <div className="w-full space-y-4">
                <Card position="single" className="p-4 pb-5">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="space-y-2">
                            <div className="mx-auto w-fit rounded-full bg-primary-1 p-2">
                                <Icon name="link" size={16} />
                            </div>
                            <div className="space-y-1 text-center">
                                <div className="font-bold">Send money with a link</div>
                                <div className="text-sm font-medium">No account needed to receive.</div>
                            </div>
                        </div>
                        <Button shadowSize="4" icon="link" iconSize={10} onClick={handleLinkCtaClick}>
                            Send via link
                        </Button>
                    </div>
                </Card>

                <Divider text="or" textClassname="font-bold text-grey-1" dividerClassname="bg-grey-1" />

                <div className="space-y-2">
                    {sendOptions.map((option) => {
                        // determine right content based on option id
                        let rightContent
                        switch (option.id) {
                            case 'peanut-contacts':
                                rightContent = contactsAvatars
                                break
                            case 'mercadopago':
                                rightContent = <StatusBadge status="custom" customText="YOUR ACCOUNTS ONLY" />
                                break
                            default:
                                rightContent = (
                                    <IconStack
                                        icons={option.icons ?? []}
                                        iconSize={80}
                                        imageClassName="size-6 min-h-6 min-w-6 object-cover"
                                    />
                                )
                                break
                        }

                        return (
                            <ActionListCard
                                key={option.id}
                                leftIcon={option.identifierIcon}
                                position="single"
                                title={option.title}
                                description={option.description}
                                descriptionClassName="text-[12px]"
                                onClick={() => handleMethodClick(option.id)}
                                rightContent={rightContent}
                            />
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
