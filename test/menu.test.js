import { test } from "node:test";
import assert from "node:assert/strict";
import { spaceMenuItems, folderMenuItems, iconOf, shortcutOf, stepSelection } from "../mods/herdr-folders/menu.js";

const labels = (items) => items.map((it) => it.label);

test("spaceMenuItems: Herdr's space items, worktree ones only in a repo", () => {
  assert.deepEqual(labels(spaceMenuItems(null)), ["Rename", "Close"]);
  assert.deepEqual(labels(spaceMenuItems("main")), ["Rename", "New worktree", "Open worktree", "Close"]);
  assert.deepEqual(labels(spaceMenuItems("linked")), ["Rename", "New worktree", "Open worktree", "Remove worktree", "Close"]);
});

test("spaceMenuItems: a line before Close only, as in Herdr's menu", () => {
  const items = spaceMenuItems("linked");
  assert.deepEqual(items.filter((it) => it.separated).map((it) => it.label), ["Close"]);
});

test("spaceMenuItems: commands and worktree actions", () => {
  const items = spaceMenuItems("linked");
  assert.deepEqual(items.map((it) => [it.command, it.action ?? null]), [
    ["space.rename", null],
    ["worktree", "new"],
    ["worktree", "open"],
    ["worktree", "remove"],
    ["space.close", null],
  ]);
});

test("folderMenuItems: a folder can be edited and deleted, a machine cannot", () => {
  assert.deepEqual(labels(folderMenuItems("folder")), ["New folder here", "Edit folder…", "Delete folder"]);
  assert.deepEqual(labels(folderMenuItems("machine")), ["New folder here"]);
  assert.deepEqual(folderMenuItems("folder").filter((it) => it.separated).map((it) => it.label), ["Delete folder"]);
});

test("iconOf: Herdr's menu icons, and one for each folder item", () => {
  assert.equal(iconOf("space.rename"), "mods/workspace-chrome/square-pen.svg");
  assert.equal(iconOf("space.close"), "mods/workspace-chrome/x.svg");
  assert.equal(iconOf("worktree"), "mods/workspace-chrome/git-branch.svg");
  assert.equal(iconOf("folder.new"), "mods/workspace-chrome/folder-plus.svg");
  assert.equal(iconOf("folder.edit"), "mods/workspace-chrome/square-pen.svg");
  assert.equal(iconOf("folder.delete"), "mods/workspace-chrome/x.svg");
});

test("shortcutOf: the global key bound to the command, else nothing", () => {
  const keys = [
    { section: "global", keys: "shift-f2", action: "space.rename" },
    { section: "terminal", keys: "ctrl-w", action: "space.close" },
    { section: "global", keys: "alt-1", action: "space.select:1" },
  ];
  assert.equal(shortcutOf(keys, "space.rename", { id: "sp1" }), "shift-f2");
  assert.equal(shortcutOf(keys, "space.close", { id: "sp1" }), "");
  assert.equal(shortcutOf(keys, "space.select", { index: 1 }), "alt-1");
  assert.equal(shortcutOf(keys, "folder.new"), "");
});

test("stepSelection: up and down wrap around, other keys are not ours", () => {
  assert.equal(stepSelection(0, 3, "down"), 1);
  assert.equal(stepSelection(2, 3, "down"), 0);
  assert.equal(stepSelection(0, 3, "up"), 2);
  assert.equal(stepSelection(1, 3, "a"), null);
  assert.equal(stepSelection(0, 0, "down"), null);
});
