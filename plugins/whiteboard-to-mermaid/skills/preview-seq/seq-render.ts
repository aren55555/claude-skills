#!/usr/bin/env bun
/**
 * seq-render: sequence diagram renderer → SVG
 *
 * Syntax:
 *   participant A as Alice
 *   A->B: message            sync solid, filled arrowhead
 *   A-->B: message           return dashed, filled arrowhead
 *   A->>B: message           async solid, open arrowhead
 *   A-->>B: message          async dashed, open arrowhead
 *   A->(2)B: message         delayed solid — diagonal, delay=2 rows
 *   A-->(2)B: message        delayed dashed diagonal
 *   activate A / deactivate A
 *   note over A,B: text
 *   note right of A: text
 *   note left of A: text
 *   ...                      time separator
 *
 * Usage:
 *   bun tools/seq-render/index.ts diagram.seq [out.svg]
 *   echo "A->B: hi" | bun tools/seq-render/index.ts > out.svg
 */

import { readFileSync, writeFileSync } from "fs"

// ── Types ─────────────────────────────────────────────────────────────────────

type ArrowType = "sync" | "return" | "async" | "async-ret"
type NotePos   = "over" | "right" | "left"

interface Participant { id: string; label: string }

interface MsgStep {
  kind: "message"
  from: string; to: string; label: string
  arrow: ArrowType
  delay: number
}
interface ActStep  { kind: "activate" | "deactivate"; participant: string }
interface NoteStep { kind: "note"; text: string; over: string[]; pos: NotePos }
interface SepStep  { kind: "separator" }

type Step = MsgStep | ActStep | NoteStep | SepStep

interface Diagram { participants: Participant[]; steps: Step[] }

// ── Parser ────────────────────────────────────────────────────────────────────

function parse(src: string): Diagram {
  const lines = src.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
  const participants: Participant[] = []
  const seen = new Map<string, string>()
  const steps: Step[] = []

  function ensure(id: string) {
    if (!seen.has(id)) { seen.set(id, id); participants.push({ id, label: id }) }
  }

  for (const line of lines) {
    const p = line.match(/^participant\s+(\w+)(?:\s+as\s+(.+))?$/i)
    if (p) {
      const id = p[1], label = p[2]?.trim() ?? p[1]
      if (!seen.has(id)) { seen.set(id, label); participants.push({ id, label }) }
      continue
    }
    if (line === "...") { steps.push({ kind: "separator" }); continue }

    const act = line.match(/^(activate|deactivate)\s+(\w+)$/i)
    if (act) { ensure(act[2]); steps.push({ kind: act[1].toLowerCase() as "activate" | "deactivate", participant: act[2] }); continue }

    const note = line.match(/^note\s+(over|right\s+of|left\s+of)\s+([\w,\s]+):\s*(.+)$/i)
    if (note) {
      const posStr = note[1].toLowerCase()
      const pos: NotePos = posStr.startsWith("right") ? "right" : posStr.startsWith("left") ? "left" : "over"
      const over = note[2].split(",").map(s => s.trim())
      over.forEach(ensure)
      steps.push({ kind: "note", text: note[3].trim(), over, pos }); continue
    }

    const m = line.match(/^(\w+)\s*(-->>|->>|-->|->)\s*(?:\((\d+)\))?\s*(\w+)\s*:\s*(.+)$/)
    if (m) {
      const [, from, sym, delayStr, to, label] = m
      ensure(from); ensure(to)
      const delay = delayStr ? parseInt(delayStr) : 0
      const arrow: ArrowType = sym === "->" ? "sync" : sym === "-->" ? "return" : sym === "->>" ? "async" : "async-ret"
      steps.push({ kind: "message", from, to, label, arrow, delay })
    }
  }
  return { participants, steps }
}

// ── Renderer ──────────────────────────────────────────────────────────────────

const C = {
  bg:           "#ffffff",
  lifelineLine: "#b0c4de",
  boxFill:      "#dbe8fb",
  boxStroke:    "#6a9fd8",
  boxText:      "#1a2740",
  arrowLine:    "#2c3e50",
  arrowLabel:   "#1a2740",
  actFill:      "#c5d8f5",
  actStroke:    "#5a8aca",
  noteFill:     "#fffde6",
  noteStroke:   "#e6c84a",
  noteText:     "#444",
  sepLine:      "#ccc",
  shadow:       "rgba(40,80,140,0.10)",
}

const FONT       = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
const MARGIN     = 24
const BOX_H      = 46
const BOX_PAD_X  = 20
const START_Y    = MARGIN + BOX_H + 36
const ROW_H      = 54
const MIN_COL_W  = 170
const ACT_W      = 14
const NOTE_PAD   = 10
const NOTE_W     = 130   // width for right/left notes
const NOTE_VGAP  = 30    // gap below a note before next step (needs ≥20 to clear arrow label)
const SEP_H      = 32

function approxW(text: string, size = 13) { return text.length * size * 0.58 }
function xml(s: string) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") }

function wrapText(text: string, maxW: number, size = 12): string[] {
  const charsPerLine = Math.max(8, Math.floor(maxW / (size * 0.6)))
  const words = text.split(" ")
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    if (cur && cur.length + w.length + 1 > charsPerLine) { lines.push(cur); cur = w }
    else { cur = cur ? `${cur} ${w}` : w }
  }
  if (cur) lines.push(cur)
  return lines
}

function noteLayout(step: NoteStep, pX: Map<string, number>): { nx: number; nw: number; lines: string[]; nh: number } {
  const xs = step.over.map(id => pX.get(id) ?? 0)
  let nx: number, nw: number
  if (step.pos === "over") {
    const span = Math.max(...xs) - Math.min(...xs)
    nw = Math.max(NOTE_W, span + 80)
    nx = (Math.min(...xs) + Math.max(...xs)) / 2 - nw / 2
  } else if (step.pos === "right") {
    nx = Math.max(...xs) + ACT_W; nw = NOTE_W
  } else {
    nw = NOTE_W; nx = Math.min(...xs) - ACT_W - nw
  }
  const lines = wrapText(step.text, nw - NOTE_PAD * 2)
  const nh = lines.length * 18 + NOTE_PAD * 2
  return { nx, nw, lines, nh }
}

function stepHeight(step: Step): number {
  if (step.kind === "message")   return ROW_H + step.delay * ROW_H
  if (step.kind === "separator") return SEP_H
  return 0  // activate / deactivate / note handled elsewhere
}

function render(d: Diagram): string {
  const { participants, steps } = d

  // ── column layout ──
  const colWidths = participants.map(p => Math.max(MIN_COL_W, approxW(p.label, 14) + BOX_PAD_X * 2 + 20))
  let cx = MARGIN
  const pX = new Map<string, number>()
  for (let i = 0; i < participants.length; i++) {
    pX.set(participants[i].id, cx + colWidths[i] / 2)
    cx += colWidths[i]
  }
  const totalW = cx + MARGIN

  // ── first pass: Y positions ──
  // activate/deactivate share the Y of the nearest surrounding message.
  // We record stepY for rendering, and track open activation boxes.

  const stepY: number[] = []
  let y = START_Y
  for (const step of steps) {
    stepY.push(y)
    if (step.kind === "note") {
      const { nh } = noteLayout(step, pX)
      y += nh + NOTE_VGAP
    } else {
      y += stepHeight(step)
    }
  }
  const contentEndY = y

  // ── activation boxes ──
  interface ActBox { pid: string; x: number; y1: number; y2: number }
  const actBoxes: ActBox[] = []
  const openActs = new Map<string, number>()

  let prevMsg: MsgStep | null = null
  let prevMsgY = START_Y

  // For participant p, return the arrowhead Y on p's lifeline for the last message.
  // Receiver of a delayed arrow: sy + delay*ROW_H. Everything else: sy.
  function actPointY(p: string): number {
    if (prevMsg && prevMsg.to === p && prevMsg.delay > 0)
      return prevMsgY + prevMsg.delay * ROW_H
    return prevMsgY
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const sy = stepY[i]

    if (step.kind === "message") {
      prevMsg = step
      prevMsgY = sy
    } else if (step.kind === "activate") {
      openActs.set(step.participant, actPointY(step.participant))
    } else if (step.kind === "deactivate") {
      const y1 = openActs.get(step.participant)
      if (y1 !== undefined) {
        openActs.delete(step.participant)
        actBoxes.push({ pid: step.participant, x: pX.get(step.participant)!, y1, y2: actPointY(step.participant) })
      }
    }
  }
  // close any unclosed
  for (const [pid, y1] of openActs)
    actBoxes.push({ pid, x: pX.get(pid)!, y1, y2: contentEndY })

  const totalH = contentEndY + 16 + BOX_H + MARGIN

  // ── SVG output ──
  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">`)
  out.push(`<style>svg,text{font-family:${FONT};}</style>`)
  out.push(`<defs>
  <filter id="sh"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${C.shadow}"/></filter>
  <marker id="af" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
    <polygon points="0 0.5, 10 3.5, 0 6.5" fill="${C.arrowLine}"/>
  </marker>
  <marker id="ao" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
    <polyline points="0 0.5, 10 4, 0 7.5" fill="none" stroke="${C.arrowLine}" stroke-width="1.2"/>
  </marker>
</defs>`)

  // background
  out.push(`<rect width="${totalW}" height="${totalH}" fill="${C.bg}"/>`)

  // lifelines — from bottom of top boxes to top of bottom boxes
  const lifeTop = MARGIN + BOX_H
  const lifeBot = totalH - MARGIN - BOX_H
  for (const p of participants) {
    const x = pX.get(p.id)!
    out.push(`<line x1="${x}" y1="${lifeTop}" x2="${x}" y2="${lifeBot}" stroke="${C.lifelineLine}" stroke-width="1.5" stroke-dasharray="6,4"/>`)
  }

  // activation boxes (below lifelines, above arrows)
  for (const b of actBoxes) {
    const h = b.y2 - b.y1
    if (h <= 0) continue
    out.push(`<rect x="${b.x - ACT_W/2}" y="${b.y1}" width="${ACT_W}" height="${h}" fill="${C.actFill}" stroke="${C.actStroke}" stroke-width="1.5" rx="2"/>`)
  }

  // steps
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const sy = stepY[i]

    if (step.kind === "message") {
      const fx = pX.get(step.from)!
      const tx = pX.get(step.to)!
      const right = tx > fx

      // nudge line ends away from activation box centre if active at this time
      function isActive(pid: string) {
        return actBoxes.some(b => b.pid === pid && b.y1 <= sy && b.y2 >= sy)
      }
      const fOff = isActive(step.from) ? (right ?  ACT_W/2 : -ACT_W/2) : 0
      const tOff = isActive(step.to)   ? (right ? -ACT_W/2 :  ACT_W/2) : 0

      const x1 = fx + fOff, y1 = sy
      const x2 = tx + tOff, y2 = sy + step.delay * ROW_H

      const solid  = step.arrow === "sync"  || step.arrow === "async"
      const open   = step.arrow === "async" || step.arrow === "async-ret"
      const dash   = solid ? "" : `stroke-dasharray="8,4"`
      const marker = `url(#${open ? "ao" : "af"})`

      out.push(`<line x1="${x1.toFixed(1)}" y1="${y1}" x2="${x2.toFixed(1)}" y2="${y2}" stroke="${C.arrowLine}" stroke-width="1.8" ${dash} marker-end="${marker}"/>`)

      // label — white pill background, sits above midpoint of the line
      const lx = ((x1 + x2) / 2).toFixed(1)
      const ly = ((y1 + y2) / 2 - 7).toFixed(1)
      const lw = (approxW(step.label, 12) + 14).toFixed(1)
      out.push(`<rect x="${(parseFloat(lx) - parseFloat(lw)/2).toFixed(1)}" y="${(parseFloat(ly) - 13).toFixed(1)}" width="${lw}" height="17" rx="3" fill="${C.bg}" opacity="0.9"/>`)
      out.push(`<text x="${lx}" y="${ly}" text-anchor="middle" font-size="12" fill="${C.arrowLabel}">${xml(step.label)}</text>`)
    }

    if (step.kind === "note") {
      const { nx, nw, lines, nh } = noteLayout(step, pX)
      out.push(`<rect x="${nx.toFixed(1)}" y="${sy}" width="${nw}" height="${nh}" fill="${C.noteFill}" stroke="${C.noteStroke}" stroke-width="1.5" rx="5"/>`)
      for (let li = 0; li < lines.length; li++)
        out.push(`<text x="${(nx + NOTE_PAD).toFixed(1)}" y="${sy + NOTE_PAD + 13 + li * 18}" font-size="12" fill="${C.noteText}">${xml(lines[li])}</text>`)
    }

    if (step.kind === "separator") {
      const midY = sy + SEP_H / 2
      out.push(`<line x1="${MARGIN}" y1="${midY}" x2="${totalW - MARGIN}" y2="${midY}" stroke="${C.sepLine}" stroke-width="1" stroke-dasharray="4,4"/>`)
    }
  }

  // participant boxes — drawn on top of everything
  for (const p of participants) {
    const x = pX.get(p.id)!
    const w = Math.max(MIN_COL_W - 10, approxW(p.label, 14) + BOX_PAD_X * 2)
    const bx = x - w / 2
    for (const by of [MARGIN, totalH - MARGIN - BOX_H]) {
      out.push(`<rect x="${bx.toFixed(1)}" y="${by}" width="${w.toFixed(1)}" height="${BOX_H}" fill="${C.boxFill}" stroke="${C.boxStroke}" stroke-width="1.5" rx="7" filter="url(#sh)"/>`)
      out.push(`<text x="${x.toFixed(1)}" y="${by + BOX_H/2 + 5}" text-anchor="middle" font-size="14" font-weight="600" fill="${C.boxText}">${xml(p.label)}</text>`)
    }
  }

  out.push(`</svg>`)
  return out.join("\n")
}

// ── Main ──────────────────────────────────────────────────────────────────────

const inFile  = process.argv[2]
const outFile = process.argv[3]
const src = inFile && inFile !== "-" ? readFileSync(inFile, "utf-8") : readFileSync("/dev/stdin", "utf-8")
const svg = render(parse(src))
if (outFile) { writeFileSync(outFile, svg); console.error(`→ ${outFile}`) }
else process.stdout.write(svg)
