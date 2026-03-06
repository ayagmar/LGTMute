import contentCss from "../content/content.css";
import { bootstrapContent } from "../content/app";
import { userscriptStorage } from "./storage";

const STYLE_ID = "lgtmute-userscript-style";
const LOADED_FLAG = "__LGTMUTE_USERSCRIPT_LOADED__";

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = contentCss;
  document.head.append(style);
}

async function start(): Promise<void> {
  const target = globalThis as typeof globalThis & {
    [LOADED_FLAG]?: boolean;
  };
  if (target[LOADED_FLAG]) {
    return;
  }

  target[LOADED_FLAG] = true;
  injectStyles();
  await bootstrapContent(userscriptStorage);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void start(), {
    once: true,
  });
} else {
  void start();
}
