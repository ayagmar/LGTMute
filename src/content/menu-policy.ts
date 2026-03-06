import type { TargetDescriptor } from "../shared/types";

export function shouldShowHideThreadAction(
  descriptor: Pick<TargetDescriptor, "commentKey" | "threadKey">,
): boolean {
  return descriptor.threadKey !== descriptor.commentKey;
}
