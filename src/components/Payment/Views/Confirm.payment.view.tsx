import { Button } from '@/components/0_Bruddle'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import { useAppDispatch } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import Image from 'next/image'
// import { AttachFile, AttachMoney, ExpandMore, Link as LinkIcon, Money, Person } from '@mui/icons-material'
import { useState } from 'react'

export default function ConfirmPaymentView() {
    const dispatch = useAppDispatch()
    const [showMessage, setShowMessage] = useState<boolean>(false)
    const [showReference, setShowReference] = useState<boolean>(false)

    return (
        <div className="space-y-4">
            <FlowHeader onPrev={() => dispatch(paymentActions.setView(1))} disableWalletHeader />

            <div className="pb-1 text-start text-h4 font-bold">Confirm Details</div>
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        {/* <Icon name={'add-members'} className="h-4 fill-grey-1 " /> */}
                        {/* <Person className="h-4 fill-grey-1 " /> */}
                        <div className="text-sm font-semibold text-grey-1">Recipient</div>
                    </div>
                    <div className="font-semibold">kushagrasarathe.eth</div>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        {/* <Icon name={'money-out'} className="h-4 fill-grey-1 " /> */}
                        {/* <AttachMoney className="h-4 fill-grey-1 " /> */}
                        <div className="text-sm font-semibold text-grey-1">Amount</div>
                    </div>
                    <div className="font-semibold">$100</div>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        {/* <Icon name={'paperclip'} className="h-4 fill-grey-1 " /> */}
                        {/* <Money className="h-4 fill-grey-1 " /> */}
                        <div className="text-sm font-semibold text-grey-1">Token</div>
                    </div>

                    <div className="flex items-center gap-1">
                        <Image
                            src={'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png?1547042389'}
                            alt={'ethereum'}
                            width={20}
                            height={20}
                        />
                        <div className="font-semibold"> USDC</div>
                    </div>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        {/* <Icon name={'paperclip'} className="h-4 fill-grey-1 " /> */}
                        {/* <LinkIcon className="h-4 fill-grey-1 " /> */}
                        <div className="text-sm font-semibold text-grey-1">Chain</div>
                    </div>

                    <div className="flex items-center gap-1">
                        <Image
                            src={'https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628'}
                            alt={'ethereum'}
                            width={20}
                            height={20}
                        />
                        <div className="font-semibold"> Ethereum</div>
                    </div>
                </div>

                <div
                    onClick={() => {
                        setShowMessage(!showMessage)
                    }}
                    className="flex w-full flex-col items-center justify-center gap-1 border-b border-dashed border-black pb-2"
                >
                    <div className="flex w-full  cursor-pointer flex-row items-center justify-between gap-1 text-h8 text-grey-1">
                        <div className="flex w-max flex-row items-center justify-center gap-1">
                            {/* <AttachFile name={'paperclip'} className="h-4 fill-grey-1 " /> */}
                            <div className="text-sm font-semibold text-grey-1">Message</div>
                        </div>
                        <Icon
                            name={'arrow-bottom'}
                            className={`h-4 cursor-pointer fill-grey-1 transition-transform ${showMessage && ' rotate-180'}`}
                        />
                        {/* <ExpandMore className={`h-4 cursor-pointer fill-grey-1 transition-transform ${showMessage && ' rotate-180'}`} /> */}
                    </div>

                    {showMessage && (
                        <div className="flex w-full flex-col items-center justify-center gap-1 py-1 text-h8 text-grey-1">
                            <label className="w-full text-start text-sm font-normal leading-4">
                                gm from your friend
                            </label>
                        </div>
                    )}
                </div>

                <div
                    onClick={() => {
                        setShowReference(!showReference)
                    }}
                    className="flex w-full flex-col items-center justify-center gap-1"
                >
                    <div className="flex w-full  cursor-pointer flex-row items-center justify-between gap-1 text-h8 text-grey-1">
                        <div className="flex w-max flex-row items-center justify-center gap-1">
                            {/* <AttachFile name={'paperclip'} className="h-4 fill-grey-1 " /> */}
                            <div className="text-sm font-semibold text-grey-1">Reference</div>
                        </div>
                        <Icon
                            name={'arrow-bottom'}
                            className={`h-4 cursor-pointer fill-grey-1 transition-transform ${showReference && ' rotate-180'}`}
                        />
                        {/* <ExpandMore className={`h-4 cursor-pointer fill-grey-1 transition-transform ${showMessage && ' rotate-180'}`} /> */}
                    </div>

                    {showReference && (
                        <div className="flex w-full flex-col items-center justify-center gap-1 py-1 text-h8 text-grey-1">
                            <label className="w-full text-start text-sm font-normal leading-4">we met at devcon</label>
                        </div>
                    )}
                </div>
            </div>

            <div className="text-xs">
                Please confirm all the details before sending the payment, you can edit the details by clicking on the
                back button on the top left corner.
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row-reverse">
                <Button shadowSize="4" onClick={() => dispatch(paymentActions.setView(3))}>
                    Confirm
                </Button>
            </div>

            {/* <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header>
                    <Card.Title>Send Payment</Card.Title>
                    <Card.Description>Sending payment to kushagrasarathe.eth</Card.Description>
                </Card.Header>
                <Card.Content className="space-y-3">
                    <div className="flex items-center justify-center">
                        <ConfirmDetails
                            tokenSymbol={'USDC'}
                            tokenIconUri={
                                'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png?1547042389'
                            }
                            chainName={'Ethereum'}
                            chainIconUri={
                                'https://assets.coingecko.com/coins/images/279/small/ethereum_logo.png?1595348880'
                            }
                            tokenAmount={'20'}
                            title="You're sending"
                        />
                    </div>

                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        {attachmentOptions.fileUrl && (
                            <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-grey-1">
                                <div className="flex w-max flex-row items-center justify-center gap-1">
                                    <Icon name={'paperclip'} className="h-4 fill-grey-1" />
                                    <label className="font-bold">Attachment</label>
                                </div>
                                <a href={attachmentOptions.fileUrl} download target="_blank">
                                    <Icon name={'download'} className="h-4 fill-grey-1" />
                                </a>
                            </div>
                        )}
                        {attachmentOptions.message && (
                            <div className="flex w-full flex-col items-center justify-center gap-1">
                                <div
                                    className="flex w-full  flex-row items-center justify-between gap-1 px-2 text-h8 text-grey-1"
                                    onClick={() => {
                                        setShowMessage(!showMessage)
                                    }}
                                >
                                    <div className="flex w-max flex-row items-center justify-center gap-1">
                                        <Icon name={'paperclip'} className="h-4 fill-grey-1 " />
                                        <label className=" font-bold">Message</label>
                                    </div>
                                    <Icon
                                        name={'arrow-bottom'}
                                        className={`h-4 cursor-pointer fill-grey-1 transition-transform ${showMessage && ' rotate-180'}`}
                                    />
                                </div>
                                {showMessage && (
                                    <div className="flex w-full flex-col items-center justify-center gap-1 pl-7 text-h8 text-grey-1">
                                        <label className="w-full text-start text-sm font-normal leading-4">
                                            {attachmentOptions.message}
                                        </label>
                                    </div>
                                )}
                            </div>
                        )}
                        {transactionCostUSD !== undefined && (
                            <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-grey-1">
                                <div className="flex w-max flex-row items-center justify-center gap-1">
                                    <Icon name={'gas'} className="h-4 fill-grey-1" />
                                    <label className="font-bold">Network cost</label>
                                </div>
                                <label className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                    {transactionCostUSD === 0
                                        ? '$0'
                                        : transactionCostUSD < 0.01
                                          ? '$<0.01'
                                          : `$${formatTokenAmount(transactionCostUSD, 3) ?? 0}`}
                                    <MoreInfo
                                        text={
                                            transactionCostUSD > 0
                                                ? `This transaction will cost you $${formatTokenAmount(transactionCostUSD, 3)} in network fees.`
                                                : 'This transaction is sponsored by peanut! Enjoy!'
                                        }
                                    />
                                </label>
                            </div>
                        )}
                    </div>

                    <Divider className="my-4" />
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row-reverse">
                        <Button onClick={() => dispatch(paymentActions.setView(3))}>Confirm</Button>
                    </div>
                </Card.Content>
            </Card> */}
            {/* todo: add error state */}
        </div>
    )
}
