interface TimelineProps {
    label: string
    value: string
}

const Timeline = ({ label, value }: TimelineProps) => {
    return (
        <div className="border-l border-n-1 py-3.5 dark:border-white">
            <div className="mb-3.5 flex items-center text-xs last:mb-0">
                <div className="h-0.25 w-4 bg-n-1 dark:bg-white"></div>
                <div className="mr-3.5 h-2.5 w-2.5 rounded-full bg-n-1 dark:bg-white"></div>
                <div className="mr-2.5 min-w-[5.25rem] font-medium text-n-3 dark:text-white/50">{label}</div>
                <div className="font-bold">{value}</div>
            </div>
        </div>
    )
}

export default Timeline
