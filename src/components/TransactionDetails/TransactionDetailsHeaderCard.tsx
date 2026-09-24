'use client'

import Badge, { type StatusType } from '@/components/Global/Badges/Badge'
import { isOpenRequestDisplay, isTestTransaction, PENDING_AMOUNT_STATUSES } from '@/utils/history.utils'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { MerchantLogoIcon } from '@/components/TransactionDetails/MerchantLogoIcon'
import { type TransactionDirection, type TransactionType } from '@/components/TransactionDetails/transaction-types'
import {
    SELF_DESCRIBING_NAME_KEYS,
    TRANSACTION_NAME_KEYS,
    translateTransactionName,
    type TransactionNameKey,
} from '@/components/TransactionDetails/transaction-name-keys'
import { printableUserHandle } from '@/utils/general.utils'
import { normalizeEnsName } from '@/utils/ens-name.utils'
import { usePrimaryNameServer } from '@/hooks/usePrimaryNameServer'
import { isAddress } from 'viem'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import React from 'react'
import { VerifiedUserLabel } from '../UserHeader'
import { useRouter } from 'next/navigation'
import { twMerge } from '@/utils/tw'
import { PEANUTMAN } from '@/assets/mascot'
import { profileUrl } from '@/utils/native-routes'

import type { TransactionDetails } from './transactionTransformer'

interface TransactionDetailsHeaderCardProps {
    actionLabelKey?: TransactionDetails['actionLabelKey']
    direction: TransactionDirection
    userName: string
    /** Catalog key when `userName` is an FE-generated label — localized here;
     *  also the locale-safe discriminant for the via-link title overrides. */
    nameKey?: TransactionNameKey
    nameParams?: Record<string, string>
    amountDisplay: string
    /** '-' for outgoing money; '' otherwise. Incoming never shows '+' — the
     *  states board (17966:12128) treats incoming-successful as the base
     *  state with no indicators. */
    sign?: '-' | '+' | ''
    initials: string
    status?: StatusType
    isVerified?: boolean
    isLinkTransaction?: boolean
    transactionType?: TransactionType
    avatarUrl?: string
    /** Rain-enriched merchant brand logo for a card spend. Shown when there is
     *  no `avatarUrl`; the generic card badge is the fallback. */
    merchantLogo?: string | null
    /** The counterparty's picked profile avatar (TASK-22625). A merchant
     *  `avatarUrl` still wins — it identifies the payee more precisely. */
    avatarKey?: string | null
    /** `false` for a row whose name is system copy (a reaper-failed transfer),
     *  so the avatar slot does not draw a face for a failure message. */
    isPeer?: boolean
    haveSentMoneyToUser?: boolean
    isNameClickable?: boolean
    isAvatarClickable?: boolean
    isRequestPotTransaction?: boolean
    showFullName?: boolean
    fullName?: string
    countryCode?: string | null
    /** one line under the status badge, e.g. why a deposit was returned */
    statusNote?: string
}

type TransactionTranslator = ReturnType<typeof useTranslations<'transaction'>>

const getTitle = (
    t: TransactionTranslator,
    direction: TransactionDirection,
    userName: string,
    isLinkTransaction?: boolean,
    status?: StatusType,
    nameKey?: TransactionNameKey
): React.ReactNode => {
    let titleText = userName

    // Self-describing labels (reaper fail copy, refunds, the failed-QR label,
    // unresolved open requests) are complete on their own — interpolating
    // them into direction wording produced compounds like "Sending to Send
    // didn't complete" and "Received from Refund from Starbucks".
    if (nameKey && SELF_DESCRIBING_NAME_KEYS.has(nameKey)) {
        return userName
    }

    // Link transactions short-circuit; userName is already a self-describing
    // label so the "Sent to ${displayName}" prefix doesn't apply.
    if (isLinkTransaction) {
        const completed = status === 'completed'
        const titleByDirection: Partial<Record<TransactionDirection, string>> = {
            send: completed ? t('title.sentViaLink') : userName,
            receive: completed ? t('title.receivedViaLink') : userName,
            request_sent: t('title.requestedViaLink'),
            request_received: t('title.requestViaLink'),
        }
        titleText = titleByDirection[direction] ?? userName ?? t('title.linkTransaction')
    } else {
        // Shorten crypto addresses AND raw UUIDs (usernameless Peanut users
        // whose `identifier` arrives as a userId) so the header never renders
        // a 36-char string.
        const displayName = printableUserHandle(userName)

        // check if this is a test transaction (setup confirmation)
        // note: bad check, but its a quick fix for now - kush (18 nov 2025), to be handled in the backend post devconnect.
        const isTest = isTestTransaction(displayName)

        switch (direction) {
            case 'send':
                // Locale-safe discriminant (#2554): key off nameKey, never
                // the (now localized) display string.
                if (nameKey === TRANSACTION_NAME_KEYS.sentViaLink) {
                    titleText = t('title.sentViaLink')
                } else {
                    // Direction stays in words for every status (PR #2813
                    // review): a bare counterparty name can't tell inflow
                    // from outflow. Non-completed (pending / cancelled /
                    // failed) reads "Sending to".
                    titleText = t(status === 'completed' ? 'title.sentTo' : 'title.sendingTo', {
                        name: displayName,
                    })
                }
                break
            case 'request_received':
                titleText = t('title.isRequesting', { name: displayName })
                break
            case 'receive':
                if (nameKey === TRANSACTION_NAME_KEYS.receivedViaLink) {
                    titleText = t('title.receivedViaLink')
                } else {
                    titleText = t('title.receivedFrom', { name: displayName })
                }
                break
            case 'request_sent':
                titleText = t(status === 'completed' ? 'title.requestedFrom' : 'title.requestingFrom', {
                    name: displayName,
                })
                break
            case 'withdraw':
            case 'bank_withdraw':
                titleText = t(status === 'completed' ? 'title.withdrewTo' : 'title.withdrawingTo', {
                    name: displayName,
                })
                break
            case 'bank_claim':
                titleText = displayName
                break
            case 'add':
            case 'bank_deposit':
                if (isTest) {
                    titleText = t('enjoyPeanut')
                } else {
                    titleText = t(status === 'completed' ? 'title.addedFrom' : 'title.addingFrom', {
                        name: displayName,
                    })
                }
                break
            case 'claim_external':
                if (status === 'completed') {
                    titleText = t('title.claimedTo', { name: displayName })
                } else if (status === 'failed') {
                    titleText = t('title.claimTo', { name: displayName })
                } else {
                    titleText = t('title.claimingTo', { name: displayName })
                }
                break
            case 'qr_payment':
                if (status === 'failed') {
                    // Failed card spends carry a merchant name, so they keep the
                    // direction words: "Payment to {merchant}" (board 17490:115877).
                    // The self-contained "Failed QR payment attempt" label is
                    // handled by the self-describing escape at the top.
                    titleText = t('title.paymentTo', { name: displayName })
                } else {
                    // Board 17490:115877 (Activity/CardPayment pending drawer):
                    // the title keeps the type wording "Paid to {name}" in every
                    // non-failed state — the status badge, not the verb tense,
                    // carries pending/cancelled. ("Paying to" retired with it.)
                    titleText = t('title.paidTo', { name: displayName })
                }
                break
            case 'bank_request_fulfillment':
                // Payer side of a request fulfilled via bank rails — outgoing
                // money, worded like a send (PR #2813 review: direction must
                // be readable from the receipt words, not the sign alone).
                titleText = t(status === 'completed' ? 'title.sentTo' : 'title.sendingTo', {
                    name: displayName,
                })
                break
            default:
                titleText = displayName
                break
        }
    }

    return titleText
}

/** Amount treatment per the states board (17966:12128): pending = greyed,
 *  cancelled/refunded/failed = strikethrough, everything else = base.
 *  Open requests skip the pending grey-out — see isOpenRequestDisplay. */
const amountStateClasses = (status?: StatusType, isOpenRequest?: boolean) => {
    if ((status === 'pending' || status === 'processing') && !isOpenRequest) return 'text-foreground-secondary'
    if (status === 'cancelled' || status === 'refunded' || status === 'failed') return 'line-through'
    return ''
}

/**
 * Receipt head (DS 09, TX Details board 17490:115877): centered composition —
 * IconBubble/avatar on top, transaction-type line, big amount, status badge.
 * Completed transactions show NO badge (base state per the states board);
 * pending/failed/cancelled do.
 */
export const TransactionDetailsHeaderCard: React.FC<TransactionDetailsHeaderCardProps> = ({
    direction,
    userName,
    actionLabelKey,
    nameKey,
    nameParams,
    amountDisplay,
    sign = '',
    initials,
    status,
    isVerified = false,
    isLinkTransaction = false,
    transactionType,
    avatarUrl,
    merchantLogo,
    avatarKey,
    isPeer,
    haveSentMoneyToUser = false,
    isNameClickable = false,
    isAvatarClickable = false,
    isRequestPotTransaction,
    showFullName,
    fullName,
    countryCode,
    statusNote,
}) => {
    const router = useRouter()
    const t = useTranslations('transaction')
    // FE-generated labels carry a catalog key — localize for every display
    // surface below; raw `userName` stays for data uses (test-tx marker,
    // profile URL, verification lookups).
    const localizedUserName = nameKey ? translateTransactionName(t, nameKey, nameParams) : userName
    // Reverse-resolve raw-address counterparties (same pattern as the feed
    // row in TransactionCard) so the worded title reads "Added from {ens}"
    // instead of a shortened 0x. No ENS → getTitle shortens the raw address.
    const { primaryName } = usePrimaryNameServer(isAddress(userName) ? userName : undefined)
    const resolvedUserName = normalizeEnsName(primaryName) ?? localizedUserName
    const typeForAvatar =
        transactionType ?? (direction === 'add' ? 'add' : direction === 'withdraw' ? 'withdraw' : 'send')

    // respect user's showFullName preference: use fullName only if showFullName is true, otherwise use username
    const nameForAvatar = showFullName && fullName ? fullName : localizedUserName
    // The sticker's letter follows the handle instead (same rule as the feed
    // row), so the receipt and the profile agree. An address counterparty draws
    // no letter from `userName`, so the display name is the fallback.
    const avatarNameForAvatar = isAddress(userName) ? nameForAvatar : userName

    // check if this is a test transaction (setup confirmation)
    const isTest = isTestTransaction(userName)

    const handleUserProfileClick = () => {
        router.push(profileUrl(userName))
    }

    // Open requests (unfulfilled request links + pots) skip the pending
    // treatment entirely — no pending badge, no greyed amount (PR #2813
    // review; states board shows requests in the base state).
    const isOpenRequest = isOpenRequestDisplay({ direction, isRequestPotLink: isRequestPotTransaction })
    const isPendingFamily =
        !!status && status !== 'custom' && status !== 'neutral' && PENDING_AMOUNT_STATUSES.has(status)
    const showBadge = !!status && status !== 'completed' && !(isOpenRequest && isPendingFamily)

    const genericBadge = (
        <TransactionAvatarBadge
            initials={initials}
            userName={nameForAvatar}
            avatarName={avatarNameForAvatar}
            avatarKey={avatarKey}
            isPeer={isPeer}
            isLinkTransaction={isLinkTransaction}
            transactionType={typeForAvatar}
            status={status}
            size="m"
            countryCode={countryCode}
        />
    )

    return (
        <div className="flex flex-col items-center gap-3 text-center">
            {isTest ? (
                <Image src={PEANUTMAN} alt="Peanut Logo" width={64} height={64} className="size-12" />
            ) : (
                <div
                    className={twMerge(
                        isAvatarClickable &&
                            'cursor-pointer rounded-full focus-visible:outline-[3px] focus-visible:outline-action-focus'
                    )}
                    onClick={isAvatarClickable ? handleUserProfileClick : undefined}
                    role={isAvatarClickable ? 'button' : undefined}
                    tabIndex={isAvatarClickable ? 0 : undefined}
                    aria-label={isAvatarClickable ? nameForAvatar : undefined}
                    onKeyDown={
                        isAvatarClickable
                            ? (event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      handleUserProfileClick()
                                  }
                              }
                            : undefined
                    }
                >
                    {avatarUrl ? (
                        <div className="flex size-12 items-center justify-center rounded-full">
                            <Image
                                src={avatarUrl}
                                alt="Icon"
                                className="size-full rounded-full object-cover"
                                width={160}
                                height={160}
                            />
                        </div>
                    ) : merchantLogo ? (
                        <MerchantLogoIcon src={merchantLogo} fallback={genericBadge} size="md" />
                    ) : (
                        genericBadge
                    )}
                </div>
            )}
            <div className="flex w-full flex-col items-center gap-2">
                <div className="flex w-full flex-col items-center gap-1">
                    <h2 className="flex items-center justify-center text-body-xs text-foreground-secondary">
                        {isTest ? (
                            t('enjoyPeanut')
                        ) : (
                            <VerifiedUserLabel
                                username={userName}
                                name={
                                    actionLabelKey
                                        ? t(actionLabelKey)
                                        : isRequestPotTransaction
                                          ? // The pot rollup row only ever renders for the request's
                                            // owner — the generic "Request" label reads as their own
                                            // ask: "You requested". Named pots keep their name.
                                            nameKey === TRANSACTION_NAME_KEYS.request
                                              ? t('title.youRequested')
                                              : localizedUserName
                                          : (getTitle(
                                                t,
                                                direction,
                                                resolvedUserName,
                                                isLinkTransaction,
                                                status,
                                                nameKey
                                            ) as string)
                                }
                                isVerified={isVerified}
                                className="flex items-center justify-center gap-1"
                                haveSentMoneyToUser={haveSentMoneyToUser}
                                iconSize={18}
                                onNameClick={isNameClickable ? handleUserProfileClick : undefined}
                            />
                        )}
                    </h2>
                    {!isTest && (
                        <h1
                            className={twMerge(
                                'text-heading-m text-foreground-primary',
                                amountStateClasses(status, isOpenRequest)
                            )}
                        >
                            {sign}
                            {amountDisplay}
                        </h1>
                    )}
                </div>
                {showBadge &&
                    (actionLabelKey === 'type.returnedToSender' ? (
                        // A bank deposit sent back to the payer is a fact with no
                        // success tone, so `neutral`, in the heading's word.
                        <Badge status="neutral" size="medium" customText={t('returnedStatus')} />
                    ) : (
                        <Badge status={status!} size="medium" />
                    ))}
                {statusNote && <p className="text-body-s text-foreground-secondary">{statusNote}</p>}
            </div>
        </div>
    )
}
