import { motion, AnimatePresence } from 'framer-motion'

interface StepTransitionProps {
    children: React.ReactNode
    step: number
    direction: number
}

export const StepTransition = ({ children, step, direction }: StepTransitionProps) => {
    const slideVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0,
        }),
    }

    return (
        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
            <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                    x: { type: 'spring', stiffness: 400, damping: 35 },
                    opacity: { duration: 0.15 },
                }}
                className="absolute h-full w-full"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    )
}
