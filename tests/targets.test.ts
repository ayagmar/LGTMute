import { readFileSync } from "node:fs";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import {
  findObservationRoots,
  findObserverRoots,
  findTargets,
} from "../src/content/targets";

function installDom(html: string, url: string): void {
  const dom = new JSDOM(html, { url });

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Node: dom.window.Node,
    HTMLElement: dom.window.HTMLElement,
    HTMLAnchorElement: dom.window.HTMLAnchorElement,
  });
}

function installDomFromFixture(name: string, url: string): void {
  const html = readFileSync(
    new URL(`./fixtures/${name}`, import.meta.url),
    "utf8",
  );
  installDom(html, url);
}

afterEach(() => {
  delete (globalThis as Partial<typeof globalThis>).window;
  delete (globalThis as Partial<typeof globalThis>).document;
  delete (globalThis as Partial<typeof globalThis>).Node;
  delete (globalThis as Partial<typeof globalThis>).HTMLElement;
  delete (globalThis as Partial<typeof globalThis>).HTMLAnchorElement;
});

describe("findTargets", () => {
  it("prefers top-level observation roots over nested fallbacks", () => {
    installDom(
      `
        <main>
          <section data-testid="issue-viewer-container">
            <article data-testid="issue-body">
              <a data-testid="issue-comment-header-author" href="/octocat">octocat</a>
              <a
                data-testid="issue-comment-header-link"
                href="https://github.com/owner/repo/issues/1#issue-1"
              >
                permalink
              </a>
              <div data-testid="comment-actions">
                <button aria-haspopup="true" type="button">Actions</button>
              </div>
              <div data-testid="markdown-body"><p>Hello</p></div>
            </article>
          </section>
        </main>
      `,
      "https://github.com/owner/repo/issues/1",
    );

    const roots = findObservationRoots();

    expect(roots).toHaveLength(1);
    expect(roots[0]?.getAttribute("data-testid")).toBe(
      "issue-viewer-container",
    );
  });

  it("scans every top-level GitHub discussion root on split issue layouts", () => {
    installDom(
      `
        <main>
          <section data-testid="issue-viewer-container"></section>
          <div id="discussion_bucket"></div>
        </main>
      `,
      "https://github.com/owner/repo/issues/1",
    );

    const roots = findObservationRoots();

    expect(roots).toHaveLength(2);
    expect(roots[0]?.getAttribute("data-testid")).toBe(
      "issue-viewer-container",
    );
    expect(roots[1]?.id).toBe("discussion_bucket");
  });

  it("keeps a broader observer root when GitHub mounts discussion later", () => {
    installDom(
      `
        <main>
          <section data-testid="issue-viewer-container"></section>
        </main>
      `,
      "https://github.com/owner/repo/issues/1",
    );

    const observerRoots = findObserverRoots();

    expect(observerRoots).toHaveLength(1);
    expect(observerRoots[0]?.tagName).toBe("MAIN");
  });

  it("falls back to the page body when no GitHub discussion root is present", () => {
    installDom(
      `<div class="standalone-comment-shell"><p>Nothing matched yet.</p></div>`,
      "https://github.com/owner/repo/issues/1",
    );

    expect(findObservationRoots()).toEqual([document.body]);
  });

  it("detects modern issue bodies via the modern strategy", () => {
    installDomFromFixture(
      "issue-body.html",
      "https://github.com/microsoft/TypeScript/issues/1",
    );

    const targets = findTargets();

    expect(targets).toHaveLength(1);
    expect(targets[0]?.descriptor).toEqual({
      author: "ryancavanaugh",
      commentKey:
        "comment:https://github.com/microsoft/TypeScript/issues/1#issue-37836623",
      threadKey:
        "thread:https://github.com/microsoft/TypeScript/issues/1#issue-37836623",
      repoKey: "microsoft/typescript",
      label: "post",
    });
  });

  it("dedupes nested modern wrappers that resolve to the same comment", () => {
    installDom(
      `
        <section data-testid="issue-viewer-container">
          <article data-testid="issue-body">
            <div data-testid="issue-comment-header">
              <a data-testid="issue-comment-header-author" href="/octocat">octocat</a>
              <a
                data-testid="issue-comment-header-link"
                href="https://github.com/owner/repo/issues/1#issue-42"
              >
                permalink
              </a>
              <div data-testid="comment-actions">
                <button aria-haspopup="true" type="button">Actions</button>
              </div>
            </div>
            <section data-testid="issue-body-viewer">
              <div class="react-issue-body">
                <div data-testid="markdown-body"><p>Hello</p></div>
              </div>
            </section>
          </article>
        </section>
      `,
      "https://github.com/owner/repo/issues/1",
    );

    const targets = findTargets();

    expect(targets).toHaveLength(1);
    expect(targets[0]?.descriptor.commentKey).toBe(
      "comment:https://github.com/owner/repo/issues/1#issue-42",
    );
  });

  it("detects legacy pull request comments via the legacy strategy", () => {
    installDomFromFixture(
      "legacy-pr-comment.html",
      "https://github.com/facebook/react/pull/1",
    );

    const targets = findTargets();

    expect(targets).toHaveLength(1);
    expect(targets[0]?.descriptor.author).toBe("benjamn");
    expect(targets[0]?.descriptor.commentKey).toBe(
      "comment:https://github.com/facebook/react/pull/1#issuecomment-500",
    );
    expect(targets[0]?.descriptor.threadKey).toBe(
      "thread:https://github.com/facebook/react/pull/1#issuecomment-500",
    );
  });

  it("does not treat timeline comment groups as a single comment root", () => {
    installDom(
      `
        <div class="timeline-comment-group">
          <div class="TimelineItem js-comment-container discussion-timeline-item">
            <div class="timeline-comment-actions">
              <button aria-haspopup="true" type="button">Actions</button>
            </div>
            <h2 class="timeline-comment-header-text">
              <a class="author Link--primary text-bold" href="/veeceey">veeceey</a>
              <a href="https://github.com/expressjs/express/issues/7034#issuecomment-1">
                first
              </a>
            </h2>
            <div class="comment-body markdown-body js-comment-body">
              <p>First comment body.</p>
            </div>
          </div>
          <div class="TimelineItem js-comment-container discussion-timeline-item">
            <div class="timeline-comment-actions">
              <button aria-haspopup="true" type="button">Actions</button>
            </div>
            <h2 class="timeline-comment-header-text">
              <a class="author Link--primary text-bold" href="/someoneelse">
                someoneelse
              </a>
              <a href="https://github.com/expressjs/express/issues/7034#issuecomment-2">
                second
              </a>
            </h2>
            <div class="comment-body markdown-body js-comment-body">
              <p>Second comment body.</p>
            </div>
          </div>
        </div>
      `,
      "https://github.com/expressjs/express/issues/7034",
    );

    const targets = findTargets();

    expect(targets).toHaveLength(2);
    expect(targets.map((target) => target.descriptor.author)).toEqual([
      "veeceey",
      "someoneelse",
    ]);
    expect(
      targets.every((target) => target.root.matches(".js-comment-container")),
    ).toBe(true);
    expect(targets[0]?.descriptor.threadKey).toBe(
      "thread:https://github.com/expressjs/express/issues/7034#issuecomment-1",
    );
    expect(targets[1]?.descriptor.threadKey).toBe(
      "thread:https://github.com/expressjs/express/issues/7034#issuecomment-1",
    );
  });

  it("resolves review-thread roots when a comment lives inside a thread container", () => {
    installDomFromFixture(
      "review-thread.html",
      "https://github.com/facebook/react/pull/1",
    );

    const targets = findTargets();

    expect(targets).toHaveLength(1);
    expect(targets[0]?.root.classList.contains("js-comment-container")).toBe(
      true,
    );
    expect(
      targets[0]?.threadRoot.classList.contains(
        "js-resolvable-timeline-thread-container",
      ),
    ).toBe(true);
    expect(targets[0]?.descriptor.threadKey).toBe(
      "thread:https://github.com/facebook/react/pull/1#discussion_r123",
    );
  });

  it("fails closed when a candidate looks comment-like but has no comment body", () => {
    installDomFromFixture(
      "heuristic-without-body.html",
      "https://github.com/owner/repo/issues/1",
    );

    expect(findTargets()).toHaveLength(0);
  });

  it("falls back to embedded timeline data when the rendered comment has no author link", () => {
    installDom(
      `
        <script data-target="react-app.embeddedData" type="application/json">
          {
            "payload": {
              "preloadedQueries": [
                {
                  "result": {
                    "data": {
                      "repository": {
                        "issue": {
                          "frontTimelineItems": {
                            "edges": [
                              {
                                "node": {
                                  "url": "https://github.com/owner/repo/issues/1#issuecomment-42",
                                  "author": { "login": "octocat" }
                                }
                              }
                            ]
                          }
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
        </script>
        <div class="TimelineItem js-comment-container">
          <div class="timeline-comment-actions">
            <button aria-haspopup="true" type="button">Actions</button>
          </div>
          <h2 class="timeline-comment-header-text">
            <a href="https://github.com/owner/repo/issues/1#issuecomment-42">permalink</a>
          </h2>
          <div class="comment-body markdown-body js-comment-body">
            <p>Comment body.</p>
          </div>
        </div>
      `,
      "https://github.com/owner/repo/issues/1",
    );

    const targets = findTargets();

    expect(targets).toHaveLength(1);
    expect(targets[0]?.descriptor.author).toBe("octocat");
  });

  it("detects each modern React comment viewer and ignores the timeline wrapper id", () => {
    installDom(
      `
        <main>
          <section data-testid="issue-viewer-container">
            <div data-testid="issue-viewer-comments-container">
              <div data-testid="issue-timeline-container" id="issue-timeline">
                <div
                  data-testid="comment-viewer-outer-box-IC_one"
                  class="IssueCommentViewer-module__IssueCommentContent__LvnJw"
                >
                  <div id="issuecomment-101" data-testid="comment-header">
                    <div data-testid="comment-header-left-side-items">
                      <a
                        data-testid="avatar-link"
                        data-hovercard-type="user"
                        href="/badlogic"
                      >
                        badlogic
                      </a>
                      <a href="https://github.com/owner/repo/issues/1#issuecomment-101">
                        on Mar 6, 2026
                      </a>
                    </div>
                    <div data-testid="comment-header-right-side-items">
                      <div class="ActivityHeader-module__ActionsButtonsContainer__YAGtp">
                        <button aria-haspopup="true" type="button">Actions</button>
                      </div>
                    </div>
                  </div>
                  <div class="IssueCommentViewer-module__IssueCommentBody__IXu9t">
                    <div data-testid="markdown-body"><p>First comment</p></div>
                  </div>
                </div>
                <div
                  data-testid="comment-viewer-outer-box-IC_two"
                  class="IssueCommentViewer-module__IssueCommentContent__LvnJw"
                >
                  <div id="issuecomment-102" data-testid="comment-header">
                    <div data-testid="comment-header-left-side-items">
                      <a
                        data-testid="avatar-link"
                        data-hovercard-type="user"
                        href="/bsklaroff"
                      >
                        bsklaroff
                      </a>
                      <a href="https://github.com/owner/repo/issues/1#issuecomment-102">
                        on Mar 6, 2026
                      </a>
                    </div>
                    <div data-testid="comment-header-right-side-items">
                      <div class="ActivityHeader-module__ActionsButtonsContainer__YAGtp">
                        <button aria-haspopup="true" type="button">Actions</button>
                      </div>
                    </div>
                  </div>
                  <div class="IssueCommentViewer-module__IssueCommentBody__IXu9t">
                    <div data-testid="markdown-body"><p>Second comment</p></div>
                  </div>
                </div>
                <div
                  data-testid="comment-viewer-outer-box-IC_three"
                  class="IssueCommentViewer-module__IssueCommentContent__LvnJw"
                >
                  <div id="issuecomment-103" data-testid="comment-header">
                    <div data-testid="comment-header-left-side-items">
                      <a
                        data-testid="avatar-link"
                        data-hovercard-type="user"
                        href="/bsklaroff"
                      >
                        bsklaroff
                      </a>
                      <a href="https://github.com/owner/repo/issues/1#issuecomment-103">
                        on Mar 6, 2026
                      </a>
                    </div>
                    <div data-testid="comment-header-right-side-items">
                      <div class="ActivityHeader-module__ActionsButtonsContainer__YAGtp">
                        <button aria-haspopup="true" type="button">Actions</button>
                      </div>
                    </div>
                  </div>
                  <div class="IssueCommentViewer-module__IssueCommentBody__IXu9t">
                    <div data-testid="markdown-body"><p>Third comment</p></div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      `,
      "https://github.com/owner/repo/issues/1",
    );

    const targets = findTargets();

    expect(targets).toHaveLength(3);
    expect(targets.map((target) => target.descriptor.author)).toEqual([
      "badlogic",
      "bsklaroff",
      "bsklaroff",
    ]);
    expect(targets.map((target) => target.descriptor.commentKey)).toEqual([
      "comment:https://github.com/owner/repo/issues/1#issuecomment-101",
      "comment:https://github.com/owner/repo/issues/1#issuecomment-102",
      "comment:https://github.com/owner/repo/issues/1#issuecomment-103",
    ]);
  });
});
