import { twMerge } from "tailwind-merge"

const Title = ({ 
    text, 
    className,
    offset = true
}: { 
    text: string;
    offset?: boolean;
} & React.HTMLAttributes<HTMLParagraphElement>) => {
    return (
        <div className="relative inline-block">
            <p className={twMerge(
                'font-knerd-filled relative text-white',
                offset && 'translate-x-[3px]',
                className
            )}>{text}</p>
            <p className={twMerge('font-knerd-outline absolute top-0 left-0', className)}>{text}</p>
        </div>
    )
}

export default Title
