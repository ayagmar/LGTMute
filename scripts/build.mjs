import { cpSync, mkdirSync, rmSync, watch as watchFs } from "node:fs";
import { join, resolve } from "node:path";
import { build, context } from "esbuild";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = join(rootDir, "dist");
const srcDir = join(rootDir, "src");
const assetsDir = join(rootDir, "assets");
const isWatch = process.argv.includes("--watch");

const entryPoints = [
  {
    entry: join(srcDir, "content", "index.ts"),
    out: "content",
  },
  {
    entry: join(srcDir, "popup", "index.ts"),
    out: "popup",
  },
  {
    entry: join(srcDir, "options", "index.ts"),
    out: "options",
  },
  {
    entry: join(srcDir, "userscript", "index.ts"),
    out: "lgtmute.user",
    banner: `// ==UserScript==
// @name         LGTMute
// @namespace    https://github.com/ayagmar/LGTMute
// @version      0.1.0
// @description  Hide noisy GitHub posts, replies, threads, and authors with fast local controls.
// @match        https://github.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==`,
    loaders: {
      ".css": "text",
    },
    target: "es2022",
  },
];

const staticCopies = [
  ["popup/popup.html", "popup.html"],
  ["popup/popup.css", "popup.css"],
  ["options/options.html", "options.html"],
  ["options/options.css", "options.css"],
  ["content/content.css", "content.css"],
  ["manifest.json", "manifest.json"],
];

function copyStaticFiles() {
  mkdirSync(distDir, { recursive: true });
  for (const [from, to] of staticCopies) {
    cpSync(join(srcDir, from), join(distDir, to));
  }
}

function copyAssets() {
  cpSync(assetsDir, join(distDir, "assets"), { recursive: true });
}

function createBuildOptions({ entry, out, banner, loaders, target }) {
  return {
    absWorkingDir: rootDir,
    banner: banner ? { js: banner } : undefined,
    bundle: true,
    entryPoints: [entry],
    format: "iife",
    loader: loaders,
    minify: !isWatch,
    outfile: join(distDir, `${out}.js`),
    sourcemap: isWatch ? "inline" : false,
    target: target ?? "chrome120",
  };
}

rmSync(distDir, { recursive: true, force: true });
copyStaticFiles();
copyAssets();

if (isWatch) {
  const contexts = await Promise.all(
    entryPoints.map(async (entryPoint) => {
      const buildContext = await context(createBuildOptions(entryPoint));
      await buildContext.watch();
      return buildContext;
    }),
  );

  const staticWatcher = watchFs(srcDir, { recursive: true }, (_, fileName) => {
    if (!fileName) {
      return;
    }

    if (
      fileName.endsWith(".html") ||
      fileName.endsWith(".css") ||
      fileName === "manifest.json"
    ) {
      copyStaticFiles();
      console.info(`[LGTMute] copied ${fileName}`);
    }
  });

  const assetsWatcher = watchFs(
    assetsDir,
    { recursive: true },
    (_, fileName) => {
      if (!fileName) {
        return;
      }

      copyAssets();
      console.info(`[LGTMute] copied asset ${fileName}`);
    },
  );

  process.on("SIGINT", async () => {
    staticWatcher.close();
    assetsWatcher.close();
    await Promise.all(contexts.map((entryContext) => entryContext.dispose()));
    process.exit(0);
  });

  await new Promise(() => {});
} else {
  await Promise.all(
    entryPoints.map((entryPoint) => build(createBuildOptions(entryPoint))),
  );
}
