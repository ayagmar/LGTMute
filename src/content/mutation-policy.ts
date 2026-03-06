const OWNED_SELECTOR = "[data-lgtmute-owned]";

function isOwnedNode(node: Node): boolean {
  if (node instanceof Element) {
    return (
      node.matches(OWNED_SELECTOR) || Boolean(node.closest(OWNED_SELECTOR))
    );
  }

  return Boolean(node.parentElement?.closest(OWNED_SELECTOR));
}

export function shouldScheduleScan(records: MutationRecord[]): boolean {
  for (const record of records) {
    const changedNodes = [...record.addedNodes, ...record.removedNodes];
    if (changedNodes.length === 0) {
      return true;
    }

    if (changedNodes.some((node) => !isOwnedNode(node))) {
      return true;
    }
  }

  return false;
}
