'use client'
import Icon from '@/components/Global/Icon'
import Link from 'next/link'
import * as _consts from './Offramp.consts'
import MoreInfo from '@/components/Global/MoreInfo'
import { useAuth } from '@/context/authContext'
import * as utils from '@/utils'

export const OfframpSuccessView = ({
    offrampForm, // available on all offramps
    offrampType, // available on all offramps

    usdValue, // available on cashouts

    claimLinkData, // available on claims
    tokenPrice, // available on claims
    recipientType, // available on claims
    transactionHash, // available on claims
    appliedPromoCode,
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
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
            <label className="text-h2">Yay!</label>
            <label className="text-h8 font-bold ">
                Your funds are on the way. A confirmation email will be sent to {offrampForm.email} shortly. Please keep
                in mind that it may take up to 2 days for the funds to arrive.
            </label>
            <div className="flex w-full flex-col items-center justify-center gap-2">
                <div className="flex w-full flex-row items-center px-2 text-h8 text-gray-1">
                    <div className="flex w-1/3 flex-row items-center gap-1">
                        <Icon name={'gas'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Fee</label>
                    </div>
                    <div className="relative flex flex-1 items-center justify-end gap-1 text-sm font-normal">
                        <div className="flex items-center gap-1">
                            {appliedPromoCode ? '$0' : accountType === 'iban' ? '$1' : '$0.50'}
                            <MoreInfo
                                text={
                                    appliedPromoCode
                                        ? 'Fees waived with promo code!'
                                        : `For ${accountType === 'iban' ? 'SEPA' : 'ACH'} transactions a fee of ${
                                              accountType === 'iban' ? '$1' : '$0.50'
                                          } is charged.`
                                }
                            />
                        </div>
                    </div>
                </div>

                {/* You will receive section */}
                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center gap-1">
                        <Icon name={'transfer'} className="h-4 fill-gray-1" />
                        <label className="font-bold">You will receive</label>
                    </div>
                    <div className="flex items-center justify-end gap-1 text-sm font-normal">
                        <div className="flex items-center gap-1">
                            $
                            {appliedPromoCode
                                ? offrampType === _consts.OfframpType.CASHOUT
                                    ? utils.formatTokenAmount(parseFloat(usdValue ?? ''))
                                    : tokenPrice &&
                                      claimLinkData &&
                                      utils.formatTokenAmount(tokenPrice * parseFloat(claimLinkData.tokenAmount))
                                : accountType === 'iban'
                                  ? offrampType == _consts.OfframpType.CASHOUT
                                      ? utils.formatTokenAmount(parseFloat(usdValue ?? '') - 1)
                                      : tokenPrice &&
                                        claimLinkData &&
                                        utils.formatTokenAmount(tokenPrice * parseFloat(claimLinkData.tokenAmount) - 1)
                                  : offrampType == _consts.OfframpType.CASHOUT
                                    ? utils.formatTokenAmount(parseFloat(usdValue ?? '') - 0.5)
                                    : tokenPrice &&
                                      claimLinkData &&
                                      utils.formatTokenAmount(tokenPrice * parseFloat(claimLinkData.tokenAmount) - 0.5)}
                            <MoreInfo
                                text={
                                    appliedPromoCode
                                        ? `Fees waived with promo code ${appliedPromoCode}`
                                        : accountType === 'iban'
                                          ? 'For SEPA transactions a fee of $1 is charged. For ACH transactions a fee of $0.50 is charged. This will be deducted of the amount you will receive.'
                                          : 'For ACH transactions a fee of $0.50 is charged. For SEPA transactions a fee of $1 is charged. This will be deducted of the amount you will receive.'
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>

            {offrampType == _consts.OfframpType.CASHOUT && (
                <>
                    <Link
                        className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                        href={`/profile`}
                    >
                        <div className=" border border-n-1 p-0 px-1">
                            <Icon name="dashboard" className="-mt-0.5" />
                        </div>
                        Go to profile
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
                    <Link
                        className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                        href={`${blockExplorerUrl}/tx/${transactionHash}`}
                    >
                        <div className=" border border-n-1 p-0 px-1">
                            <Icon name="dashboard" className="-mt-0.5" />
                        </div>
                        See transaction confirmation
                    </Link>
                </>
            )}
        </div>
    )
}
