---
name: whiteboard-to-mermaid
description: Convert a whiteboard sequence diagram photo to .seq syntax for the seq-render tool. Pass the image path as an argument, or attach an image and invoke with no argument.
argument-hint: <image-path> [--output <path.seq>]
---

Parse `$ARGUMENTS` for:
- `--output <path.seq>` — if present, extract the output path and strip it from the image path
- The remaining value is the image path (or absent if only `--output` was given)

If an image path is present, read the file at that path. Otherwise use the most recently attached image in the conversation.

Identify every participant, message, and structural element in the sequence diagram, then emit valid `.seq` syntax.

## .seq syntax reference

    participant A as Alice
    participant B as Bob

    A->B: synchronous call (solid filled arrowhead)
    A-->B: return / response (dashed filled arrowhead)
    A->>B: async call (solid open arrowhead)
    A-->>B: async return (dashed open arrowhead)
    A->(2)B: delayed async — diagonal arrow, delay=2 rows
    A-->(2)B: delayed async return — diagonal dashed, delay=2 rows

    activate B
    deactivate B

    note over A,B: text spanning both lifelines
    note right of A: text on right
    note left of B: text on left

    ...

## Whiteboard → .seq mapping

| Whiteboard element | .seq syntax |
|---|---|
| Box or name at top of a lifeline | `participant Name` |
| Solid line with filled arrowhead → | `->` |
| Dashed or dotted line with filled arrowhead | `-->` |
| Solid line with open arrowhead → | `->>` |
| Dashed line with open arrowhead | `-->>` |
| Diagonal solid arrow (drawn at an angle) | `->(N)` where N = estimated row delay |
| Diagonal dashed arrow (drawn at an angle) | `-->(N)` where N = estimated row delay |
| Vertical rectangle on a lifeline | `activate` / `deactivate` |
| Sticky note or annotation bubble | `note over A,B: text` |
| Horizontal divider / time gap | `...` |
| Left-to-right actor order | preserve as-is |

## Async patterns

- A **diagonal arrow** always signals async with delay — use `->(N)` for solid, `-->(N)` for dashed, where N is the visual delay in rows (1–4 typically).
- A **push notification** is always a diagonal arrow: `->(1)` minimum.
- **Solid line = `->` or `->>`**; **dashed/dotted line = `-->` or `-->>`**. Check line style first, then arrowhead shape.
- Return values on a solid line (e.g. an ID, a JSON payload) use `->`.

## Ambiguity rules

Resolve silently:
- Unclear arrow type → use `->` and note the assumption only if it materially changes meaning
- Actors inferred from arrow endpoints when no explicit box is drawn
- Actor order unclear → use left-to-right as they appear in the photo
- Minor spelling or capitalisation → clean up silently

Mark genuinely unreadable text with `<?text?>` rather than guessing.

Ask the user only when:
- Arrow direction is ambiguous (can't determine who is calling whom)
- A structural block's type is genuinely unclear

## Output format

Emit the diagram in a plain code fence:

    ```
    participant A
    A->B: message
    ...
    ```

If you made non-obvious assumptions, add a brief **Assumptions** list below the block. No preamble, no narration.

## Pipe to preview

If `--output <path.seq>` was provided:
1. Write the diagram content (without the fenced code block wrapper) to that path using the Write tool.
2. Invoke the `whiteboard-to-mermaid:preview-seq` skill with the output path as the argument.
