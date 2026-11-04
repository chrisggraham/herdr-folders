# Plan: herdr-folders

Date: 2026-11-04. Owner: Chris. Status: plan, waiting for scope-check and Chris's go.

## Ask

A Herdr sidebar mod that is Herdr's own `spaces` sidebar plus nested folders, and nothing else. Chris's words: "just nested folders, period", "I don't want to overwrite any of it. All I want to do is add the folder stuff."

## Base

- `herdr-app do mod.clone '{"name":"spaces","as":"herdr-folders"}'` (Herdr `spaces` 0.1.10, 465 lines, Apache 2.0).
- Keep Herdr's space rows, git tail, worktree nesting and space menu as they are.
- Put the folder code in new files. Change `main.js` only where the rows are built (`grouped()`) and where the header buttons are drawn. Then a later Herdr `spaces` release is easy to merge in.
- New layout: clone `main` to `main-folders` and point its sidebar at `herdr-folders`. Do not change `main-navigation` or `herdr-spaces-navigation`.

## Tree rules

1. The root is this computer. Do not show a "This computer" header.
2. A remote machine is a node. It shows Herdr's machine header (name, state). It cannot be renamed or deleted.
3. Folders, spaces and machines can be siblings, in a free order, at the root and in any folder.
4. A remote machine can go at the root or in a folder outside any machine.
5. A machine can hold folders, to any depth.
6. Items cannot cross machines. The path from any item to the root contains its own machine (for a remote item) and no other machine. A local item has no machine on its path.
7. No move into a descendant of the moved item.
8. A key for a space or machine that no longer exists is skipped when drawn and kept in the store (the machine can come back).

One function, `canMove(tree, key, targetParent)`, enforces rules 4 to 7. Every move and every drop target goes through it.

## Store

One tree for this Mac, in shared state only: `shared("herdr-folders")` / `setShared("herdr-folders", tree)`. Herdr saves shared state to disk (AGENTS.md:88), so no separate file.

```
{
  version: 1,
  folders:  { "<id>": { name, icon, color, folded } },
  machines: { "<name>": { folded } },
  children: { "root": [keys], "folder:<id>": [keys], "machine:<name>": [keys] },
}
```

Keys: `folder:<id>`, `space:<id>`, `machine:<name>`. A space id for a remote space is the id the app shows (`<machine>/<id>`).

Default places:
- A space or machine in no list shows at the end of the root. A remote space in no list shows at the end of its machine.
- A new folder goes after the last folder in its parent.
- A new space made with a folder's + goes at the end of that folder.

## Actions

| Action | Where | Result |
|---|---|---|
| New folder at root | Folder-plus button on the "Spaces" header | Folder "New folder" at root, Edit folder opens |
| New folder inside | Folder or machine right-click → New folder here | Same, in that parent |
| Edit folder | Folder right-click → Edit folder… | Dialog: name, icon row, color (32 presets, hex field with preview) |
| Set color | Folder right-click | 32 swatches at the top of the menu (row 4 starts with no color) |
| Delete folder | Folder right-click → Delete folder | Its children move to its parent at its place. No space closes |
| Fold / unfold | Chevron on a folder or machine row | Stored in the tree |
| New space in folder | + on a folder row | Unfolds the folder, then `space.new` (on the folder's machine, if any). `run()` returns no id, so use the prior art's pending-new pattern (herdr-spaces-navigation/main.js:66): the first new space that shows goes in that folder |
| Move by drag | Drag a space, folder or machine onto a folder or between rows | Only drops that pass `canMove` show a drop line. Drag is the only way to move |

The space right-click menu is Herdr's own, unchanged.

## Icons and colors

- Icon: default `mods/workspace-chrome/folder.svg`. The Edit folder dialog shows a row of these shipped icons: folder, layers, archive, files, file-text, server, monitor, terminal, git-branch, settings, pin, clock. Store the path.
- Color: a theme name (`ansi3`, still draws for old folders) or a hex value. 32 hex presets in 4 rows of 8, one hue per column in this order: red, orange, yellow, green, teal, blue, violet, pink. Row 1 vibrant, row 2 a little muted, row 3 more muted, row 4 "No color" (the theme's dim grey, drawn with a cross) then 7 greys light to dark (#a6a6a6 to #444444) (Chris's muted values: orange #c67e57, green #4e9c6b, teal #399a8f, blue #5d84cc, violet #8377cf, pink #bd6790). Custom: a hex field with a live preview swatch; no slider, no recent-colors row. New folders start expanded; a drop onto a folded folder leaves it folded.
- One `swatches()` renderer for the menu and the dialog, after the prior art's pattern (herdr-spaces-navigation/main.js:502). The dialog uses the prior art's `field()` pattern (main.js:566).
- A hex color does not follow the theme. Accepted for version 1.

## Files

- `mods/herdr-folders/main.js`: Herdr's `spaces` code with two hooks (rows, header button).
- `mods/herdr-folders/tree.js`: pure logic, no app calls: `canMove`, `move`, `insertFolder`, `deleteFolder`, `isHex`, `rowsOf` (tree + spaces + machines → ordered draw list with depth), default places, - `mods/herdr-folders/folders.js`: load, save, shared state, menus, Edit folder dialog.
- `test/tree.test.js`: `node --test`.
- `LICENSE` (MIT), `README.md`. Before any distribution: confirm the license of Herdr's `spaces` mod (only source so far: Carlos's NOTICE says Apache 2.0; the local mod states none), then add `LICENSE-APACHE` and `NOTICE` with the changed files listed.

## Not built

Tab rows, more git features, a settings menu, agent status dots, start folders, `match` rules, migration from `~/.config/herdr-space-folders.json` (Chris makes his folders by hand; the file is backed up in `~/.config/herdr-app/mod-backups/`), keyboard moves, per-theme hex colors, syncing the tree to other screens' machines, a JSON file copy of the tree, buttons on Herdr's machine header, own icons in `mods/herdr-folders/icons/`, a CHANGELOG.

## Scope check (2026-11-04)

Acted on: shared state only (no file), no machine-header button, icons folder and CHANGELOG to Not built, one `swatches()`, reuse the pending-new and `field()` patterns, license files wait for a confirmed source. Rejected: append new folders at the end (Chris chose "after the last folder" as the default). Kept: machine fold state, because a machine is a folder node (Chris's decision).

2026-11-04: Herdr's space menu stays unchanged; Move to… removed, drag only (Chris).

## Tests

`test/tree.test.js`, written first:
- `canMove`: local space into a folder inside a machine fails; remote space out of its machine fails; machine into a folder inside another machine fails; folder into its own child fails; machine into a root-level folder passes; remote space into a folder inside its machine passes.
- `move` keeps the free order: insert at an index, move within the same parent.
- `deleteFolder` puts its children in its parent at its place.
- `rowsOf`: unknown spaces go to the end of the root or of their machine; missing keys are skipped; folded nodes hide their children.
- `insertFolder` puts a new folder after the last folder.

Then `herdr-app check mods/herdr-folders`.

## QA steps

Run in Herdr with the `main-folders` layout, with `herdr-app shot` screenshots in dark mode:

1. Click the folder-plus button on the "Spaces" header. Name the folder "Test", pick the server icon and a custom hex color. Expected: "Test" shows at the root with that icon and color.
2. Drag a local space into "Test", then into a child folder of "Test". Expected: the space moves both times and stays there after a mod reload.
3. Drag the dev-tools machine into "Test". Then try to drag a local space into a folder inside dev-tools. Expected: the machine moves with all its spaces; the second drop shows no drop line and does nothing.
4. Delete "Test". Expected: its spaces, folders and the machine move to the root; no space closes.

2026-11-04: slider removed; 24 presets, 3 rows of 8 (vibrant, a little muted, more muted) plus a custom hex field; + unfolds its folder, drops keep fold (Chris).

## Follow-ups

- The "+" button can show a double pending slot.
- Collapsed-mode numbering of spaces is wrong.
- tree.js reads a space's machine from its id; use the `machine` field Herdr gives.
