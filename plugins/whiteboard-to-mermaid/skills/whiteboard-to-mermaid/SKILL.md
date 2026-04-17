---
name: whiteboard-to-mermaid
description: Convert a whiteboard sequence diagram photo to valid Mermaid sequenceDiagram syntax. Pass the image path as an argument, or attach an image and invoke with no argument.
argument-hint: <image-path> [--output <path.mmd>]
---

Parse `$ARGUMENTS` for:
- `--output <path.mmd>` — if present, extract the output path and strip it from the image path
- The remaining value is the image path (or absent if only `--output` was given)

If an image path is present, read the file at that path. Otherwise use the most recently attached image in the conversation.

Identify every participant, message, and structural element in the sequence diagram, then emit a valid Mermaid `sequenceDiagram`.

## Mermaid syntax reference

    sequenceDiagram
        participant A as Alice
        participant B as Bob

        A->>B: synchronous call (solid filled arrowhead)
        A-->>B: return / async response (dashed)
        A-xB: lost message or error (solid + X tip)
        A--xB: lost return (dashed + X tip)
        A-)B: async fire-and-forget (solid open arrowhead)
        A--)B: async open return (dashed open)

        activate B
        deactivate B
        A->>+B: call and activate in one line
        B-->>-A: return and deactivate in one line

        Note right of A: text on right
        Note left of B: text on left
        Note over A,B: text spanning both lifelines

        loop Every tick
            A->>B: ping
        end

        alt happy path
            B-->>A: 200 OK
        else error path
            B-->>A: 500 Error
        end

        opt only if needed
            A->>B: optional call
        end

        par branch one
            A->>B: action 1
        and branch two
            A->>C: action 2
        end

        critical must succeed
            A->>B: important call
        option fallback
            A->>C: backup call
        end

        break on exception
            A->>A: handle locally
        end

        autonumber

## Whiteboard → Mermaid mapping

| Whiteboard element | Mermaid |
|---|---|
| Box or name at top of a lifeline | `participant Name` |
| Solid line with filled arrowhead → | `->>` |
| Dashed or dotted line (regardless of arrowhead) | `-->>` |
| Diagonal solid arrow (drawn at an angle) | `-)` async fire-and-forget |
| Diagonal dashed arrow (drawn at an angle) | `--)` async open return |
| Arrow ending in X | `-x` / `--x` |
| Half / open arrowhead on horizontal line | `-)` / `--)` |
| Vertical rectangle on a lifeline | `activate` / `deactivate` (or `+`/`-` shorthand) |
| Participant with activation box while waiting for an async callback | `activate` on sender after dispatching; `deactivate` when the async reply arrives |
| Boxed region labeled "loop" | `loop … end` |
| Boxed region labeled "alt", "if", or "if/else" | `alt … else … end` |
| Boxed region labeled "opt" | `opt … end` |
| Boxed region labeled "par" | `par … and … end` |
| Sticky note or annotation bubble | `Note over A,B: text` |
| Numbers drawn on arrows | `autonumber` at top |
| Left-to-right actor order | preserve as-is |

## Async patterns

- A **diagonal arrow** (drawn at an angle rather than horizontally) always signals async — use `--)` for dashed diagonal, `-)` for solid diagonal. **Never use `-->>` or `->>` for diagonal arrows.**
- The **fire-and-forget + callback** pattern: sender dispatches, gets an immediate sync ack (solid `->>` return), then waits (`activate`) for a later async callback (`--)`) before deactivating.
- A **push notification** is always async `-)` (solid diagonal open arrowhead).
- **Solid line = `->>`, dashed/dotted line = `-->>`**. Check the line style first, then the arrowhead. Return values that travel back on a solid line (e.g. an ID, a JSON payload) use `->>`.

## Ambiguity rules

Resolve silently:
- Unclear arrow type → use `->>` and note the assumption only if it materially changes meaning
- Actors inferred from arrow endpoints when no explicit box is drawn
- Actor order unclear → use left-to-right as they appear in the photo
- Minor spelling or capitalisation → clean up silently

Mark genuinely unreadable text with `<?text?>` rather than guessing.

Ask the user only when:
- Arrow direction is ambiguous (can't determine who is calling whom)
- A structural block's type is genuinely unclear (e.g. loop vs alt)

## Output format

Emit the diagram in a plain code fence (no language tag):

    ```
    sequenceDiagram
        …
    ```

If you made non-obvious assumptions, add a brief **Assumptions** list below the block. No preamble, no narration.

## Pipe to preview

If `--output <path.mmd>` was provided:
1. Write the diagram content (without the fenced code block wrapper) to that path using the Write tool.
2. Invoke the `whiteboard-to-mermaid:preview-mermaid` skill with the output path as the argument.
