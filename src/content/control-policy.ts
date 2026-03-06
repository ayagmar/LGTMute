import type { TargetDescriptor } from "../shared/types";

export interface ControlCandidate {
  descriptor: Pick<TargetDescriptor, "author">;
  root: HTMLElement;
}

export function pickControlRoots(
  targets: ControlCandidate[],
  viewerLogin: string | null,
): Set<HTMLElement> {
  const controlRoots = new Set<HTMLElement>();
  const seenAuthors = new Set<string>();

  for (const target of targets) {
    if (target.descriptor.author === viewerLogin) {
      continue;
    }

    if (seenAuthors.has(target.descriptor.author)) {
      continue;
    }

    seenAuthors.add(target.descriptor.author);
    controlRoots.add(target.root);
  }

  return controlRoots;
}
