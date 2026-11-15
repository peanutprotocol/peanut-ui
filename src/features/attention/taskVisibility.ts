import type { NextAction } from '@/types/capabilities'
import { bridgeTaskDismissalKey } from '@/utils/bridge-tasks.utils'

export const isDismissibleHomeTask = (task: NextAction): boolean => !!task.effectiveDate && task.kind !== 'sumsub'

export function visibleHomeTasks(tasks: NextAction[], dismissed: unknown): NextAction[] {
    const keys = Array.isArray(dismissed) ? dismissed : []
    return tasks.filter((task) => !isDismissibleHomeTask(task) || !keys.includes(bridgeTaskDismissalKey(task)))
}
