# Kopimap redesign

Status: built (all five steps). Selected pin: option B with a primary glow, see [`pins.html`](redesign/pins.html). Mockups: [`docs/redesign/mockups.html`](redesign/mockups.html). Open it in a browser and use the theme toggle at the top.

## Direction (decided)

| Topic | Decision |
|---|---|
| Editing | The shop card switches into edit mode in place. The `/$postId/edit` and `/add` pages go away. |
| Layout | Desktop: one left panel that switches between the list and a shop. Mobile: one bottom sheet with three heights. |
| Sparse shops | Honest empty states, distance from you, nearby shops, directions and copy address, and a mini map when there's no photo. |
| Visual style | Keep the marknotes-light/dark palettes and Atkinson. Write strict rules for borders, colours, type and spacing. |

## What's wrong today, and why

1. **Border weights.** The themes set `--border: 2px`, so every daisyUI input, tab and button draws 2px. Hand-written borders (`border`, `border-b`) draw 1px. The selected pin, the hover card (`border-2`) and the photo picker (`border-2 border-dashed`) are 2px. No rule decides which one applies.
2. **Colour meaning.** `primary` means "reviewed" (pins), "main button", "selected pin" and "bold text in the review". `accent` means "known shop", "Edit button", "links" and "rating stars". `secondary` is black in light mode and indigo in dark mode, and it's used for the review buttons in the editor. So the same colour means different things on different screens.
3. **Size.** The editor is a centred `max-w-4xl` modal over a grid background. The list is `w-1/4` with `text-xs font-light` addresses, and the mobile card is a fixed `55vh`. On mobile the review and comments are hidden (`hidden lg:block`), so phones never see the main content.
4. **Sparse shops.** 50 of 149 shops have no address, and 12 have no hours. The card then shows a blank row with only an icon, plus the placeholder JPG.
5. **Editing is a separate place.** You leave the map, edit in a modal page and then press "Go to Home". Adding a shop means typing lat/long by hand.
6. **Validation blocks sparse shops.** `ModifyCoffeeSchema` requires an address of at least 20 characters, hours in `HH:MM - HH:MM` format and a name of at least 10 characters. Today you can't save a shop without an address, so the 50 sparse shops can't be partly filled in. This has to change for in-place editing to work.

## Design rules

### Borders
- **1px** everywhere: card edges, dividers, inputs, list rows, chips. Set `--border: 1px` in both themes.
- **2px** only for "this one is selected or focused": the active tab underline, the focused input, the selected photo (thumbnail), and the outline of the selected list row.
- Map pins keep their own stroke widths (known 1.7, reviewed 2.6), because they are drawn icons, not UI borders.

### Colour meaning
| Token | Means | Used for |
|---|---|---|
| `primary` | Reviewed by me, or the one main action | Reviewed pins and chips, the main button in a panel (one per view), the selected pin |
| `accent` | Known, not reviewed yet | Known pins and chips, links |
| `error` | Closed permanently, or a destructive action | Closed chip, Delete photo |
| `warning` | Rating stars | Stars only. They stop using `accent`, so blue keeps meaning "known" |
| `base-content/60` | Secondary text | Address, distance, dates, helper text |
| `secondary` | Not used | Removed from the app (it is black in light mode and indigo in dark mode) |

Buttons: one `btn-primary` per view. Everything else is `btn-ghost` or a 1px `btn-outline` in base-content.

### Type scale (Atkinson)
| Role | Size | Weight |
|---|---|---|
| Shop name | 20px (`text-xl`) | 700 |
| Section heading | 15px | 700. No uppercase eyebrows, and no helper text under fields: labels and empty states say what's needed |
| Body, facts, list name | 15px (`text-[15px]`) | 400, name 600 |
| Meta (address, distance, dates) | 13px (`text-[13px]`) | 400, `base-content/60` |

`font-light` and `text-[10px]`/`text-[11px]` are removed. Nothing is smaller than 12px.

### Spacing and shape
- Spacing steps: 4, 8, 12, 16, 24px. Panel padding is 16px; gaps between sections are 24px.
- Radius: `--radius-box` 0.75rem for cards and photos, `--radius-field` 0.5rem for inputs and buttons, and pill shapes only for chips.
- Touch targets are at least 44px tall on mobile (list rows, buttons, fact rows).

## Layout

### Desktop (≥1024px)
- The map fills the screen. A **single panel** sits on the left: 400px wide, 16px from the edges, full height, 1px border, `base-100`.
- The panel header holds the search field (⌘K stays).
- The panel shows one view at a time: **Browse → Shop → Edit**. Shop and Edit have a back arrow in the header. Esc goes back one step.
- There is no second floating card on the right anymore. The map gets the space back, and the selected pin is never hidden behind a card.

### Mobile (<1024px)
- **One bottom sheet** with the same panel content and three heights:
  - **Peek** (~96px): the search field and one line ("149 shops · 12 reviewed"), or the name of the selected shop.
  - **Half** (50dvh): the default.
  - **Full** (92dvh): for reading a review or editing.
- Drag the handle or tap it to change height. Selecting a pin opens the shop at Half height. Edit mode always opens at Full height.
- The search field lives in the sheet, not floating at the top, so the top of the map stays clear.
- The `+` button sits above the sheet on the right and moves with it.

## Views

### Browse
- Tabs: **Latest reviews** and **All places**. With a search query, the tabs are replaced by results.
- **All places** is sorted by distance when your location is known, otherwise by name. The sort is shown as a small label ("Nearest first").
- List row (64px tall): 48px thumbnail (or a small map tile when there's no photo), name, then one meta line: `reviewed ★4 · 270 m · Banjarsari`. Status is a chip only for Closed.
- The "+ Login" link moves to the panel footer as "Sign in", shown on both tabs.

### Shop
From top to bottom:
1. **Header (176px).** A photo carousel with a "1/4" counter. If there are no photos, it shows a **mini map** of the location with the pin, and when signed in, an "Add photo" button on top.
2. **Title.** Name, then one line of status: a `Reviewed ★ 4.0` chip in primary, a `Not reviewed yet` chip in accent, or `Closed permanently` in error.
3. **Facts** (one row each, 44px, icon + text):
   - Hours: "08:00 – 23:59", or "Hours unknown".
   - Address with a copy button, or "Address unknown".
   - Distance: "1.2 km from you". Only shown if the browser has given a location; otherwise this row is hidden, not left empty.
   - For anything unknown and signed in, the row becomes a button, "Add hours" or "Add address", that opens Edit mode with that field focused.
4. **Actions.** `Directions` (the one `btn-primary` when there's no review), `Copy address`, `Share` (copies the `?shop=` link).
5. **Review** (reviewed shops only). The title and the first ~6 lines of the review, fading out, then `Read full review` (`btn-primary`). This is now shown on mobile too.
6. **Comments**, collapsed (as now), showing the count and the newest commenter.
7. **Nearby.** The 4 closest shops from our own data, each with name, distance and status chip. Tapping one opens it. This is what fills a sparse shop with something real.
8. **Signed-in footer.** `Edit` (ghost) and `Write review ↗` or `Edit review ↗`.

### Edit (signed in)
- Same panel and header. The facts turn into inputs in place; there is no route change.
- **Photos:** a horizontal strip with drag-to-reorder. The first photo is the thumbnail and is marked with a 2px primary outline and a "Cover" label. "+" adds a photo; × deletes one (error colour on hover).
- **Location:** while editing, the selected pin on the map is **draggable**. The lat/long field updates as you drag, and you can still paste coordinates.
- **Hours:** two time inputs (open/close), plus an "Unknown" checkbox that saves empty hours.
- **Address:** optional textarea.
- **Rating:** the half-star picker and "Clear". Hidden when a published review sets the rating, with the line "Set by your review".
- **Closed permanently:** a toggle.
- **Sticky footer:** `Cancel` (ghost) and `Save` (primary). Saving returns to the Shop view with the new data. Leaving with unsaved changes asks "Discard changes?".

### Add shop
- `+` → the panel shows a link field and "Tap the map where the shop is"; the cursor becomes a crosshair.
- Pasting a Google Maps link skips the tap: the name and pin come from the link, and the Edit view opens on that spot. Short links are resolved by the worker, since a browser cannot read where they redirect. The link carries no address, hours, rating or photos, so those stay manual.
- A link to a shop already saved (similar name, within 40 m) opens that shop instead of making a second one.
- Tapping drops a draggable pin and opens the Edit view, empty, with the coordinates filled in.
- Saving opens the new shop in the Shop view.

### Sign in
- Only restyled to the rules above. No flow change.

## Keyboard shortcuts
One `keydown` listener on `window`. Single-letter keys are ignored while focus is in an input, textarea or contenteditable, and when Ctrl, Alt or ⌘ is held (so browser shortcuts still work). The map keeps its own built-in keys: arrows pan, +/- zoom.

| Key | Where | Does |
|---|---|---|
| `Esc` | Anywhere | Back one step: Edit → Shop → Browse. In the search field it clears the query first. In Edit with unsaved changes it asks "Discard changes?" |
| `⌘K` / `Ctrl+K`, `/` | Anywhere | Focus the search field (opens the mobile sheet to Half). |
| `↑` `↓` `Enter` | List or search results focused | Move the highlight (the 2px selected outline) and open that shop. The map is not focused at the time, so its arrow keys don't fire. |
| `J` / `K` | Shop open | Next / previous shop in the list it was opened from. Does nothing at the ends. |
| `D` | Shop open | Directions in Google Maps (new tab). |
| `C` | Shop open, has address | Copy the address. A short "Copied" toast confirms it. |
| `R` | Shop open, reviewed | Open the full review on mwyndham.dev. |
| `L` | Anywhere | Fly to your location (asks for permission the first time). |
| `1` / `2` | Browse | Latest reviews / All places. |
| `?` | Anywhere | Overlay listing these shortcuts. |

- Buttons show their key in the tooltip, for example "Directions (D)". The `⌘K` hint in the search field stays, and is hidden on touch devices.
- Shortcuts only matter on desktop, so phones need nothing extra.

## Map
- Pins and clusters stay as they are. Their colours follow the colour-meaning table, so they already match.
- The hover card (desktop) uses the same list row component, with a 1px border instead of 2px.
- When the panel opens a shop, the map flies with an offset, so the pin lands in the visible area: right of the panel on desktop, above the sheet on mobile.

## Data and server changes
- `ModifyCoffeeSchema`: `address` becomes optional (any length), and `openHours` accepts an empty string as "unknown". `shopName` keeps a minimum, lowered from 10 to 2 characters, since real names like "Kopi Tuku" are shorter than 10.
- No new endpoints. Nearby shops and distance are computed on the client from `/api/coffees`, which is already loaded for the map.
- The mini map uses a small non-interactive MapLibre map with the same style, created only when a shop has no photos. It is not an extra image service.

## What gets removed
- Routes `client/src/routes/$postId/edit.tsx` and `client/src/routes/add/index.tsx`. The old URLs redirect to `/?shop=<id>&edit=1` and `/?add=1`.
- The editor's page shell: grid background, gradient, modal, success screen.
- The right-hand floating card and the separate mobile list/card swap.
- The dead `<script src="src/index.css">` in `client/index.html`.

## Build order
Each step can be deployed on its own.
1. **Tokens:** `--border: 1px`, radius and colour rules, stars to `warning`, remove `secondary`, apply the type scale. Small diff with visible effect.
2. **Panel and sheet:** one panel component with the Browse/Shop views and the mobile bottom sheet. Remove the right-hand card.
3. **Shop view:** facts, empty states, distance, nearby, actions, review on mobile, mini map.
4. **Edit in place:** move the editor form into the panel, draggable pin, relaxed validation (server and client), remove the edit route.
5. **Add in place:** tap-to-place flow, remove the add route.

## Out of scope
- Google ratings or review counts (still undecided, needs new columns).
- Fixing the ~72 shops with suspect copied hours. It's a data task, but it affects "Open now" below.
- Offline support, user accounts for visitors, filters beyond search.

## Decided while building
- **"Open now"** is left out until the ~72 suspect imported hours are checked; wrong hours would make it lie.
- **Nearby** shows the 4 closest shops.
- **Mobile** starts at Half height.
- **Photo order:** tap a photo to make it the cover (works on touch), instead of drag-to-reorder.
- **Search** filters the already-loaded shop list on the device, so it's instant; `/api/coffees/search` is no longer called.
- **Mini map** has no attribution of its own; the main map behind the panel always shows it.
