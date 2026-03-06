import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { shouldScheduleScan } from "../src/content/mutation-policy";

function installDom(): JSDOM {
  const dom = new JSDOM("<body></body>");

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Node: dom.window.Node,
    Element: dom.window.Element,
  });

  return dom;
}

function createRecord({
  addedNodes = [],
  removedNodes = [],
}: {
  addedNodes?: Node[];
  removedNodes?: Node[];
}): MutationRecord {
  return {
    addedNodes,
    removedNodes,
  } as unknown as MutationRecord;
}

afterEach(() => {
  delete (globalThis as Partial<typeof globalThis>).window;
  delete (globalThis as Partial<typeof globalThis>).document;
  delete (globalThis as Partial<typeof globalThis>).Node;
  delete (globalThis as Partial<typeof globalThis>).Element;
});

describe("shouldScheduleScan", () => {
  it("skips rescans for LGTMute-owned DOM mutations", () => {
    const dom = installDom();
    const button = dom.window.document.createElement("button");
    button.setAttribute("data-lgtmute-owned", "button");

    expect(shouldScheduleScan([createRecord({ addedNodes: [button] })])).toBe(
      false,
    );
  });

  it("rescans when GitHub adds non-owned nodes", () => {
    const dom = installDom();
    const comment = dom.window.document.createElement("div");
    comment.className = "comment-viewer";

    expect(shouldScheduleScan([createRecord({ addedNodes: [comment] })])).toBe(
      true,
    );
  });
});
