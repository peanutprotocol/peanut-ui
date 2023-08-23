import {useWeb3Modal} from "@web3modal/react";
import * as global_components from '@/components/global'

export default function DashboardLogin() {
    const {open} = useWeb3Modal()
    return (
        <global_components.CardWrapper>
            <div className="flex flex-col gap-2">
                <div className="text-center">
                    <span onClick={open} className="underline decoration-solid cursor-pointer">Connect</span> your
                    wallet to view your deposits
                </div>
            </div>
        </global_components.CardWrapper>
    )
}
