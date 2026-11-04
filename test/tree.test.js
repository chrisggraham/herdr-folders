import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyTree,
  canMove,
  move,
  slotNear,
  insertFolder,
  deleteFolder,
  settle,
  rowsOf,
  setFolded,
  updateFolder,
  rememberColor,
  isHex,
  hueToHex,
} from "../mods/herdr-folders/tree.js";

// This computer: folders a (holding b and a local space) and a local space.
// Machine dev holds folder m and a remote space; m holds another.
// Machine other holds folder o.
function sample() {
  const folder = (name) => ({ name, icon: "mods/workspace-chrome/folder.svg", color: null, folded: false });
  return {
    version: 1,
    folders: { a: folder("a"), b: folder("b"), m: folder("m"), o: folder("o") },
    machines: {},
    children: {
      root: ["folder:a", "machine:dev", "machine:other", "space:l1"],
      "folder:a": ["folder:b", "space:l2"],
      "folder:b": [],
      "machine:dev": ["folder:m", "space:dev/r1"],
      "folder:m": ["space:dev/r2"],
      "machine:other": ["folder:o"],
      "folder:o": [],
    },
    recentColors: [],
  };
}

const keysOf = (nodes) => nodes.map((n) => n.key);

test("canMove: each rule, one row per case", () => {
  const cases = [
    ["local space into a folder inside a machine", "space:l1", "folder:m", false],
    ["local space into a machine", "space:l1", "machine:dev", false],
    ["local space into a root folder", "space:l1", "folder:a", true],
    ["remote space out of its machine, to root", "space:dev/r1", "root", false],
    ["remote space out of its machine, to a root folder", "space:dev/r1", "folder:a", false],
    ["remote space into another machine's folder", "space:dev/r1", "folder:o", false],
    ["remote space into a folder inside its machine", "space:dev/r1", "folder:m", true],
    ["remote space into its machine", "space:dev/r2", "machine:dev", true],
    ["machine into a folder inside another machine", "machine:dev", "folder:o", false],
    ["machine into another machine", "machine:dev", "machine:other", false],
    ["machine into a root-level folder", "machine:dev", "folder:a", true],
    ["machine to root", "machine:dev", "root", true],
    ["folder into its own child", "folder:a", "folder:b", false],
    ["folder into itself", "folder:a", "folder:a", false],
    ["empty folder into a machine", "folder:b", "machine:dev", true],
    ["folder holding a local space into a machine", "folder:a", "machine:dev", false],
    ["folder holding a remote space to root", "folder:m", "root", false],
    ["folder holding a remote space into its machine", "folder:m", "machine:dev", true],
    ["folder holding a remote space into another machine", "folder:m", "machine:other", false],
  ];
  for (const [name, key, target, expected] of cases) {
    assert.equal(canMove(sample(), key, target), expected, name);
  }
});

test("canMove: a folder holding a machine cannot go inside a machine", () => {
  const tree = sample();
  tree.children.root = ["folder:a", "machine:other", "space:l1"];
  tree.children["folder:a"] = ["machine:dev"];
  assert.equal(canMove(tree, "folder:a", "machine:other"), false);
  assert.equal(canMove(tree, "folder:a", "root"), true);
});

test("move: inserts at an index in another parent", () => {
  const moved = move(sample(), "space:l1", "folder:a", 0);
  assert.deepEqual(moved.children["folder:a"], ["space:l1", "folder:b", "space:l2"]);
  assert.deepEqual(moved.children.root, ["folder:a", "machine:dev", "machine:other"]);
});

test("move: reorders within the same parent", () => {
  const tree = sample();
  tree.children.root = ["space:x", "space:y", "space:z"];
  assert.deepEqual(move(tree, "space:z", "root", 0).children.root, ["space:z", "space:x", "space:y"]);
  assert.deepEqual(move(tree, "space:x", "root", 2).children.root, ["space:y", "space:z", "space:x"]);
  assert.deepEqual(move(tree, "space:x", "root", 1).children.root, ["space:y", "space:x", "space:z"]);
});

test("move: an index past the end appends; a key in no list is added", () => {
  const appended = move(sample(), "space:l1", "folder:a", 99);
  assert.deepEqual(appended.children["folder:a"], ["folder:b", "space:l2", "space:l1"]);
  const added = move(sample(), "space:new", "folder:a", 1);
  assert.deepEqual(added.children["folder:a"], ["folder:b", "space:new", "space:l2"]);
});

test("move: a move canMove refuses changes nothing, and the input is never changed", () => {
  const tree = sample();
  const before = structuredClone(tree);
  assert.deepEqual(move(tree, "space:l1", "folder:m", 0), before);
  move(tree, "space:l1", "folder:a", 0);
  assert.deepEqual(tree, before);
});

test("slotNear: the index before or after a sibling, ignoring the moved key", () => {
  const tree = sample();
  tree.children.root = ["space:x", "space:y", "space:z"];
  assert.equal(slotNear(tree, "root", "space:x", "space:z", "before"), 1);
  assert.equal(slotNear(tree, "root", "space:x", "space:z", "after"), 2);
  assert.equal(slotNear(tree, "root", "space:z", "space:x", "before"), 0);
  assert.equal(slotNear(tree, "root", "space:z", "space:x", "after"), 1);
  assert.equal(slotNear(tree, "root", "space:x", "space:gone", "before"), 2);
});

test("deleteFolder: its children go to its parent at its place", () => {
  const tree = sample();
  tree.children.root = ["space:x", "folder:a", "space:y"];
  const after = deleteFolder(tree, "a");
  assert.deepEqual(after.children.root, ["space:x", "folder:b", "space:l2", "space:y"]);
  assert.equal("a" in after.folders, false);
  assert.equal("folder:a" in after.children, false);
});

test("deleteFolder: a folder inside a machine hands its children to the machine", () => {
  const after = deleteFolder(sample(), "m");
  assert.deepEqual(after.children["machine:dev"], ["space:dev/r2", "space:dev/r1"]);
});

test("deleteFolder: a folder in no list hands its children to the root's end", () => {
  const tree = sample();
  tree.children.root = ["machine:dev"];
  const after = deleteFolder(tree, "a");
  assert.deepEqual(after.children.root, ["machine:dev", "folder:b", "space:l2"]);
});

test("insertFolder: goes after the last folder in its parent", () => {
  const tree = sample();
  tree.folders.c = { name: "c", icon: "i", color: null, folded: false };
  tree.children.root = ["space:s", "folder:a", "space:t", "machine:dev", "space:u"];
  const after = insertFolder(tree, "root", "n", "New folder");
  assert.deepEqual(after.children.root, ["space:s", "folder:a", "folder:n", "space:t", "machine:dev", "space:u"]);
  assert.equal(after.folders.n.name, "New folder");
  assert.equal(after.folders.n.folded, false);
  assert.deepEqual(after.children["folder:n"], []);
});

test("insertFolder: with no folder yet, goes first; a machine can be the parent", () => {
  const tree = emptyTree();
  tree.children.root = ["space:s"];
  assert.deepEqual(insertFolder(tree, "root", "n", "New folder").children.root, ["folder:n", "space:s"]);
  const inMachine = insertFolder(sample(), "machine:dev", "n", "New folder");
  assert.deepEqual(inMachine.children["machine:dev"], ["folder:m", "folder:n", "space:dev/r1"]);
});

const known = (spaces, machines = []) => ({ spaces, machines });
const local = (id) => ({ id, machine: null });
const remote = (machine, id) => ({ id: `${machine}/${id}`, machine });

test("rowsOf: unplaced spaces and machines go to the end of the root or their machine", () => {
  const tree = emptyTree();
  tree.folders.a = { name: "a", icon: "i", color: null, folded: false };
  tree.children.root = ["folder:a"];
  const nodes = rowsOf(tree, known([remote("dev", "r1"), local("l1")], ["dev"]));
  assert.deepEqual(keysOf(nodes), ["folder:a", "space:l1", "machine:dev", "space:dev/r1"]);
  assert.deepEqual(nodes.map((n) => n.depth), [0, 0, 0, 1]);
  assert.equal(nodes[3].parent, "machine:dev");
});

test("rowsOf: a remote space whose machine is in a folder follows the machine", () => {
  const tree = emptyTree();
  tree.folders.a = { name: "a", icon: "i", color: null, folded: false };
  tree.children.root = ["folder:a"];
  tree.children["folder:a"] = ["machine:dev"];
  const nodes = rowsOf(tree, known([remote("dev", "r1")], ["dev"]));
  assert.deepEqual(keysOf(nodes), ["folder:a", "machine:dev", "space:dev/r1"]);
  assert.deepEqual(nodes.map((n) => n.depth), [0, 1, 2]);
});

test("rowsOf: keys for things that are gone are skipped and kept", () => {
  const tree = sample();
  tree.children.root = ["space:gone", "folder:a", "machine:ghost", "folder:nope", "space:l1"];
  const nodes = rowsOf(tree, known([local("l1"), local("l2")]));
  assert.deepEqual(keysOf(nodes), ["folder:a", "folder:b", "space:l2", "space:l1"]);
  assert.deepEqual(tree.children.root.includes("space:gone"), true);
  assert.deepEqual(settle(tree, known([local("l1")])).children.root.includes("machine:ghost"), true);
});

test("rowsOf: a folded folder or machine hides its children", () => {
  const tree = sample();
  tree.folders.a.folded = true;
  tree.machines.dev = { folded: true };
  const nodes = rowsOf(tree, known([local("l1"), local("l2"), remote("dev", "r1"), remote("dev", "r2")], ["dev", "other"]));
  assert.deepEqual(keysOf(nodes), ["folder:a", "machine:dev", "machine:other", "folder:o", "space:l1"]);
  assert.equal(nodes[0].folded, true);
  assert.equal(nodes[1].folded, true);
});

test("rowsOf: a machine with nothing to show says so", () => {
  const tree = emptyTree();
  const nodes = rowsOf(tree, known([remote("dev", "r1")], ["dev", "idle"]));
  const byKey = Object.fromEntries(nodes.map((n) => [n.key, n]));
  assert.equal(byKey["machine:dev"].empty, false);
  assert.equal(byKey["machine:idle"].empty, true);
});

test("rowsOf: each node knows its parent and place in the parent's list", () => {
  const nodes = rowsOf(sample(), known([local("l1"), local("l2")], ["dev", "other"]));
  const second = nodes.find((n) => n.key === "space:l2");
  assert.equal(second.parent, "folder:a");
  assert.equal(second.index, 1);
});

test("settle: puts every known space and machine in a list, and is repeatable", () => {
  const tree = emptyTree();
  const once = settle(tree, known([local("l1"), remote("dev", "r1")], ["dev"]));
  assert.deepEqual(once.children.root, ["space:l1", "machine:dev"]);
  assert.deepEqual(once.children["machine:dev"], ["space:dev/r1"]);
  assert.deepEqual(settle(once, known([local("l1"), remote("dev", "r1")], ["dev"])), once);
});

test("setFolded and updateFolder: change a copy", () => {
  const tree = sample();
  assert.equal(setFolded(tree, "folder:a", true).folders.a.folded, true);
  assert.deepEqual(setFolded(tree, "machine:dev", true).machines.dev, { folded: true });
  assert.equal(updateFolder(tree, "a", { name: "Work", color: "ansi3" }).folders.a.name, "Work");
  assert.equal(tree.folders.a.name, "a");
  assert.equal(tree.folders.a.folded, false);
});

test("rememberColor: newest first, no repeats, eight at most", () => {
  let tree = emptyTree();
  for (let n = 0; n < 10; n++) tree = rememberColor(tree, `#00000${n}`);
  assert.equal(tree.recentColors.length, 8);
  assert.equal(tree.recentColors[0], "#000009");
  tree = rememberColor(tree, "#000005");
  assert.equal(tree.recentColors[0], "#000005");
  assert.equal(tree.recentColors.filter((c) => c === "#000005").length, 1);
});

test("isHex: six hex digits after a #", () => {
  const cases = [["#a1B2c3", true], ["#000000", true], ["#abc", false], ["a1b2c3", false], ["#12345g", false], ["#1234567", false], ["", false], [null, false]];
  for (const [text, expected] of cases) assert.equal(isHex(text), expected, String(text));
});

test("hueToHex: fixed saturation and lightness, the hue wraps", () => {
  const cases = [[0, "#cc3333"], [120, "#33cc33"], [240, "#3333cc"], [60, "#cccc33"], [360, "#cc3333"], [-120, "#3333cc"]];
  for (const [hue, expected] of cases) assert.equal(hueToHex(hue), expected, String(hue));
  assert.equal(isHex(hueToHex(200.5)), true);
});
