---
name: preview-mermaid
description: Render a .mmd file to PNG and open it in Google Chrome for preview. Pass the .mmd file path as an argument.
argument-hint: <path-to-diagram.mmd>
allowed-tools: Bash
---

`$ARGUMENTS` is the path to a `.mmd` Mermaid diagram file.

1. Derive the output PNG path by replacing the `.mmd` extension with `.png`.
2. Run: `bunx @mermaid-js/mermaid-cli -i $ARGUMENTS -o <output-path>`
3. Run: `open -a "Google Chrome" <output-path>`

Output only the output PNG path on success. No preamble.
