#!/usr/bin/env bun
// Usage: bun tests/eval.ts <image-path>
// Runs the whiteboard-to-mermaid skill, renders PNG, opens in Chrome.

import { execSync } from "child_process"
import { writeFileSync } from "fs"
import { resolve, dirname } from "path"

const PLUGIN_DIR = resolve(import.meta.dir, "../plugins/whiteboard-to-mermaid")
const image = process.argv[2]

if (!image) {
  console.error("Usage: bun tests/eval.ts <image-path>")
  process.exit(1)
}

const imagePath = resolve(image)
const outMmd = "/tmp/eval-diagram.mmd"
const outPng = "/tmp/eval-diagram.png"

// Run skill via --plugin-dir (no install/update/reload cycle)
console.log("Running skill...")
const raw = execSync(
  `claude -p --plugin-dir "${PLUGIN_DIR}" --dangerously-skip-permissions ` +
  `"use the whiteboard-to-mermaid skill on ${imagePath}"`,
  { encoding: "utf-8", timeout: 90000 }
)

// Strip code fence wrapper
const match = raw.match(/```[^\n]*\n([\s\S]*?)```/)
const mermaid = match ? match[1].trim() : raw.trim()

console.log("\n" + mermaid + "\n")

// Write, render, open
writeFileSync(outMmd, mermaid)
execSync(`bunx @mermaid-js/mermaid-cli -i "${outMmd}" -o "${outPng}"`, { stdio: "inherit" })
execSync(`open -a "Google Chrome" "${outPng}"`)
