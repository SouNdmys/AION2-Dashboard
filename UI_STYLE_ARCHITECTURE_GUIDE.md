# UI Style Architecture Guide

## Purpose

This document captures the UI architecture and visual traits used in the current AION2 Dashboard minimal desktop app.

It is written so the same style can be reused in another project without copying the entire codebase.

## Core Direction

The style is not a decorative showcase. It is a task-first workbench.

Design goals:
- keep the middle canvas focused on one primary task
- move navigation and context to sidebars
- push advanced tools one layer deeper
- use low-saturation semantic color instead of loud warning color
- make dense tools feel calm, not empty

The closest reference direction is:
- ChatGPT web app for information hierarchy
- macOS productivity apps for spacing, softness, and restraint

## Information Architecture

### 1. Layout model

Use a three-zone desktop layout:
- left sidebar: navigation and current context only
- center canvas: current page's main task
- right sidebar: secondary insight, history, countdown, or helper panels

Rules:
- the center canvas always has the highest visual priority
- sidebars must not compete with the center area
- advanced controls should not appear in the center by default unless they are part of the main task

### 2. Page model

Each page should answer one question.

Examples from this project:
- Role Overview: what should I do next for each character?
- Character Action: what can this character do right now?
- Craft Simulation: is this item worth crafting now?

If a page answers more than one question, split it into:
- default mode
- advanced mode
- collapsible tool sections

### 3. Progressive disclosure

Default state should be short.

Recommended pattern:
- show summary first
- show core action second
- show detailed controls only after explicit user intent

Good examples:
- market tools behind a collapsible section
- individual expert cards that can collapse independently
- quick entry visible, but filters compressed into a lighter row

## Visual System

### 1. Tone

Use a light minimal theme by default.

Keywords:
- soft
- matte
- low contrast background
- crisp content edges
- restrained semantic color

Avoid:
- pure black buttons everywhere
- saturated red as the only urgency signal
- heavy gradients on every surface
- full dark glassmorphism

### 2. Surfaces

Surface hierarchy should be shallow:
- canvas background
- primary panel
- soft card
- subtle grouped section

In this project, that maps roughly to:
- `glass-panel`
- `soft-card`
- `section-card`
- `subtle-panel`

Guideline:
- fewer surface types is better
- each surface type must have a clear role

### 3. Color usage

Use semantic color in a low-saturation way.

Recommended mapping:
- urgent: soft orange
- dungeon / combat: soft blue
- weekly: soft amber
- mission / utility: soft green
- leisure / low priority: muted slate

Important:
- prefer tinted background plus thin accent edge
- do not rely on red text alone to communicate urgency
- use strong color only on the most important number or chip

### 4. Typography

Typography should be compact and quiet.

Recommended hierarchy:
- kicker: uppercase, small, spaced out
- title: medium-large, semibold
- subtitle: small, muted
- body meta: compact, secondary color

Avoid oversized marketing headings inside utility pages.

### 5. Buttons

Button hierarchy used here:
- primary action: dark graphite gradient button
- secondary action: lighter soft button
- neutral mode toggle / navigation: pill button
- static status: pill without hover intent

Rules:
- one primary action per local section
- destructive or low-frequency actions should not look primary
- button widths should be normalized inside the same row

## Component Patterns

### 1. Overview card

Role overview cards should contain:
- character identity
- one spotlight item
- grouped actionable rows
- one entry action

Rows should:
- use light semantic backgrounds
- optionally show restrained progress fill
- keep label left and ratio right

### 2. Task card

Task cards should contain:
- title
- one short meta line
- remaining pill
- one compact action row

Avoid stacking multiple paragraphs inside each task card.

### 3. Resource strip

Related operational data should be grouped into one strip or one cluster.

Pattern used here:
- top status strip for energy summary
- two smaller sibling cards below for related record entry

This avoids the "one small card on the left, two tall cards on the right" problem.

### 4. Tool sections

Advanced tool areas should use collapsible cards.

Rules:
- each card collapses independently
- opening one card should not force all others open
- expert tools should remain discoverable but not dominant

## Interaction Rules

### 1. Main task first

The first visible control on a page should map to the main user intent.

Examples:
- Craft Simulation page opens on the simulation form, not on OCR tools
- Character page opens on actionable tasks, not on long admin forms

### 2. No jumpy linking

When synchronizing data across panels:
- update the target panel state in place
- do not force page navigation
- avoid automatic page scroll unless the user explicitly requested focus

### 3. Quick entry behavior

Quick entry should prefer incremental actions.

Use absolute overwrite only when the meaning is explicit, for example:
- "set total completed"
- "sync cap"

Do not overload a single action label with two meanings.

## Spacing Rules

Recommended density profile:
- app shell: generous outer padding
- card padding: moderate
- control spacing: tight but breathable
- grouped rows: compact

Heuristic:
- if a utility page feels noisy, reduce visible blocks before reducing font size
- if a utility page feels empty, group related information before enlarging cards

## Reuse Checklist

When applying this style to another project, keep these steps in order:

1. Define the main task of each page
2. Split advanced tools out of default view
3. Build a small token set first
4. Limit surface types to 3-4
5. Add semantic color only after hierarchy is stable
6. Normalize buttons and input heights
7. Compress secondary text
8. Validate desktop and narrow-width layouts separately

## Suggested Token Categories

If you rebuild this style elsewhere, define tokens for:
- background canvas
- elevated surface
- subtle grouped surface
- input surface
- border soft / strong
- text primary / secondary / muted
- accent primary
- danger
- shadow soft / raised
- radius sm / md / lg
- control heights
- motion duration and easing

## What Not To Copy Blindly

Do not copy these without adapting to the new product:
- exact semantic colors
- the three-column layout on every page
- every card title style
- all current utility class names

Copy the principles, not the literal structure.

## Best Fit

This style works best for:
- productivity dashboards
- management consoles
- simulation tools
- local desktop utilities
- operator-facing internal tools

It is a weaker fit for:
- marketing sites
- content-heavy reading products
- highly playful or game-like UI

## Implementation Notes From This Project

Key traits in the current codebase:
- global token base lives in `src/renderer/src/styles.css`
- page shell uses a sidebar + canvas structure
- overview rows use low-saturation semantic grouping
- advanced craft tooling is collapsed behind `市场工具`
- resource input zones use toolbar-like composition instead of stacked forms

## Short Style Summary

If you need one sentence to brief another model or designer, use this:

"Build a light, task-first desktop workbench with a ChatGPT-like information hierarchy, low-saturation semantic color, compact utility cards, collapsible advanced tools, and a center canvas that always prioritizes the user's primary action."
