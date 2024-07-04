import Icon from '@/components/Global/Icon'
import * as _consts from '../../Claim.consts'
import * as utils from '@/utils'
import * as consts from '@/constants'
import * as context from '@/context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useAccount, useConnections, useSwitchChain } from 'wagmi'

export const SuccessClaimLinkIbanView = ({
    transactionHash,
    claimLinkData,
    type,
    offrampForm,
    tokenPrice,
    recipientType,
}: _consts.IClaimScreenProps) => {
    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 text-center">
            <label className="text-h2">Yay!</label>
            <label className="text-h8 font-bold ">
                Your funds are on the way. A confirmation email will be sent to {offrampForm.email} shortly.
            </label>
            <div
                style={{
                    backgroundImage:
                        'radial-gradient(circle at top right, #FF90E8, transparent), radial-gradient(circle at bottom left, #23A094, transparent)',
                    backgroundColor: '#FAF4F0',
                }}
                className="flex w-full flex-col items-start justify-center gap-1 rounded-md border border-n-1 px-2 py-4 text-h8"
            >
                <label className="w-full self-center text-center text-h1">
                    {'$'}
                    {utils.formatTokenAmount(tokenPrice * parseFloat(claimLinkData.tokenAmount))}
                </label>
                <label>{offrampForm.name}</label>
                <label>{offrampForm.email}</label>
                <label>{offrampForm.recipient}</label>
            </div>
            <div className="flex w-full flex-col items-center justify-center gap-4 text-h8 font-normal">
                <label>Transfers usually take a few hours, but might take up to 2 working days.</label>
                <Link href={'/send'} className="btn btn-purple w-full ">
                    Make a payment
                </Link>
            </div>
        </div>
    )
}

export default SuccessClaimLinkIbanView
