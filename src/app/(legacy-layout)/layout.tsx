import '@/styles/globals.css'
import Layout from '@/components/Global/Layout'

const LegacyLayout = ({ children }: { children: React.ReactNode }) => {
    return <Layout className="!mx-0 w-full !px-0 ">{children}</Layout>
}

export default LegacyLayout
