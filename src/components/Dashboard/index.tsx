'use client'
import { useEffect, useState } from 'react'
import Icon from '../Global/Icon'
import Sorting from '../Global/Sorting'
import TablePagination from '../Global/TablePagination'
import { useAccount } from 'wagmi'
import { getLinkDetails } from '@squirrel-labs/peanut-sdk'
import Loading from '../Global/Loading'
import { useRouter } from 'next/navigation'
import { CSVLink } from 'react-csv'

import * as utils from '@/utils'
import * as consts from '@/constants'
import * as interfaces from '@/interfaces'
import * as _utils from './Dashboard.utils'
import * as _consts from './Dashboard.consts'
import * as components from './components'
import Modal from '../Global/Modal'
import { Menu, Transition } from '@headlessui/react'

export const Dashboard = () => {
    const itemsPerPage = 10
    const [filterValue, setFilterValue] = useState('')
    const [sortingValue, setSortingValue] = useState<string>(_consts.sortingTypes[0])
    const [dashboardData, setDashboardData] = useState<interfaces.IDashboardItem[]>([])
    const [filteredDashboardData, setFilteredDashboardData] = useState<interfaces.IDashboardItem[]>([])
    const [fetchedLinks, setFetchedLinks] = useState(false)
    const [totalPages, setTotalPages] = useState<number>(0)
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [legacyLinks, setLegacyLinks] = useState<string[]>([])
    const [points, setPoints] = useState<number | undefined>(undefined)
    const [isPointsModalVisible, setIsPointsModalVisible] = useState(false)

    const { address, isConnected } = useAccount()
    const router = useRouter()

    const fetchLinkDetailsAsync = async (visibleData: interfaces.IDashboardItem[]) => {
        // only fetching details for send links that are visible on the current page
        const _data = visibleData.filter((item) => item.type == 'send')
        try {
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
        } catch (error) {
            console.log('Error fetching link details:', error)
        }

        // Update the dashboard data with fetched statuses
        setDashboardData((prevData) =>
            prevData.map((item) => {
                const updatedItem = _data.find((updated) => updated.link === item.link)
                return updatedItem ? { ...item, status: updatedItem.status } : item
            })
        )
    }

    const composeLinkDataArray = (
        claimedLinks: interfaces.IExtendedLinkDetails[],
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
                message: link.message,
                attachmentUrl: link.attachmentUrl,
                points: link.points,
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
                message: link.message,
                attachmentUrl: link.attachmentUrl,
                points: link.points,
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

    const fetchPoints = async () => {
        try {
            const response = await fetch('https://api.staging.peanut.to/get-user-stats', {
                method: 'POST',

                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address,
                    apiKey: process.env.NEXT_PUBLIC_PEANUT_API_KEY,
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()
            setPoints(data.points)
        } catch (error) {
            console.error('Error fetching user stats:', error)
            throw error // or handle error as needed
        }
    }

    const calculatePoints = (data: interfaces.IDashboardItem[]) => {
        let points = 0

        data.forEach((item) => {
            if (item.points) {
                points += item.points
            }
        })

        return points * 2
    }

    useEffect(() => {
        const claimedLinks = utils.getClaimedLinksFromLocalStorage({ address: address })
        const createdLinks = utils.getCreatedLinksFromLocalStorage({ address: address })

        const linkData = composeLinkDataArray(claimedLinks ?? [], createdLinks ?? [])
        // const calculatedPoints = calculatePoints(linkData)
        // setPoints(calculatedPoints)
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

        if (address) {
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
            setLegacyLinks(links)
        } else {
            setLegacyLinks([])
        }

        // fetchPoints()
    }, [address])

    useEffect(() => {
        if (sortingValue && dashboardData.length > 0) {
            sortDashboardData(sortingValue)
        }
    }, [sortingValue])

    useEffect(() => {
        const visibleData = dashboardData
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .filter((item) => item.status === undefined)
        if (visibleData.length > 0) {
            fetchLinkDetailsAsync(visibleData)
        }
    }, [currentPage, dashboardData])

    useEffect(() => {
        if (filterValue) {
            filterDashboardData(filterValue)
        } else {
            setFilteredDashboardData(dashboardData)
        }
    }, [filterValue, dashboardData])

    return (
        <div className="flex h-full w-full flex-col items-center justify-start gap-6 p-4">
            <div className="flex w-full flex-row items-start justify-between">
                <div className="flex flex-col items-start justify-center">
                    <label className="text-h2">Dashboard</label>
                    <label className="text-h7 font-normal">
                        {dashboardData.length > 0
                            ? `See all links created and claimed  ${address ? `with ${utils.shortenAddressLong(address)}` : 'on this device'}`
                            : 'You have not created or claimed any links yet.'}
                    </label>

                    {isConnected && (
                        <div className="flex w-full flex-row items-center justify-center gap-2 py-2 sm:w-full sm:w-max">
                            <div
                                style={{
                                    backgroundImage: 'linear-gradient(to right, #9747FF, #FF90E8)',
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    color: 'transparent',
                                }}
                                className="animate-gradient  flex w-full flex-row items-center justify-between bg-clip-text text-center text-2xl font-bold sm:w-max sm:w-max sm:justify-center sm:gap-12"
                                onClick={() => {
                                    // setIsPointsModalVisible(true)
                                }}
                            >
                                <div className="flex flex-row items-center justify-center gap-2">
                                    <label className="cursor-pointer text-h4">Points: </label>
                                    <Menu className="relative w-full" as="div">
                                        <Menu.Button
                                            style={{
                                                backgroundImage: 'linear-gradient(to right, #9747FF, #FF90E8)',
                                            }}
                                            className="btn btn-purple btn-shadow h-8 w-32 w-full text-white"
                                        >
                                            Claim now!
                                        </Menu.Button>
                                        <Transition
                                            enter="transition-opacity duration-150 ease-out"
                                            enterFrom="opacity-0"
                                            enterTo="opacity-100"
                                            leave="transition-opacity duration-100 ease-out"
                                            leaveFrom="opacity-100"
                                            leaveTo="opacity-0"
                                        >
                                            <Menu.Items className="shadow-primary-4 absolute bottom-full left-0 z-30 mb-2 w-48 border border-n-1 bg-white px-4 py-2 text-h8 sm:left-28 sm:w-64">
                                                <Menu.Item as={'label'} className={'text-h8 font-normal'}>
                                                    You will be awarded points retroactively in a few days. You will
                                                    receive a 2X boost for being so early with us!
                                                </Menu.Item>
                                            </Menu.Items>
                                        </Transition>
                                    </Menu>
                                    {/* <label className="cursor-pointer text-h3">{points ? points : '0'}</label> */}
                                    {/* <label className="cursor-pointer text-h3">Coming Soon!</label> */}
                                </div>
                                <div className="jusityf-center hidden flex-row items-center gap-2 sm:flex">
                                    <Icon name={'arrow-up-right'} />
                                    <label className="cursor-pointer text-h4">2.0X boost</label>
                                    <Icon name={'info'} className="" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <button
                    className="btn-purple btn-xl hidden w-max flex-row items-center justify-center px-4 sm:flex"
                    onClick={() => {
                        router.push('/send')
                    }}
                >
                    Make Payment
                    <Icon name={'plus-circle'} className="h-4 fill-white" />
                </button>
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                {dashboardData.length > 0 && (
                    <div className="flex w-full flex-col-reverse items-center justify-center gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <components.SortComponent
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
                )}
                {filteredDashboardData.length > 0 && (
                    <>
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
                                        <Sorting title="Chain" />
                                    </th>
                                    <th className="th-custom">
                                        <Sorting title="Date" />
                                    </th>
                                    <th className="th-custom ">
                                        <Sorting title="From" />
                                    </th>
                                    <th className="th-custom ">
                                        <Sorting title="Ref." />
                                    </th>
                                    <th className="th-custom ">
                                        <Sorting title="Status" />
                                    </th>
                                    <th className="th-custom"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDashboardData &&
                                    filteredDashboardData
                                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                        .map((link) => (
                                            <tr className="h-16 text-h8 font-normal" key={link.link + Math.random()}>
                                                <td className="td-custom font-bold">{link.type}</td>
                                                <td className="td-custom font-bold">
                                                    {utils.formatTokenAmount(Number(link.amount), 4)} {link.tokenSymbol}
                                                </td>
                                                <td className="td-custom font-bold">{link.chain}</td>
                                                <td className="td-custom">{_utils.formatDate(new Date(link.date))}</td>
                                                {/* <td className="td-custom">{formatDate(new Date(link.date))}</td> */}
                                                <td className="td-custom">
                                                    {utils.shortenAddressLong(link.address ?? address ?? '')}
                                                </td>
                                                <td className="td-custom max-w-32">
                                                    <span
                                                        className="block flex-grow overflow-hidden text-ellipsis whitespace-nowrap"
                                                        title={link.message ? link.message : ''}
                                                    >
                                                        {link.message ? link.message : ''}
                                                    </span>
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
                                                </td>
                                                <td className="td-custom text-center ">
                                                    <components.OptionsItemComponent item={link} />
                                                </td>
                                            </tr>
                                        ))}
                            </tbody>
                        </table>
                        <div className="block w-full sm:hidden">
                            {filteredDashboardData
                                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                .map((link) => (
                                    <div key={link.link + Math.random()}>
                                        <components.MobileItemComponent linkDetail={link} address={address ?? ''} />
                                    </div>
                                ))}
                        </div>
                    </>
                )}

                {legacyLinks.length > 0 && (
                    <CSVLink
                        data={legacyLinks ? legacyLinks.join('\n') : ''}
                        filename="links.csv"
                        className="cursor-pointer self-end text-purple-1"
                    >
                        Download {legacyLinks.length} legacy links as CSV
                    </CSVLink>
                )}
            </div>
            {filteredDashboardData.length > 0 && (
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
            )}

            <button
                className=""
                onClick={() => {
                    router.push('/reclaim')
                }}
            >
                <Icon name={'question-circle'} /> Had an issue creating a link? click here to reclaim the funds.
            </button>

            <Modal
                title="Go nuts with points"
                visible={isPointsModalVisible}
                onClose={() => {
                    setIsPointsModalVisible(false)
                }}
            >
                <div className="flex flex-col items-start justify-center gap-4 p-4 text-h8">
                    <div className="flex flex-col items-start justify-center gap-2">
                        <label>You have gained {points} points by:</label>
                        <ul className="list-outside list-disc space-y-1 pl-4 font-normal">
                            <li>Creating 10 links. </li>
                            <li>Onboarding 10 people this week. (you got 10% of their points 2137 points)</li>
                            <li>
                                Having an{' '}
                                <em>
                                    <strong> early fren </strong>
                                </em>{' '}
                                multiplier of 1.5X.
                            </li>
                        </ul>
                    </div>
                    <div className="flex flex-col items-start justify-center gap-2">
                        <label className="">More more more! How?</label>
                        <ul className="list-outside list-disc space-y-1 pl-4 font-normal">
                            <li>Sending links that get claimed.</li>
                            <li>Claiming links</li>
                        </ul>
                    </div>
                    <div className="flex flex-col items-start justify-center gap-2">
                        <label className="">Multiplier!</label>
                        <ul className="list-outside list-disc space-y-1 pl-4 font-normal">
                            <li>Onboard new users and you will get 10% of the points they get!</li>
                        </ul>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
