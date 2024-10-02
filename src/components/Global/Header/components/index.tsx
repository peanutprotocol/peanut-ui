import { Box } from '@chakra-ui/react'
import Link from 'next/link'
import { HTMLAttributes } from 'react'

export const NavItemBox = ({ children }: { children: React.ReactNode }) => {
    return (
        <Box
            className="h-full w-full hover:bg-white hover:text-black"
            px={{
                base: 8,
                lg: 4,
                xl: 8,
            }}
        >
            {children}
        </Box>
    )
}

export const NavLink = ({
    href,
    children,
    ...rest
}: { href: string; children: React.ReactNode } & HTMLAttributes<HTMLAnchorElement>) => {
    return (
        <NavItemBox>
            <Link
                {...rest}
                href={href}
                className="flex h-full w-full items-center justify-start py-2 uppercase  sm:w-max sm:justify-center"
            >
                {children}
            </Link>
        </NavItemBox>
    )
}
