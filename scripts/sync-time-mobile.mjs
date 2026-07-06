#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");
const sourceDir = path.join(root, "time");
const targetDir = path.join(root, "mobile", "time-app", "www");
const mobileScript = "native-app.js";

async function copyDir(source, target) {
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
  await fs.cp(source, target, { recursive: true });
}

async function injectNativeScript() {
  const indexPath = path.join(targetDir, "index.html");
  let html = await fs.readFile(indexPath, "utf8");
  html = html
    .replace("<title>ezlong.com</title>", "<title>ezlong time</title>")
    .replace(
      '<script src="app.js"></script>',
      `<script src="app.js"></script>\n  <script type="module" src="${mobileScript}"></script>`
    );
  await fs.writeFile(indexPath, html);
}

async function main() {
  await copyDir(sourceDir, targetDir);
  await fs.copyFile(path.join(root, "mobile", "time-app", "native-app.js"), path.join(targetDir, mobileScript));
  await injectNativeScript();
  console.log(`Synced ${path.relative(root, sourceDir)} -> ${path.relative(root, targetDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
