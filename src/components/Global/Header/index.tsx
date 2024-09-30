'use client'
import React, { useEffect, useState } from 'react'
import { Box, Flex, Text, Stack, Collapse, useDisclosure } from '@chakra-ui/react'
import { useLottie, LottieOptions } from 'lottie-react'

import Link from 'next/link'
// import Image from 'next/image'

import { PEANUTMAN_LOGO, HAMBURGER_LOTTIE } from '@/assets'
import { shortenAddress } from '@/utils'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'

const defaultLottieOptions: LottieOptions = {
    animationData: HAMBURGER_LOTTIE,
    loop: true,
    autoplay: false,
    rendererSettings: {
        preserveAspectRatio: 'xMidYMid slice',
    },
}

const defaultLottieStyle = {
    height: 24,
    width: 24,
}

export const Header = () => {
    const { isOpen, onToggle } = useDisclosure()
    const [isOpenState, setIsOpenState] = useState<boolean>(false)

    useEffect(() => {
        setIsOpenState(!isOpen)
    }, [isOpen])

    return (
        <NavBarContainer>
            <Flex width={'100%'} alignItems={'center'} justifyContent={'space-between'} height={'16'}>
                <Box display={{ base: 'none', md: 'flex' }} flexDirection={'row'} height="100%">
                    <div
                        className="flex h-full cursor-pointer items-center px-2 font-bold uppercase hover:bg-white hover:text-black"
                        onClick={() => {
                            if (window?.location.pathname == '/') window?.location.reload()
                            else window.location.href = '/'
                        }}
                    >
                        <img src={PEANUTMAN_LOGO.src} alt="logo" className="ml-2 h-6 sm:h-9" />
                        <span className="inline px-3 sm:px-4">peanut protocol</span>
                    </div>
                </Box>

                <Box display={{ base: 'none', md: 'block' }} flexDirection={'row'} alignContent={'center'}>
                    <MenuLinks />
                </Box>

                <Box
                    display={{ base: 'flex', md: 'none' }}
                    flexDirection={'row'}
                    justifyContent={'space-between'}
                    alignContent={'center'}
                    width={'100%'}
                    height={'100%'}
                >
                    <div
                        className="flex h-full cursor-pointer items-center px-2 font-bold uppercase hover:bg-white hover:text-black"
                        onClick={() => {
                            if (window?.location.pathname == '/') window?.location.reload()
                            else window.location.href = '/'
                        }}
                    >
                        <img src={PEANUTMAN_LOGO.src} alt="logo" className="ml-2 h-6 " />
                        <span className="text-h5- inline px-2 ">peanut protocol</span>
                    </div>

                    <MenuToggle isOpen={isOpenState} toggle={onToggle} />
                </Box>

                <Box display={{ base: 'none', md: 'block' }}>
                    <SocialLinks />
                </Box>
            </Flex>

            <Collapse unmountOnExit in={isOpen} animateOpacity className="w-full">
                <MenuLinks />
            </Collapse>
        </NavBarContainer>
    )
}

const MenuToggle = ({ toggle, isOpen }: { toggle: () => void; isOpen: boolean }) => {
    const { View: lottieView, goToAndStop } = useLottie(defaultLottieOptions, defaultLottieStyle)

    return (
        <Flex
            height={'100%'}
            justifyContent={'center'}
            alignContent={'center'}
            alignItems={'center'}
            display={{ base: 'flex', md: 'none' }}
            onClick={() => {
                toggle()
                goToAndStop(isOpen ? 37 : 0, true)
            }}
            px={3}
            className="bg-n-1"
        >
            {lottieView}
        </Flex>
    )
}

const MenuLinks = () => {
    const [showMenu, setShowMenu] = useState<boolean>(false)
    const { open: web3modalOpen } = useWeb3Modal()
    const { address, isConnected } = useAccount()
    const router = useRouter()

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        // Prevent the default behavior of the link
        e.preventDefault()
        // Force a reload of the current route
        if (window?.location.pathname == '/send') window?.location.reload()
        else router.push('/send')
    }

    return (
        <Stack
            align={{ base: 'start', md: 'center' }}
            justify={{ base: 'center', md: 'center' }}
            direction={{ base: 'column', md: 'row' }}
            // pt={ 4}
            pb={{ base: 4, md: 0 }}
            height="100%"
            gap={0}
        >
            <Link
                href={'/send'}
                onClick={handleClick}
                className="flex h-full w-full items-center justify-start rounded-md px-2 py-2 uppercase transition-colors hover:bg-n-4/50 hover:text-black sm:w-max sm:justify-center lg:px-6"
            >
                <Text display="block"> app</Text>
            </Link>

            <div className="relative hidden h-full sm:block">
                <button
                    onMouseEnter={() => {
                        setShowMenu(true)
                    }}
                    onMouseLeave={() => {
                        setShowMenu(false)
                    }}
                    className="flex h-full w-full items-center justify-start rounded-md px-2 py-2 uppercase transition-colors hover:bg-n-4/50 hover:text-black sm:w-max sm:justify-center sm:px-6"
                >
                    tools
                </button>
                {showMenu && (
                    <div
                        onMouseEnter={() => {
                            setShowMenu(true)
                        }}
                        onMouseLeave={() => {
                            setShowMenu(false)
                        }}
                        className="border-rounded ring-sm absolute left-0 z-10 w-48 origin-top-right bg-white p-0 p-1 font-medium uppercase text-black no-underline shadow-lg transition-colors"
                    >
                        <Link
                            href={'/raffle/create'}
                            className="flex h-full w-full items-center justify-start rounded-md px-2 py-2 uppercase transition-colors hover:bg-n-4/50 hover:text-n-1 sm:justify-start sm:px-6"
                        >
                            <Text display="block"> raffle</Text>
                        </Link>
                        <Link
                            href={'/batch/create'}
                            className="flex h-full w-full items-center justify-start rounded-md px-2 py-2 uppercase transition-colors hover:bg-n-4/50 hover:text-n-1 sm:justify-start sm:px-6"
                        >
                            <Text display="block"> batch</Text>
                        </Link>
                        <Link
                            href={'/refund'}
                            className="flex h-full w-full items-center justify-start rounded-md px-2 py-2 uppercase transition-colors hover:bg-n-4/50 hover:text-n-1 sm:justify-start sm:px-6"
                        >
                            <Text display="block"> refund</Text>
                        </Link>
                    </div>
                )}
            </div>
            <div className="relative block h-full w-full sm:hidden">
                <button
                    onClick={() => {
                        setShowMenu(!showMenu)
                    }}
                    className="text-bold flex h-full w-full items-center justify-start rounded-md px-2 py-2 uppercase transition-colors hover:bg-n-4/50 hover:text-n-1 sm:w-max sm:justify-center sm:px-6"
                >
                    <Text display="block"> tools</Text>
                </button>
                {showMenu && (
                    <div className="border-rounded ring-sm bg-white p-0 p-1 font-medium uppercase text-n-1 no-underline shadow-lg">
                        <Link
                            href={'/raffle/create'}
                            className="flex h-full w-full items-center justify-start rounded-md py-2 pl-6 uppercase text-black transition-colors hover:bg-n-4/50 hover:text-n-1 sm:justify-start sm:px-6"
                        >
                            <Text display="block"> raffle</Text>
                        </Link>
                        <Link
                            href={'/batch/create'}
                            className="flex h-full w-full items-center justify-start rounded-md py-2 pl-6 uppercase text-black transition-colors hover:bg-n-4/50 hover:text-n-1 sm:justify-start sm:px-6"
                        >
                            <Text display="block"> batch</Text>
                        </Link>
                        <Link
                            href={'/refund'}
                            className="flex h-full w-full items-center justify-start rounded-md py-2 pl-6 uppercase text-black transition-colors hover:bg-n-4/50 hover:text-n-1 sm:justify-start sm:px-6"
                        >
                            <Text display="block"> refund</Text>
                        </Link>
                    </div>
                )}
            </div>

            <Link
                href={'https://docs.peanut.to'}
                className="flex h-full w-full items-center justify-start rounded-md px-2 py-2 uppercase transition-colors hover:bg-n-4/50 hover:text-black sm:w-max sm:justify-center sm:px-6"
            >
                <Text display="block"> docs</Text>
            </Link>

            <Link
                href={'/profile'}
                className=" flex h-full w-full items-center justify-start px-3 py-2 uppercase hover:bg-white hover:text-black sm:hidden sm:w-max sm:justify-center sm:px-6"
            >
                <Text display="block"> Profile</Text>
            </Link>
            <button
                onClick={() => {
                    web3modalOpen()
                }}
                className="flex h-full w-full items-center justify-start px-2 py-2 uppercase hover:bg-white hover:text-black sm:hidden sm:w-max sm:justify-center sm:px-6"
            >
                <Text display="block">
                    {' '}
                    {isConnected ? (
                        shortenAddress(address ?? '')
                    ) : (
                        <>
                            <span className="md:hidden lg:block">Create or </span>Connect
                        </>
                    )}
                </Text>
            </button>
        </Stack>
    )
}

const SocialLinks = () => {
    const { open: web3modalOpen } = useWeb3Modal()
    const { address, isConnected } = useAccount()

    return (
        <Stack direction={'row'} spacing={3} mr={2}>
            <Link href={'/profile'} className="no-underline">
                <button className="btn-ghost h-10 px-3 uppercase">Profile</button>
            </Link>
            <button
                className="btn h-10 bg-n-1 px-3 uppercase text-white"
                onClick={() => {
                    web3modalOpen()
                }}
            >
                {isConnected ? (
                    shortenAddress(address ?? '')
                ) : (
                    <>
                        <span className="md:hidden lg:block">Create or &nbsp;</span>Connect
                    </>
                )}
            </button>
        </Stack>
    )
}

const NavBarContainer = ({ children, ...props }: { children: React.ReactNode }) => {
    const themeBG = 'white'
    const themeColor = 'black'

    return (
        <Flex
            as="nav"
            align="center"
            justify="space-between"
            wrap="wrap"
            w="100%"
            bg={{ base: themeBG, md: themeBG }}
            color={{ base: themeColor, md: themeColor }}
            {...props}
            className="border-b-2 border-n-1 font-black shadow ring-2 ring-white"
        >
            {children}
        </Flex>
    )
}

export default Header
