'use client'
import Icon from '@/components/Global/Icon'
import Link from 'next/link'
import * as _consts from './Offramp.consts'
import MoreInfo from '@/components/Global/MoreInfo'
import { useAuth } from '@/context/authContext'
import * as utils from '@/utils'
import { Button, Card } from '../0_Bruddle'

export const OfframpSuccessView = ({
    offrampForm, // available on all offramps
    offrampType, // available on all offramps

    usdValue, // available on cashouts

    claimLinkData, // available on claims
    tokenPrice, // available on claims
    recipientType, // available on claims
    transactionHash, // available on claims
}: _consts.IOfframpSuccessScreenProps) => {
    // setup offrampType == CASHOUT props
    const { user } = useAuth()
    const accountType = user?.accounts?.find(
        (account) =>
            account?.account_identifier?.replaceAll(/\s/g, '').toLowerCase() ===
            offrampForm.recipient?.replaceAll(/\s/g, '').toLowerCase()
    )?.account_type

    // setup offrampType == CLAIM props
    let blockExplorerUrl: string | undefined
    if (offrampType == _consts.OfframpType.CLAIM && claimLinkData) {
        blockExplorerUrl = utils.getExplorerUrl(claimLinkData.chainId)
    }

    return (
        <Card shadowSize="6">
            <Card.Header>
                <Card.Title>Yay!</Card.Title>
                <Card.Description>
                    Your funds are on the way. A confirmation email will be sent to {offrampForm.email} shortly. Please
                    keep in mind that it may take up to 2 days for the funds to arrive.
                </Card.Description>
            </Card.Header>
            <Card.Content className="col gap-2">
                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'profile'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Name</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        {offrampForm.name}
                    </span>
                </div>
                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'email'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Email</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        {offrampForm.email}
                    </span>
                </div>

                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'bank'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Bank account</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal uppercase leading-4">
                        {offrampForm.recipient}
                    </span>
                </div>

                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'forward'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Route</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        Cashout <Icon name={'arrow-next'} className="h-4 fill-gray-1" />
                        {offrampType == _consts.OfframpType.CASHOUT && accountType?.toUpperCase()}{' '}
                        {offrampType == _consts.OfframpType.CLAIM && recipientType?.toUpperCase()}{' '}
                        <MoreInfo text={`Wait, crypto can be converted to real money??? How cool!`} />
                    </span>
                </div>
                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'gas'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Fee</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        {offrampType == _consts.OfframpType.CASHOUT && (
                            <>
                                {user?.accounts?.find(
                                    (account) =>
                                        account.account_identifier.replaceAll(/\s/g, '').toLowerCase() ===
                                        offrampForm.recipient.replaceAll(/\s/g, '').toLowerCase()
                                )?.account_type === 'iban'
                                    ? '$1'
                                    : '$0.50'}
                                <MoreInfo
                                    text={
                                        user?.accounts.find(
                                            (account) =>
                                                account.account_identifier.replaceAll(/\s/g, '').toLowerCase() ===
                                                offrampForm.recipient.replaceAll(/\s/g, '').toLowerCase()
                                        )?.account_type === 'iban'
                                            ? 'For SEPA transactions a fee of $1 is charged. For ACH transactions a fee of $0.50 is charged.'
                                            : 'For ACH transactions a fee of $0.50 is charged. For SEPA transactions a fee of $1 is charged.'
                                    }
                                />
                            </>
                        )}
                        {offrampType == _consts.OfframpType.CLAIM && (
                            <>
                                $0
                                <MoreInfo text={'Fees are on us, enjoy!'} />
                            </>
                        )}
                    </span>
                </div>
                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'transfer'} className="h-4 fill-gray-1" />
                        <label className="font-bold">You will receive</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        {offrampType == _consts.OfframpType.CASHOUT && (
                            <>
                                $
                                {user?.accounts.find(
                                    (account) =>
                                        account.account_identifier.replaceAll(/\s/g, '').toLowerCase() ===
                                        offrampForm.recipient.replaceAll(/\s/g, '').toLowerCase()
                                )?.account_type === 'iban'
                                    ? utils.formatTokenAmount(parseFloat(usdValue ?? '') - 1)
                                    : utils.formatTokenAmount(parseFloat(usdValue ?? '') - 0.5)}
                                <MoreInfo
                                    text={
                                        user?.accounts.find(
                                            (account) =>
                                                account.account_identifier.replaceAll(/\s/g, '').toLowerCase() ===
                                                offrampForm.recipient.replaceAll(/\s/g, '').toLowerCase()
                                        )?.account_type === 'iban'
                                            ? 'For SEPA transactions a fee of $1 is charged. For ACH transactions a fee of $0.50 is charged. This will be deducted of the amount you will receive.'
                                            : 'For ACH transactions a fee of $0.50 is charged. For SEPA transactions a fee of $1 is charged. This will be deducted of the amount you will receive.'
                                    }
                                />
                            </>
                        )}
                        {offrampType == _consts.OfframpType.CLAIM && tokenPrice && claimLinkData && (
                            <>
                                ${utils.formatTokenAmount(tokenPrice * parseFloat(claimLinkData.tokenAmount))}{' '}
                                <MoreInfo text={'Woop Woop free offramp!'} />
                            </>
                        )}
                    </span>
                </div>
                {offrampType == _consts.OfframpType.CASHOUT && (
                    <>
                        <Link href={`/profile`}>
                            <Button variant="stroke">
                                <div className=" border border-n-1 p-0 px-1">
                                    <Icon name="dashboard" className="-mt-0.5" />
                                </div>
                                Go to profile
                            </Button>
                        </Link>
                    </>
                )}
                {offrampType == _consts.OfframpType.CLAIM && (
                    <>
                        <div className="flex w-full flex-col items-center justify-center gap-4 text-h8 font-normal">
                            <Link href={'/send'} className="btn btn-purple w-full ">
                                Make a payment
                            </Link>
                        </div>
                        <Link href={`${blockExplorerUrl}/tx/${transactionHash}`}>
                            <Button variant="stroke">
                                <div className=" border border-n-1 p-0 px-1">
                                    <Icon name="dashboard" className="-mt-0.5" />
                                </div>
                                See transaction confirmation
                            </Button>
                        </Link>
                    </>
                )}
            </Card.Content>
        </Card>
    )
}
