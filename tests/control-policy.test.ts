import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { pickControlRoots } from "../src/content/control-policy";

function createRoot(dom: JSDOM): HTMLElement {
  return dom.window.document.createElement("div");
}

describe("pickControlRoots", () => {
  it("returns only the first detected target for each author", () => {
    const dom = new JSDOM("<body></body>");
    const first = createRoot(dom);
    const duplicate = createRoot(dom);
    const secondAuthor = createRoot(dom);

    const roots = pickControlRoots(
      [
        { root: first, descriptor: { author: "octocat" } },
        { root: duplicate, descriptor: { author: "octocat" } },
        { root: secondAuthor, descriptor: { author: "hubot" } },
      ],
      null,
    );

    expect(Array.from(roots)).toEqual([first, secondAuthor]);
  });

  it("skips the currently logged-in viewer", () => {
    const dom = new JSDOM("<body></body>");
    const self = createRoot(dom);
    const other = createRoot(dom);

    const roots = pickControlRoots(
      [
        { root: self, descriptor: { author: "octocat" } },
        { root: other, descriptor: { author: "hubot" } },
      ],
      "octocat",
    );

    expect(Array.from(roots)).toEqual([other]);
  });
});
