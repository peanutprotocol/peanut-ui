import '../../styles/globals.bruddle.css'
import Link from 'next/link'

const Layout = ({ children }: { children: React.ReactNode }) => {
    const tabs = [
        {
            name: 'Home',
            href: '/home',
        },
        {
            name: 'History',
            href: '/history',
        },
    ]
    return (
        <div className="flex h-screen flex-col">
            <div className="border-b-2 p-2">HEADER</div>
            <div className="flex w-full flex-1 overflow-y-scroll border bg-white">{children}</div>
            <div className="grid grid-cols-2 border-t-2 p-2">
                {tabs.map((tab) => (
                    <Link
                        href={tab.href}
                        key={tab.name}
                        className="border-2 text-center hover:cursor-pointer hover:bg-gray-200"
                    >
                        {tab.name}
                    </Link>
                ))}
            </div>
        </div>
    )
}

export default Layout
