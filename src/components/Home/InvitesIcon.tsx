import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'
import Image from 'next/image'
import { motion } from 'framer-motion'

const InvitesIcon = () => {
    return (
        <motion.div
            animate={{
                rotate: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -15, 15, -10, 10, -5, 0],
                y: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -2, 0, -1, 0, -1, 0],
            }}
            transition={{
                duration: 10,
                repeat: Infinity,
                ease: 'easeInOut',
            }}
            whileHover={{
                scale: 1.3,
                rotate: 20,
                transition: { duration: 0.3, ease: 'easeOut' },
            }}
            whileTap={{
                scale: 0.9,
                transition: { duration: 0.1 },
            }}
            style={{
                transition: 'transform 0.3s ease-out',
            }}
        >
            <Image src={STAR_STRAIGHT_ICON} alt="star" width={20} height={20} />
        </motion.div>
    )
}

export default InvitesIcon
