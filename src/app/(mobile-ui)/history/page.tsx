'use client'

import { useDashboard } from '@/components/Dashboard/useDashboard'
import Modal from '@/components/Global/Modal'
import TablePagination from '@/components/Global/TablePagination'
import { MobileTableComponent, TableComponent, Tabs } from '@/components/Profile/Components'
import { PEANUT_API_URL } from '@/constants'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/context/walletContext'
import { IDashboardItem, IProfileTableData } from '@/interfaces'
import { formatDate, formatIban, printableAddress } from '@/utils'
import { identicon } from '@dicebear/collection'
import { createAvatar } from '@dicebear/core'
import { useEffect, useState } from 'react'

const tabs = [
    {
        title: 'History',
        value: 'history',
    },
    {
        title: 'Contacts',
        value: 'contacts',
    },
    {
        title: 'Accounts',
        value: 'accounts',
    },
]

const HistoryPage = () => {
    const { address } = useWallet()
    const { user } = useAuth()
    const { composeLinkDataArray, fetchLinkDetailsAsync, removeRequestLinkFromLocalStorage } = useDashboard()

    const [selectedTab, setSelectedTab] = useState<'contacts' | 'history' | 'accounts' | undefined>(undefined)
    const [tableData, setTableData] = useState<IProfileTableData[]>([])
    const [dashboardData, setDashboardData] = useState<IDashboardItem[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)
    const [modalVisible, setModalVisible] = useState(false)
    const [modalType, setModalType] = useState<'Boost' | 'Invites' | undefined>(undefined)
    const [contactsData, setContactsData] = useState<
        {
            userName: string
            address: string
            txs: number
            avatar: string | undefined
        }[]
    >([])
    const [accountsData, setAccountData] = useState<
        {
            type: string
            accountIdentifier: string
        }[]
    >([])

    // Calculate the number of items that can be displayed on the page
    // Calculate the number of items that can be displayed on the page
    const calculateItemsPerPage = () => {
        const itemHeight = 100
        const availableHeight = window.innerHeight - 300
        const calculatedItems = Math.floor(availableHeight / itemHeight)
        // Only update if the change is significant
        if (Math.abs(calculatedItems - itemsPerPage) > 1) {
            setItemsPerPage(Math.max(calculatedItems, 1))
        }
    }

    const handleDeleteLink = async (link: string) => {
        const url = new URL(link ?? '')
        const id = url.searchParams.get('id')

        removeRequestLinkFromLocalStorage(link)

        setTableData((prevData) =>
            prevData.filter((item) => {
                return item.dashboardItem?.link !== link
            })
        )
        await fetch(`${PEANUT_API_URL}/request-links/${id}/cancel`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey: process.env.PEANUT_API_KEY,
            }),
        })
    }

    useEffect(() => {
        calculateItemsPerPage()
        window.addEventListener('resize', calculateItemsPerPage)
        return () => {
            window.removeEventListener('resize', calculateItemsPerPage)
        }
    }, [])

    // UseEffect hook to set the contacts and account once the user is fetched
    useEffect(() => {
        if (!user) return

        const dashboardData = composeLinkDataArray(address ?? '')
        setDashboardData(dashboardData)

        const contactsData =
            user?.contacts &&
            user.contacts.map((contact) => ({
                userName: contact.nickname ?? contact.username ?? contact.ens_name ?? '-',
                address: contact.account_identifier,
                txs: contact.n_interactions,
                avatar: contact.profile_picture ?? '',
            }))
        setContactsData(contactsData)
        const accountsData =
            user?.accounts &&
            user.accounts.map((account) => ({
                type:
                    account.account_type === 'iban'
                        ? 'Bank account (iban)'
                        : account.account_type === 'us'
                          ? 'Bank account (US account)'
                          : 'Wallet',
                accountIdentifier: account.account_identifier,
            }))
        setAccountData(accountsData)

        setSelectedTab('history')
    }, [user])

    // UseEffect hook to set the table data based on the selected tab
    useEffect(() => {
        switch (selectedTab) {
            case 'history':
                setTotalPages(Math.ceil(dashboardData.length / itemsPerPage))
                setCurrentPage(1)
                setTableData(
                    dashboardData.map((data) => ({
                        primaryText: data.type,
                        secondaryText: formatDate(new Date(data.date)) ?? '',
                        tertiaryText: `${data.amount} ${data.tokenSymbol} - [${data.chain}]`,
                        quaternaryText: data.status ?? '',
                        itemKey: (data.link ?? data.txHash ?? '') + Math.random(),
                        type: 'history',
                        avatar: {
                            iconName: undefined,
                            avatarUrl: undefined,
                        },
                        dashboardItem: data,
                    }))
                )
                break
            case 'contacts':
                setTotalPages(Math.ceil(contactsData.length / itemsPerPage))
                setCurrentPage(1)
                setTableData(
                    contactsData.map((data) => {
                        const avatarUrl = data.avatar
                            ? data.avatar.length > 0
                                ? data.avatar
                                : createAvatar(identicon, {
                                      seed: data.address,
                                  }).toDataUri()
                            : createAvatar(identicon, {
                                  seed: data.address,
                              }).toDataUri()

                        return {
                            primaryText: data.userName,
                            address: data.address,
                            secondaryText: '',
                            tertiaryText: printableAddress(data.address) ?? '',
                            quaternaryText: data.txs.toString(),
                            itemKey: data.userName + Math.random(),
                            type: 'contacts',
                            avatar: {
                                iconName: undefined,
                                avatarUrl: avatarUrl,
                            },
                        }
                    })
                )
                break
            case 'accounts':
                setTotalPages(Math.ceil(accountsData.length / itemsPerPage))
                setCurrentPage(1)
                setTableData(
                    accountsData.map((data) => ({
                        primaryText: data.type,
                        secondaryText: '',
                        tertiaryText: data.type.includes('Bank')
                            ? formatIban(data.accountIdentifier)
                            : data.accountIdentifier,
                        quaternaryText: '',
                        itemKey: data.accountIdentifier + Math.random(),
                        type: 'accounts',
                        avatar: {
                            iconName: undefined,
                            avatarUrl: undefined,
                        },
                    }))
                )
                break
            default:
                break
        }
        async function _fetchLinkDetailsAsync(dashboardData: IDashboardItem[]) {
            const data = await fetchLinkDetailsAsync(dashboardData)
            setTableData((prevData) =>
                prevData.map((item) => {
                    const _item = data.find((d) => d.link === item.itemKey)
                    if (_item) {
                        item.quaternaryText = _item.status ?? 'pending'
                    }
                    return item
                })
            )
        }
        const visibleData = tableData
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .filter((item) => item.quaternaryText === undefined)
        if (visibleData.length > 0) {
            _fetchLinkDetailsAsync(dashboardData)
        }
    }, [selectedTab])

    // UseEffect hook to fetch the link details for the visible data
    useEffect(() => {
        async function _fetchLinkDetailsAsync(visibleData: IDashboardItem[]) {
            console.log('visibleData', visibleData)
            const data = await fetchLinkDetailsAsync(visibleData)
            setDashboardData((prevData) =>
                prevData.map((item) => {
                    const updatedItem = data.find((updated) => updated.link === item.link)
                    return updatedItem && item.status === undefined ? { ...item, status: updatedItem.status } : item
                })
            )
        }

        const visibleData = dashboardData
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .filter((item) => item.status === undefined)
        if (selectedTab === 'history' && visibleData.length > 0) {
            _fetchLinkDetailsAsync(visibleData)
        }
    }, [currentPage, selectedTab])

    return (
        <div className="w-full">
            <div className="flex w-full flex-col items-center justify-center gap-2 pb-2">
                <Tabs
                    items={tabs}
                    value={selectedTab}
                    setValue={setSelectedTab}
                    className="mx-0 w-full gap-0 px-0"
                    classButton="w-1/3 mx-0 px-0 ml-0 !rounded-none"
                />
                <div className="block w-full sm:hidden">
                    {tableData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((data) => (
                        <div key={(data.itemKey ?? '') + Math.random()}>
                            <MobileTableComponent
                                itemKey={(data.itemKey ?? '') + Math.random()}
                                primaryText={data.primaryText}
                                secondaryText={data.secondaryText}
                                tertiaryText={data.tertiaryText}
                                quaternaryText={data.quaternaryText}
                                address={data.address}
                                type={data.type}
                                avatar={data.avatar}
                                dashboardItem={data.dashboardItem}
                            />
                        </div>
                    ))}{' '}
                </div>
                <div className="hidden w-full sm:block">
                    <TableComponent
                        data={tableData}
                        selectedTab={selectedTab}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        handleDeleteLink={handleDeleteLink}
                    />
                </div>
                {dashboardData.length > 0 && totalPages > 1 && (
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
            </div>
            <Modal
                visible={modalVisible}
                onClose={() => {
                    setModalVisible(false)
                }}
                title={modalType}
                classNameWrapperDiv="px-5 pb-7 pt-8"
            >
                {modalType === 'Boost' ? (
                    <div className="flex w-full flex-col items-center justify-center gap-2 text-h7">
                        <div className="flex w-full items-center justify-between">
                            <label>Early frend</label>
                            <label>1.4X</label>
                        </div>
                        <div className="flex w-full items-center justify-between">
                            <label>Total</label>
                            <label>1.4X</label>
                        </div>
                    </div>
                ) : (
                    ''
                )}
            </Modal>
        </div>
    )
}

export default HistoryPage
