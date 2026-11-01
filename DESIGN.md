# MEQIVA design system

## The idea

Handing over your keys in India means agreeing to a price you cannot check. MEQIVA's product is the itemised estimate that arrives first — so the estimate, not a slogan about transparency, is the object the brand is built around.

The second device is the **inspection stamp**. The verification badge cannot be drawn without the audit date and the expiry taken from the record itself, which is exactly what makes it worth anything.

Earlier drafts were austere — petrol green, an industrial grotesque, hairlines and no depth. It read as a ledger rather than something you would want to use. The current direction keeps the rigour and adds warmth.

## Colour

| Role | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F7F8FC` | `#090C16` | page canvas |
| `--surface` | `#FFFFFF` | `#121728` | cards and sheets |
| `--surface-2` | `#F0F3FA` | `#1B2235` | insets, table stripes |
| `--ink` | `#0D1222` | `#EEF1F8` | primary text |
| `--ink-2` / `--ink-3` | `#5A6276` / `#8A91A3` | `#9BA5BD` / `#6F7891` | secondary, tertiary |
| `--line` | `#E5E9F2` | `#242C41` | hairlines |
| `--brand` | `#2B59FF` | `#6D8BFF` | action and trust; **a garage overrides this** |
| `--accent` | `#FF9F1A` | `#FFB04D` | certified, or needs your attention |
| `--success` / `--warn` / `--danger` | `#0F9D74` / `#C77700` / `#DE3B3B` | — | state |

Electric blue carries action. Marigold is never decoration: it marks the stamp, an approval that is waiting, and the active nav position. A garage's own colour replaces `--brand` inside a scoped wrapper, and the foreground is computed from luminance so no garage can configure something unreadable.

## Type

- **Plus Jakarta Sans** (variable) — the entire interface, every control and every number. Friendly, high legibility at small sizes on cheap Android screens, proper tabular figures.
- **Fraunces** on its **SOFT** axis — display sizes only. Rounded terminals make a headline warm rather than severe, which is most of what stops the product feeling clinical.

Scale: `.display` clamps 2.6–4.3rem, `.display-2` 1.75–2.5rem, `.display-3` for panel headings, `.headline` in the sans for workspace pages. Prose caps at 68ch.

## Depth and motion

Depth comes from three layered shadows rather than heavier borders — that single change does more for approachability than any colour.

- `.press` on anything clickable: a 2.5% scale-down on press.
- `.lift` on cards that lead somewhere: 3px rise and a deeper shadow.
- `.rise` / `.fade` with `--i` for one staggered entrance per view, never per section.
- `.ticked` flashes a figure that just changed, without moving the layout.
- `.glow` is the only gradient in the product, behind the hero.
- Everything collapses under `prefers-reduced-motion`.

## Rules

- No all-caps labels, no arrows appended to button text, no `A · B · C` in marketing copy — middle dots only inside dense data rows.
- Dotted leaders belong to estimates and invoices, nowhere else.
- Numbered markers only where the content is genuinely a sequence.
- Every trust claim maps to enforced code. No invented testimonials, counts or founding dates; counters read from the database with honest zero-states.
