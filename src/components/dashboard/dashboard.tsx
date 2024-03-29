'use client'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { CSVLink } from 'react-csv'
import { isMobile } from 'react-device-detect'
import { useAtom } from 'jotai'
import { useRouter } from 'next/navigation'
import peanut from '@squirrel-labs/peanut-sdk'
import * as global_components from '@/components/global'

import trapezoid from '@/assets/icons/trapezoid.svg' //TODO: replace with div and tailwind skew
import * as utils from '@/utils'
import * as interfaces from '@/interfaces'
import * as store from '@/store'
import * as hooks from '@/hooks'
import * as consts from '@/consts'
import Link from 'next/link'
interface IDashboardLinkItemProps {
    hash: string
    chainId: string
    amount: string
    token: string
    date: string
    claimed: boolean
    link: string
    copied: boolean
}

interface IDashboardRaffleItemProps {
    hash: string | undefined
    chainId: string
    totalAmount: string
    token: string
    date: string
    claimed: boolean
    link: string
    copied: boolean
    totalSlots: number
    claimedSlots: number
    withMFA: boolean
    withCaptcha: boolean
    senderName: string
    senderAddress: string
}

export function Dashboard() {
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const { address, isConnected } = useAccount()
    const router = useRouter()
    const [localStorageLinkData, setLocalStorageLinkData] = useState<interfaces.ILocalStorageItem[]>([])
    const [localStorageRaffleData, setLocalStorageRaffleData] = useState<interfaces.ILocalStorageItem[]>([])
    const [dashboardLinkData, setDashboardLinkData] = useState<IDashboardLinkItemProps[]>([])
    const [dashboardRaffleData, setDashboardRaffleData] = useState<IDashboardRaffleItemProps[]>([])
    const [copiedLink, setCopiedLink] = useState<string[]>()
    const [selectedDashboard, setSelectedDashboard] = useState<'normal' | 'raffle'>('normal')
    const gaEventTracker = hooks.useAnalyticsEventTracker('dashboard-component')

    /**
     * Fetches all the link details from the peanut SDK and sets the state
     * @param localStorageData
     */
    const getAllLinkDetails = async (localStorageData: interfaces.ILocalStorageItem[]) => {
        try {
            let details: IDashboardLinkItemProps[] = []
            await Promise.all(
                localStorageData.map(async (item) => {
                    try {
                        let linkDetails = await peanut.getLinkDetails({ link: item.link }) // TODO: change to fetch all at once (batch request)

                        const x: IDashboardLinkItemProps = {
                            hash: item.idx ? item.hash + item.idx : item.hash,
                            chainId: linkDetails.chainId,
                            amount: linkDetails?.tokenAmount ?? '',
                            token: linkDetails?.tokenSymbol,
                            date: linkDetails?.depositDate
                                ? new Date(linkDetails.depositDate).toLocaleString()
                                : 'Unavailable',
                            claimed: linkDetails?.claimed ?? false,
                            link: item.link,
                            copied: false,
                        }
                        details.push(x)
                        console.log(x)
                    } catch (error) {
                        console.error(error)
                    }
                })
            )
            details.sort((a, b) => {
                const parseDate = (dateStr: string) => {
                    if (dateStr === 'Unavailable' || dateStr === 'undefined') {
                        return new Date('1000-12-31T23:59:59Z')
                    }
                    const dateTimeRegex = /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/
                    const match = dateStr.match(dateTimeRegex)
                    if (match) {
                        return new Date(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6]}Z`)
                    } else {
                        return new Date('1000-12-31T23:59:59Z')
                    }
                }
                const dateA = parseDate(a.date)
                const dateB = parseDate(b.date)
                return dateB.getTime() - dateA.getTime()
            })
            setDashboardLinkData(details)
        } catch (error) {
            console.log(error)
        }
    }

    /**
     * Fetches all the raffle link details from the peanut SDK and sets the state
     * @param localStorageData
     */
    const getAllRaffleLinkDetails = async (localStorageData: interfaces.ILocalStorageItem[]) => {
        try {
            let details: IDashboardRaffleItemProps[] = []
            await Promise.all(
                localStorageData.map(async (item) => {
                    try {
                        const _raffleInfo = await peanut.getRaffleInfo({
                            link: item.link,
                            baseUrl: `${consts.next_proxy_url}/get-raffle-info`,
                            APIKey: 'doesnt-matter',
                        }) // TODO: change to fetch all at once (batch request)

                        const x: IDashboardRaffleItemProps = {
                            hash: item.idx ? item.hash + item.idx : item.hash,
                            chainId: _raffleInfo.chainId,
                            totalAmount: '',
                            token: '',
                            date: '',
                            claimed: _raffleInfo.isActive,
                            link: item.link,
                            copied: false,
                            totalSlots: _raffleInfo.totalSlotsNumber,
                            claimedSlots: _raffleInfo.claimedSlotsNumber,
                            withMFA: _raffleInfo.withMFA,
                            withCaptcha: _raffleInfo.withCaptcha,
                            senderName: _raffleInfo.senderName,
                            senderAddress: _raffleInfo.senderAddress,
                        } // TODO: add more details

                        console.log(x)
                        details.push(x)
                    } catch (error) {
                        console.log(error)
                    }
                })
            )

            setDashboardRaffleData(details)
        } catch (error) {
            console.log(error)
        }
    }

    useEffect(() => {
        if (address) {
            const linkData = utils.getAllLinksFromLocalStorage({
                address: address.toString(),
            })

            linkData && setLocalStorageLinkData(linkData)

            const raffleData = utils.getAllRaffleLinksFromLocalstorage({
                address: address.toString(),
            })

            raffleData && setLocalStorageRaffleData(raffleData)

            return
        }
        router.prefetch('/send')
    }, [address])

    useEffect(() => {
        if (localStorageLinkData.length > 0 && dashboardLinkData.length === 0) {
            getAllLinkDetails(localStorageLinkData)
        }
        if (localStorageRaffleData.length > 0 && dashboardRaffleData.length === 0) {
            getAllRaffleLinkDetails(localStorageRaffleData)
        }
    }, [localStorageLinkData, dashboardLinkData, localStorageRaffleData, dashboardRaffleData])

    useEffect(() => {
        console.log(selectedDashboard)
    }, [selectedDashboard])

    return (
        <global_components.PageWrapper>
            <div
                className={
                    'center-xy relative mx-auto mt-[43px] flex w-10/12 flex-col items-center border-4 border-solid border-black bg-white px-4 py-6 pb-6 text-black sm:mr-auto sm:mt-[40px] lg:w-2/3 xl:w-1/2'
                }
                id={!isMobile ? 'cta-div' : ''}
            >
                <div
                    className={
                        'absolute -left-[5px] -top-[43px] cursor-pointer sm:-top-[40px] ' +
                        (selectedDashboard === 'normal' ? ' z-20 ' : ' z-0 ')
                    }
                    onClick={() => {
                        setSelectedDashboard('normal')
                    }}
                >
                    <img src={trapezoid.src} className="absolute" />
                    <label className="absolute left-[55px] top-[10px] z-50">Links</label>
                </div>

                <div
                    className={
                        'absolute -top-[43px] left-[132px] cursor-pointer cursor-pointer sm:-top-[40px] ' +
                        (selectedDashboard === 'raffle' ? ' z-20 ' : ' z-0 ')
                    }
                    onClick={() => {
                        setSelectedDashboard('raffle')
                    }}
                >
                    <img src={trapezoid.src} className="absolute" />
                    <label className="absolute left-[55px] top-[10px] z-50">Raffles</label>
                </div>

                <div className="flex w-full flex-col gap-2">
                    {selectedDashboard === 'normal' && (
                        <div>
                            <div className="align-center flex w-full flex-col justify-between sm:flex-row ">
                                <div className="text-center text-xl font-bold">
                                    A list of all the links you have created.
                                </div>
                                <div className="mt-4 flex justify-between sm:ml-16 sm:mt-0 sm:flex-none ">
                                    {isConnected && localStorageLinkData.length > 0 && (
                                        <CSVLink
                                            className="brutalborder mr-2 inline-flex cursor-pointer items-center justify-center bg-black px-4 py-2 text-sm font-medium text-white no-underline hover:bg-white hover:text-black sm:w-auto"
                                            data={dashboardLinkData}
                                            filename={'links.csv'}
                                        >
                                            DOWNLOAD CSV
                                        </CSVLink>
                                    )}

                                    <button
                                        type="button"
                                        className="brutalborder inline-flex cursor-pointer items-center justify-center bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black sm:w-auto"
                                        onClick={() => {
                                            router.push('/send')
                                        }}
                                    >
                                        CREATE
                                        <svg
                                            className="-mr-0.5 ml-2 h-4 w-4"
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 -2 15 20"
                                            fill="currentColor"
                                            aria-hidden="true"
                                        >
                                            <path d="M10 3a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V4a1 1 0 011-1z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            {isConnected ? (
                                localStorageLinkData.length > 0 ? (
                                    dashboardLinkData.length > 0 ? (
                                        isMobile ? (
                                            <div className="mt-4 max-h-[420px] overflow-y-auto">
                                                <table className=" w-full min-w-full table-auto border-spacing-x-0">
                                                    <thead className="sticky top-0 bg-black text-white">
                                                        <tr className="m-0 p-0">
                                                            <th
                                                                scope="col"
                                                                className="px-1 py-3.5 pl-3 text-left font-semibold"
                                                            >
                                                                Chain
                                                            </th>
                                                            <th
                                                                scope="col"
                                                                className="px-1 py-3.5 text-left font-semibold"
                                                            >
                                                                Amount
                                                            </th>
                                                            <th scope="col" className="relative px-1 py-3.5">
                                                                <span className="sr-only">Copy</span>
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="border-spacing-x-0 border-spacing-y-4">
                                                        {dashboardLinkData.map((item) => (
                                                            <tr key={item.link} className="py-2">
                                                                <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1 py-2">
                                                                    {
                                                                        chainDetails.find(
                                                                            (chain) =>
                                                                                chain.chainId.toString() ===
                                                                                item.chainId.toString()
                                                                        )?.name
                                                                    }
                                                                </td>

                                                                <td className="brutalborder-bottom h-8  cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1 py-2">
                                                                    {Number(item.amount) > 0
                                                                        ? utils.formatTokenAmount(Number(item.amount))
                                                                        : 'Claimed'}{' '}
                                                                    {Number(item.amount) > 0 && item.token}
                                                                </td>
                                                                <td className="brutalborder-bottom h-8 cursor-pointer px-1 py-2">
                                                                    {item.claimed ? (
                                                                        <></>
                                                                    ) : (
                                                                        <svg
                                                                            xmlns="http://www.w3.org/2000/svg"
                                                                            fill="none"
                                                                            viewBox="0 0 24 24"
                                                                            stroke="currentColor"
                                                                            className="inline h-5 w-5"
                                                                            onClick={() => {
                                                                                gaEventTracker('link-copied', '')
                                                                                utils.copyTextToClipboardWithFallback(
                                                                                    item.link
                                                                                )
                                                                                setCopiedLink([item.link])
                                                                            }}
                                                                        >
                                                                            <path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />

                                                                            {/* <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth={2}
                                                                                d="M8 7H5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-3M7 7l5-5m0 0l5 5m-5-5v12"
                                                                            /> */}
                                                                        </svg>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="max-h-[360px] overflow-y-auto">
                                                <table className="w-full border-spacing-x-0 border-spacing-y-2">
                                                    <thead className="sticky top-0 z-10 bg-black text-white">
                                                        <tr>
                                                            <th
                                                                scope="col"
                                                                className="px-1 py-3.5 pl-3 text-left font-semibold "
                                                            >
                                                                Chain
                                                            </th>
                                                            <th
                                                                scope="col"
                                                                className="px-1 py-3.5 text-left font-semibold "
                                                            >
                                                                Amount
                                                            </th>
                                                            <th
                                                                scope="col"
                                                                className="px-1 py-3.5 text-left font-semibold "
                                                            >
                                                                Token
                                                            </th>
                                                            <th
                                                                scope="col"
                                                                className="px-1 py-3.5 text-left font-semibold "
                                                            >
                                                                Date
                                                            </th>

                                                            <th scope="col" className="relative px-1 py-3.5 ">
                                                                <span className="sr-only">Copy</span>
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200 bg-white">
                                                        {dashboardLinkData.map((item) => (
                                                            <tr
                                                                key={item.hash ?? Math.random()}
                                                                onClick={() => {
                                                                    utils.copyTextToClipboardWithFallback(item.link)
                                                                    setCopiedLink([item.link])
                                                                    gaEventTracker('link-copied', '')
                                                                }}
                                                                className="relative cursor-pointer"
                                                            >
                                                                <td className="brutalborder-bottom  h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                                    {
                                                                        chainDetails.find(
                                                                            (chain) =>
                                                                                chain.chainId.toString() ===
                                                                                item.chainId.toString()
                                                                        )?.name
                                                                    }
                                                                </td>
                                                                <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                                    {Number(item.amount) > 0
                                                                        ? utils.formatTokenAmount(Number(item.amount))
                                                                        : 'Claimed'}{' '}
                                                                </td>
                                                                <td className="brutalborder-bottom h-8  cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                                    {item.token}
                                                                </td>
                                                                <td className="brutalborder-bottom h-8 cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1">
                                                                    {item.date}
                                                                </td>

                                                                <td
                                                                    className="brutalborder-bottom relative h-8 w-[68px] cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap break-all px-1" // Adjust the width to accommodate the image
                                                                    onClick={() => {
                                                                        utils.copyTextToClipboardWithFallback(item.link)
                                                                        setCopiedLink([item.link])
                                                                        gaEventTracker('link-copied', '')
                                                                    }}
                                                                >
                                                                    {item.claimed
                                                                        ? 'Claimed'
                                                                        : Number(item.amount) > 0
                                                                          ? copiedLink?.includes(item.link)
                                                                              ? 'Copied'
                                                                              : 'Copy'
                                                                          : ''}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )
                                    ) : (
                                        <div className="my-4 flex h-full w-full items-center justify-center">
                                            <svg
                                                aria-hidden="true"
                                                className="inline h-6 w-6 animate-spin fill-white text-black dark:text-black"
                                                viewBox="0 0 100 101"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                                                    fill="currentColor"
                                                />
                                                <path
                                                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                                                    fill="currentFill"
                                                />
                                            </svg>
                                            <span className="sr-only">Loading...</span>
                                        </div>
                                    )
                                ) : (
                                    <div>
                                        {' '}
                                        You have not created any links yet. Click{' '}
                                        <span
                                            className="cursor-pointer underline"
                                            onClick={() => {
                                                router.push('/send')
                                            }}
                                        >
                                            here
                                        </span>{' '}
                                        to make your first one!
                                    </div>
                                )
                            ) : (
                                <div className="my-2 flex w-full items-center justify-center text-center font-bold">
                                    Connect your wallet to view your links.
                                </div>
                            )}
                            <div className="mt-2 flex w-full items-center justify-center text-center">
                                <label className="">
                                    Had a problem creating a link? Click{' '}
                                    <Link href={'/reclaim'} className="text-black">
                                        here
                                    </Link>
                                </label>
                            </div>
                        </div>
                    )}

                    {selectedDashboard === 'raffle' && (
                        <div>
                            <div className="align-center flex w-full flex-col justify-between sm:flex-row ">
                                <div className="text-center text-xl font-bold">
                                    A list of all the raffles you have created.
                                </div>
                                <div className="mt-4 flex justify-between sm:ml-16 sm:mt-0 sm:flex-none ">
                                    <button
                                        type="button"
                                        className="brutalborder inline-flex cursor-pointer items-center justify-center bg-black px-4 py-2 text-sm font-medium text-white hover:bg-white hover:text-black sm:w-auto"
                                        onClick={() => {
                                            router.push('/raffle/create')
                                        }} //TODO: remove create and add in a empty card for create
                                    >
                                        CREATE
                                        <svg
                                            className="-mr-0.5 ml-2 h-4 w-4"
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 -2 15 20"
                                            fill="currentColor"
                                            aria-hidden="true"
                                        >
                                            <path d="M10 3a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V4a1 1 0 011-1z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            {isConnected ? (
                                localStorageRaffleData.length > 0 ? (
                                    dashboardRaffleData.length > 0 ? (
                                        <ul
                                            role="list"
                                            className="grid max-h-[560px] grid-cols-1 gap-6 overflow-y-auto  md:grid-cols-2 "
                                        >
                                            {dashboardRaffleData.map((item) => (
                                                <li
                                                    key={item.link}
                                                    className="brutalborder col-span-1 flex flex-col divide-y divide-gray-200 bg-white p-2 text-center shadow"
                                                >
                                                    <div className="flex flex-col items-start justify-center gap-2 font-normal">
                                                        <div className="flex  max-w-fill-available items-center space-x-1 overflow-hidden">
                                                            <label className="whitespace-nowrap font-bold">
                                                                Chain:
                                                            </label>
                                                            <div className=" min-w-0 flex-1 truncate">
                                                                {' '}
                                                                {
                                                                    chainDetails.find(
                                                                        (chain) =>
                                                                            chain.chainId.toString() ===
                                                                            item.chainId.toString()
                                                                    )?.name
                                                                }
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="font-bold">Total slots: </label>{' '}
                                                            {item.totalSlots}
                                                        </div>

                                                        <div>
                                                            <label className="font-bold">Claimed slots:</label>{' '}
                                                            {item.claimedSlots}
                                                        </div>

                                                        <div>
                                                            <label className="font-bold">With MFA:</label>{' '}
                                                            {item.withMFA ? 'Yes' : 'No'}
                                                        </div>
                                                        <div>
                                                            <label className="font-bold">With captcha:</label>{' '}
                                                            {item.withCaptcha ? 'Yes' : 'No'}
                                                        </div>
                                                        <div className="flex  max-w-fill-available items-center space-x-1 overflow-hidden">
                                                            <label className="whitespace-nowrap font-bold">
                                                                Sender name:
                                                            </label>
                                                            <div className=" min-w-0 flex-1 truncate">
                                                                {item.senderName}
                                                            </div>
                                                        </div>
                                                        <div className="flex  max-w-fill-available items-center space-x-1 overflow-hidden">
                                                            <label className="whitespace-nowrap font-bold">
                                                                Sender address:
                                                            </label>
                                                            <div className=" min-w-0 flex-1 truncate">
                                                                {' '}
                                                                {utils.shortenAddress(item.senderAddress)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="brutalborder-top -mt-px mt-4 flex">
                                                            <div className="brutalborder-right flex w-0 flex-1">
                                                                <div
                                                                    onClick={() => {
                                                                        utils.copyTextToClipboardWithFallback(item.link)

                                                                        setCopiedLink([item.link])
                                                                    }}
                                                                    className="relative -mr-px inline-flex w-0 flex-1 cursor-pointer items-center justify-center gap-x-3 rounded-bl-lg border border-transparent py-2 text-sm font-semibold text-gray-900"
                                                                >
                                                                    {copiedLink?.includes(item.link)
                                                                        ? 'Copied'
                                                                        : 'Copy'}
                                                                </div>
                                                            </div>
                                                            <div className="-ml-px flex w-0 flex-1">
                                                                <div className="relative inline-flex w-0 flex-1 cursor-pointer items-center justify-center gap-x-3 rounded-br-lg border border-transparent bg-white py-2 text-sm font-semibold text-gray-900">
                                                                    Open
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="my-4 flex h-full w-full items-center justify-center">
                                            <svg
                                                aria-hidden="true"
                                                className="inline h-6 w-6 animate-spin fill-white text-black dark:text-black"
                                                viewBox="0 0 100 101"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                                                    fill="currentColor"
                                                />
                                                <path
                                                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                                                    fill="currentFill"
                                                />
                                            </svg>
                                            <span className="sr-only">Loading...</span>
                                        </div>
                                    )
                                ) : (
                                    <div>
                                        {' '}
                                        You have not created any links yet. Click{' '}
                                        <span
                                            className="cursor-pointer underline"
                                            onClick={() => {
                                                router.push('/send')
                                            }}
                                        >
                                            here
                                        </span>{' '}
                                        to make your first one!
                                    </div>
                                )
                            ) : (
                                <div>Connect your wallet to view your raffles.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </global_components.PageWrapper>
    )
}
