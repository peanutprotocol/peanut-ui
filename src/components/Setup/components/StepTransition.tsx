import { AnimatePresence, motion } from 'framer-motion'

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
        // todo: fix such that the browser view doesnt scroll horizontally and vertically leaving gap
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
                className="h-full w-full"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    )
}