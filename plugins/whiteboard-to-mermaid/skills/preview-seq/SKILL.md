---
name: preview-seq
description: Render a .seq diagram file to SVG and open it in Google Chrome for preview.
argument-hint: <path-to-diagram.seq>
---

`$ARGUMENTS` is the path to a `.seq` diagram file.

1. Derive the output SVG path by replacing the `.seq` extension with `.svg`.
2. Run: `bun "${CLAUDE_PLUGIN_ROOT}/bin/seq-render" "$ARGUMENTS" "<output-svg-path>"`
3. Run: `open -a "Google Chrome" "<output-svg-path>"`

Output only the output SVG path on success. No preamble.
