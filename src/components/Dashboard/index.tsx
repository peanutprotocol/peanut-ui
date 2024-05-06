'use client'
import { useEffect, useState } from 'react'
import Icon from '../Global/Icon'
import Sorting from '../Global/Sorting'
import TablePagination from '../Global/TablePagination'
import { Menu, Transition } from '@headlessui/react'

import * as utils from '@/utils'
import * as consts from '@/constants'
import * as interfaces from '@/interfaces'
import { useAccount } from 'wagmi'
import Search from '../Global/Search'
import { ILinkDetails } from '@/interfaces'
import { getLinkDetails } from '@squirrel-labs/peanut-sdk'
import Loading from '../Global/Loading'
import { useRouter } from 'next/navigation'
import { CSVDownload, CSVLink } from 'react-csv'

const sortingTypes = [
    'Date: new to old',
    'Date: old to new',
    'Amount: low to high',
    'Amount: high to low',
    'Type: send',
    'Type: receive',
]

export const Dashboard = () => {
    const itemsPerPage = 10
    const [filterValue, setFilterValue] = useState('')
    const [sortingValue, setSortingValue] = useState<string>(sortingTypes[0])
    const [dashboardData, setDashboardData] = useState<interfaces.IDashboardItem[]>([])
    const [filteredDashboardData, setFilteredDashboardData] = useState<interfaces.IDashboardItem[]>([])
    const [fetchedLinks, setFetchedLinks] = useState(false)
    const [totalPages, setTotalPages] = useState<number>(0)
    const [currentPage, setCurrentPage] = useState<number>(0)
    const [legacyLinks, setLegacyLinks] = useState<string[]>([])

    const { address } = useAccount()
    const router = useRouter()

    const fetchLinkDetailsAsync = async (data: interfaces.IDashboardItem[]) => {
        //only fetching details for send links
        const _data = data.filter((item) => item.type == 'send')

        await Promise.all(
            _data.map(async (item) => {
                try {
                    const linkDetails = await getLinkDetails({ link: item.link })
                    item.status = linkDetails.claimed ? 'claimed' : 'pending'
                } catch (error) {
                    console.error(error)
                }
            })
        )

        setDashboardData(
            [..._data, ...data.filter((item) => item.type == 'receive')].sort((a, b) => {
                const dateA = new Date(a.date).getTime()
                const dateB = new Date(b.date).getTime()
                if (dateA === dateB) {
                    // If dates are equal, sort by time
                    return new Date(b.date).getTime() - new Date(a.date).getTime()
                } else {
                    // Otherwise, sort by date
                    return dateB - dateA
                }
            })
        )
    }

    const composeLinkDataArray = (
        claimedLinks: interfaces.ILinkDetails[],
        createdLinks: interfaces.IExtendedPeanutLinkDetails[]
    ) => {
        const linkData: interfaces.IDashboardItem[] = []

        claimedLinks.forEach((link) => {
            linkData.push({
                link: link.link,
                type: 'receive',
                amount: link.tokenAmount,
                tokenSymbol: link.tokenSymbol,
                chain: consts.supportedPeanutChains.find((chain) => chain.chainId === link.chainId)?.name ?? '',
                date: link.depositDate.toString(),
                address: link.senderAddress,
                status: 'claimed',
            })
        })

        createdLinks.forEach((link) => {
            linkData.push({
                link: link.link,
                type: 'send',
                amount: link.tokenAmount.toString(),
                tokenSymbol:
                    consts.peanutTokenDetails
                        .find((token) => token.chainId === link.chainId)
                        ?.tokens.find((token) => utils.compareTokenAddresses(token.address, link.tokenAddress ?? ''))
                        ?.symbol ?? '',
                chain: consts.supportedPeanutChains.find((chain) => chain.chainId === link.chainId)?.name ?? '',
                date: link.depositDate.toString(),
                address: undefined,
                status: undefined,
            })
        })

        setTotalPages(Math.ceil(linkData.length / itemsPerPage))
        setCurrentPage(1)
        return linkData
    }

    const sortDashboardData = (sortingValue: string) => {
        const _dashboardData = [...dashboardData]
        switch (sortingValue) {
            case 'Date: new to old':
                _dashboardData.sort((a, b) => {
                    const dateA = new Date(a.date).getTime()
                    const dateB = new Date(b.date).getTime()
                    if (dateA === dateB) {
                        // If dates are equal, sort by time
                        return new Date(b.date).getTime() - new Date(a.date).getTime()
                    } else {
                        // Otherwise, sort by date
                        return dateB - dateA
                    }
                })
                break
            case 'Date: old to new':
                _dashboardData.sort((a, b) => {
                    const dateA = new Date(a.date).getTime()
                    const dateB = new Date(b.date).getTime()
                    if (dateA === dateB) {
                        // If dates are equal, sort by time
                        return new Date(a.date).getTime() - new Date(b.date).getTime()
                    } else {
                        // Otherwise, sort by date
                        return dateA - dateB
                    }
                })
                break

            case 'Amount: low to high':
                _dashboardData.sort((a, b) => {
                    return Number(a.amount) - Number(b.amount)
                })
                break
            case 'Amount: high to low':
                _dashboardData.sort((a, b) => {
                    return Number(b.amount) - Number(a.amount)
                })
                break
            case 'Type: send':
                _dashboardData.sort((a, b) => {
                    return a.type === 'send' ? -1 : 1
                })
                break
            case 'Type: receive':
                _dashboardData.sort((a, b) => {
                    return a.type === 'receive' ? -1 : 1
                })
                break
            default:
                break
        }
        setDashboardData(_dashboardData)
    }

    const filterDashboardData = (filterValue: string) => {
        const _dashboardData = [...dashboardData]
        const filteredData = _dashboardData.filter((item) => {
            return (
                item.amount.includes(filterValue.toLowerCase()) ||
                item.chain.toLowerCase().includes(filterValue.toLowerCase()) ||
                item.date.includes(filterValue) ||
                item.tokenSymbol.toLowerCase().includes(filterValue.toLowerCase()) ||
                item.type.toLowerCase().includes(filterValue.toLowerCase()) ||
                (item.address && item.address.toLowerCase().includes(filterValue.toLowerCase()))
            )
        })
        setTotalPages(Math.ceil(filteredData.length / itemsPerPage))
        setCurrentPage(1)
        setFilteredDashboardData(filteredData)
    }

    useEffect(() => {
        if (address) {
            const claimedLinks = utils.getClaimedLinksFromLocalStorage({ address: address })
            const createdLinks = utils.getCreatedLinksFromLocalStorage({ address: address })

            const linkData = composeLinkDataArray(claimedLinks ?? [], createdLinks ?? [])

            setDashboardData(
                linkData.sort((a, b) => {
                    const dateA = new Date(a.date).getTime()
                    const dateB = new Date(b.date).getTime()
                    if (dateA === dateB) {
                        // If dates are equal, sort by time
                        return new Date(b.date).getTime() - new Date(a.date).getTime()
                    } else {
                        // Otherwise, sort by date
                        return dateB - dateA
                    }
                })
            )

            const links: string[] = []
            const legacyLinkObject = utils.getAllLinksFromLocalStorage({ address: address })
            if (legacyLinkObject) {
                legacyLinkObject.forEach((obj) => {
                    links.push(obj.link)
                })
            }
            const raffleLegacyLinkObject = utils.getAllRaffleLinksFromLocalstorage({ address: address })
            if (raffleLegacyLinkObject) {
                raffleLegacyLinkObject.forEach((obj) => {
                    links.push(obj.link)
                })
            }
            console.log(links)
            setLegacyLinks(links)
        }
    }, [address])

    useEffect(() => {
        if (dashboardData.length > 0 && fetchedLinks === false) {
            fetchLinkDetailsAsync(dashboardData)
            setFetchedLinks(true)
        }
    }, [dashboardData])

    useEffect(() => {
        if (sortingValue && dashboardData.length > 0) {
            sortDashboardData(sortingValue)
        }
    }, [sortingValue])

    // useEffect(() => {
    //     if (filterValue && dashboardData.length > 0) {
    //         filterDashboardData(filterValue)
    //     }

    // }, [filterValue])

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 p-4">
            <div className="flex w-full flex-row items-start justify-between">
                <div className="flex flex-col items-start justify-center">
                    <label className="text-h2">Link History</label>
                    <label className="text-h7 font-normal">Here are all the links you have created or claimed.</label>
                </div>
                <button className="btn-purple btn-xl hidden w-max flex-row items-center justify-center px-4 sm:flex">
                    Create Link
                    <Icon name={'plus-circle'} className="h-4 fill-white" />
                </button>
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                <div className="flex w-full flex-col-reverse items-center justify-center gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <SortComponent
                        sortingValue={sortingValue}
                        setSortingValue={(sortingValue: string) => {
                            setSortingValue(sortingValue)
                        }}
                        buttonClassName="w-full sm:w-max"
                    />

                    {/* <Search
                        onChange={(e: any) => setFilterValue(e.target.value)}
                        onSubmit={() => {}}
                        placeholder="Search"
                        value={filterValue}
                        medium={true}
                        border={true}
                        className=" bg-white "
                    /> */}
                </div>
                <table className="table-custom hidden sm:table">
                    <thead>
                        <tr>
                            <th className="th-custom">
                                <Sorting title="Type" />
                            </th>
                            <th className="th-custom">
                                <Sorting title="Amount" />
                            </th>
                            <th className="th-custom">
                                <Sorting title="Date Created/Claimed" />
                            </th>
                            <th className="th-custom ">
                                <Sorting title="From" />
                            </th>
                            <th className="th-custom ">
                                <Sorting title="Status" />
                            </th>
                            <th className="th-custom"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {dashboardData &&
                            dashboardData.slice((currentPage - 1) * itemsPerPage).map((link) => (
                                <tr className="h-16 text-h8 font-normal" key={link.link + Math.random()}>
                                    <td className="td-custom font-bold">{link.type}</td>
                                    <td className="td-custom font-bold">
                                        {utils.formatTokenAmount(Number(link.amount), 4)} {link.tokenSymbol} -{' '}
                                        {link.chain}
                                    </td>
                                    <td className="td-custom">{formatDate(new Date(link.date))}</td>
                                    {/* <td className="td-custom">{formatDate(new Date(link.date))}</td> */}
                                    <td className="td-custom">
                                        {utils.shortenAddressLong(link.address ?? address ?? '')}
                                    </td>
                                    <td className="td-custom">
                                        {!link.status ? (
                                            <div className="border border-gray-1 px-2 py-1 text-center text-gray-1">
                                                <Loading />
                                            </div>
                                        ) : link.status === 'claimed' ? (
                                            <div className="border border-green-3 px-2 py-1 text-center text-green-3">
                                                claimed
                                            </div>
                                        ) : (
                                            <div className="border border-gray-1 px-2 py-1 text-center text-gray-1">
                                                pending
                                            </div>
                                        )}
                                    </td>{' '}
                                    <td className="td-custom text-center ">
                                        <OptionsItem link={link.link} type={link.type} />
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
                <div className="block w-full sm:hidden">
                    {dashboardData.length > 1 ? (
                        dashboardData
                            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                            .map((link) => <MobileItem linkDetail={link} />)
                    ) : (
                        <div className="flex flex w-full flex-col gap-2 border border-n-1 bg-white px-2 py-4 text-h8 font-normal dark:bg-black">
                            <div className="flex w-full flex-row items-center justify-between">
                                <label className="h-2 w-16 animate-pulse rounded bg-slate-700 font-bold"></label>
                                <label className="h-2 w-16 animate-pulse rounded bg-slate-700"></label>
                            </div>
                            <div className="flex h-2 w-16 w-full animate-pulse rounded border-t border-dotted border-black bg-slate-700"></div>
                            <div className="flex w-full flex-row items-end justify-between">
                                <div className="flex flex-col items-start justify-end gap-2 text-start">
                                    <label className="h-2 w-16 animate-pulse rounded bg-slate-700"></label>
                                    <label className="h-2 w-16 animate-pulse rounded bg-slate-700"></label>
                                </div>
                                <div className="flex flex-col items-end justify-end gap-2 text-end">
                                    <div className="h-2 w-16 animate-pulse rounded bg-slate-700"></div>
                                    <div className="h-2 w-16 animate-pulse rounded bg-slate-700"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <CSVLink
                    data={legacyLinks ? legacyLinks.join('\n') : ''}
                    filename="links.csv"
                    className="cursor-pointer self-end text-purple-1"
                >
                    Download ({legacyLinks.length}) legacy links as CSV
                </CSVLink>
            </div>
            <TablePagination
                onNext={() => {
                    if (currentPage < totalPages) {
                        setCurrentPage(currentPage + 1)
                    }
                }}
                onPrev={() => {
                    if (currentPage > 1) {
                        setCurrentPage(currentPage - 1)
                    }
                }}
                totalPages={totalPages}
                currentPage={currentPage}
            />

            <button
                className="flex cursor-pointer flex-row items-center justify-center gap-1"
                onClick={() => {
                    router.push('/reclaim')
                }}
            >
                <Icon name={'question-circle'} />
                <label className="cursor-pointer">Click here if you had a problem creating a link.</label>
            </button>
        </div>
    )
}

const SortComponent = ({
    sortingValue,
    setSortingValue,
    buttonClassName,
}: {
    sortingValue: string
    setSortingValue: any
    buttonClassName: string
}) => {
    return (
        <Menu className="relative w-full" as="div">
            <Menu.Button
                className={`btn-purple-2 flex h-max flex-row items-center justify-center px-4 py-2 text-h8 font-normal ${buttonClassName}`}
            >
                Sort by: {sortingValue}
            </Menu.Button>
            <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
            >
                <Menu.Items className=" shadow-primary-4 absolute left-0 top-full z-30 mt-2.5 max-h-96 w-[14.69rem] divide-y divide-black overflow-auto rounded-sm border border-n-1 bg-white dark:divide-white dark:border-white dark:bg-n-1 ">
                    {sortingTypes.map((type) => (
                        <Menu.Item
                            as={'button'}
                            onClick={() => {
                                setSortingValue(type)
                            }}
                            className=" flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 dark:hover:bg-white/20"
                            key={type}
                        >
                            <div className="text-h8">{type}</div>
                        </Menu.Item>
                    ))}
                </Menu.Items>
            </Transition>
        </Menu>
    )
}

const OptionsItem = ({ link, type }: { link: string; type: 'send' | 'receive' }) => {
    const router = useRouter()

    return (
        <Menu className="relative" as="div">
            <Menu.Button className={''}>
                <Icon name={'dots'} className="cursor-pointer" />
            </Menu.Button>
            <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
            >
                <Menu.Items className="shadow-primary-4  absolute right-12 top-full z-30 mt-2.5 max-h-96 w-[14.69rem] divide-y divide-black overflow-auto rounded-sm border border-n-1 bg-white dark:divide-white dark:border-white dark:bg-n-1">
                    {type != 'receive' && (
                        <Menu.Item
                            as={'button'}
                            onClick={() => {
                                router.push(`/${link.split('://')[1].split('/')[1]}`)
                            }}
                            className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20 "
                        >
                            <div className="text-h8">Reclaim</div>
                        </Menu.Item>
                    )}
                    <Menu.Item
                        as={'button'}
                        onClick={() => {
                            utils.copyTextToClipboardWithFallback(link)
                        }}
                        className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                    >
                        <div className="text-h8">Copy Link</div>
                    </Menu.Item>
                    <Menu.Item
                        as={'button'}
                        onClick={() => {
                            console.log('clicked')
                        }}
                        className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                        disabled={true}
                    >
                        <div className="text-h8">Delete</div>
                    </Menu.Item>
                </Menu.Items>
            </Transition>
        </Menu>
    )
}

function formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0') // JavaScript months are zero-indexed
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')

    return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`
}

const MobileItem = ({ linkDetail }: { linkDetail: interfaces.IDashboardItem }) => {
    return (
        <div
            className=" flex flex w-full flex-col gap-2 border border-n-1 bg-white px-2 py-4 text-h8 font-normal dark:bg-black"
            key={linkDetail.link + Math.random()}
        >
            <div className="flex w-full flex-row items-center justify-between">
                <label className="font-bold">{linkDetail.type}</label>
                <label>{formatDate(new Date(linkDetail.date))}</label>
            </div>
            <div className="flex w-full border-t border-dotted border-black" />
            <div className="flex w-full flex-row items-end justify-between">
                <div className="flex flex-col items-start justify-end gap-2 text-start">
                    <label>
                        {utils.formatTokenAmount(Number(linkDetail.amount), 4)} {linkDetail.tokenSymbol} [
                        {linkDetail.chain}]
                    </label>
                    {linkDetail.type === 'send' ? (
                        <div className="justify-content flex flex-row items-center gap-1">
                            To:{' '}
                            {linkDetail.address ? (
                                utils.shortenAddressLong(linkDetail.address ?? '')
                            ) : (
                                <div className="h-2 w-16 animate-pulse rounded bg-slate-700"></div>
                            )}
                        </div>
                    ) : (
                        <label>From: {utils.shortenAddressLong(linkDetail.address ?? '')} </label>
                    )}
                </div>
                <div className="flex flex-col items-end justify-end gap-2 text-end">
                    <div>
                        {linkDetail.status === 'claimed' ? (
                            <div className="border border-green-3 border-n-1 px-2 py-1 text-center text-green-3">
                                claimed
                            </div>
                        ) : (
                            <div className="border border-gray-1 border-n-1 px-2 py-1 text-gray-1">pending</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// {localStorageLinkData.length > 0 && dashboardLinkData.length === 0 ? (
//     <tr className="h-16 text-h8 font-normal">
//         <td className="td-custom">
//             <div className="h-2 w-16 animate-pulse rounded bg-slate-700"></div>
//         </td>
//         <td className="td-custom">
//             <div className="h-2 w-16 animate-pulse rounded bg-slate-700"></div>
//         </td>{' '}
//         <td className="td-custom">
//             <div className="h-2 w-16 animate-pulse rounded bg-slate-700"></div>
//         </td>{' '}
//         <td className="td-custom">
//             <div className="h-2 w-16 animate-pulse rounded bg-slate-700"></div>
//         </td>{' '}
//         <td className="td-custom">
//             <div className="h-2 w-16 animate-pulse rounded bg-slate-700"></div>
//         </td>{' '}
//         <td className="td-custom">
//             <div className="h-2 w-4 animate-pulse rounded bg-slate-700"></div>
//         </td>
//     </tr>
// ) : (
//     dashboardLinkData
//         .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
//         .map((link) => (
//             <tr className="h-16 text-h8 font-normal" key={link.link}>
//                 <td className="td-custom font-bold">
//                     {link.senderAddress === address ? 'Send' : 'Receive'}
//                 </td>
//                 <td className="td-custom font-bold">
//                     {utils.formatTokenAmount(Number(link.tokenAmount), 4)} {link.tokenSymbol}
//                     {' - '}
//                     {
//                         consts.supportedPeanutChains.find(
//                             (chain) => chain.chainId === link.chainId
//                         )?.name
//                     }
//                 </td>
//                 <td className="td-custom">{formatDate(link.depositDate)}</td>
//                 {/* <td className="td-custom">{formatDate(link.depositDate)}</td> */}
//                 <td className="td-custom">{utils.shortenAddressLong(link.senderAddress)}</td>
//                 <td className="td-custom">
//                     {link.claimed ? (
//                         <div className="border border-green-3 px-2 py-1 text-center text-green-3">
//                             claimed
//                         </div>
//                     ) : (
//                         <div className="border border-gray-1 px-2 py-1 text-center text-gray-1">
//                             pending
//                         </div>
//                     )}
//                 </td>{' '}
//                 <td className="td-custom text-center ">
//                     <OptionsItem link={link.link} />
//                 </td>
//             </tr>
//         ))
// )}
