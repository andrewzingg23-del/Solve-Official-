// Printable parts: an outline is cleaned and checked, turned into a closed, outward-facing STL whose
// volume is exactly outline area × width, and designed end to end through the connector, where
// only people who may read the World can download it, and a printed part takes proof like any piece.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createConnector, type Session } from "../../lib/bot/connector";
import { approveConnection } from "../../lib/bot/memory";
import { encodePart, parsePart, partFile, partStl, partTriangles, printNotes, signedArea, sizeText, type Point } from "../../lib/bot/part";
import { proofsIn } from "../../lib/bot/proof";
import { saveBot } from "../../lib/bot/store";
import { setBotAccess } from "../../lib/bot/worlds";
import { createCreativeWorld } from "../../lib/world/creative";
import { createKernelDb, service, user } from "../kernel/harness";

// A phone stand from the side: a base slab, a lip at the front and a support leaning back.
const STAND: Point[] = [[0, 0], [80, 0], [80, 6], [30, 6], [60, 60], [54, 63], [22, 6], [10, 6], [10, 18], [4, 18], [4, 6], [0, 6]];

it("cleans an outline onto the bed and refuses shapes a printer cannot make", () => {
  const moved = parsePart(encodePart({ purpose: "Spacer", profile: [[110.04, 50], [120, 50], [120, 60], [115, 60], [110, 60]], width: 5, material: "PETG" }))!;
  assert.deepEqual(moved.profile, [[0, 0], [10, 0], [10, 10], [0, 10]], "moved to the origin, rounded, in-line point dropped, counter-clockwise");
  assert.ok(signedArea(moved.profile) > 0);
  assert.equal(parsePart(encodePart({ purpose: "x", profile: STAND, width: 70, material: "wood" }))!.material, "other");

  const bad: [unknown, RegExp][] = [
    [[[0, 0], [10, 10], [10, 0], [0, 10]], /crosses itself/],
    [[[0, 0], [10, 0]], /3 to 120 points/],
    [[[0, 0], [300, 0], [300, 10]], /fit in 256 mm/],
    [[[0, 0], [2, 0], [2, 2]], /too small/],
    [[[0, 0], [10, 0], [20, 0]], /a line, not a shape/],
    [[[0, 0], ["a", 1], [3, 3]], /\[x, z\] in millimetres/],
  ];
  for (const [profile, why] of bad) assert.throws(() => encodePart({ purpose: "x", profile, width: 10, material: "PLA" }), why);
  assert.throws(() => encodePart({ purpose: "x", profile: STAND, width: 0, material: "PLA" }), /width must be/);
  assert.throws(() => encodePart({ purpose: " ", profile: STAND, width: 10, material: "PLA" }), /what the part is for/);
  assert.equal(parsePart("SOV_PART_V1\n" + JSON.stringify({ purpose: "x", width: 10, material: "PLA", profile: [[0, 0], [10, 10], [10, 0], [0, 10]] })), null, "stored data is re-checked");
});

it("makes a closed STL with outward faces and the exact volume", () => {
  const part = parsePart(encodePart({ purpose: "Phone stand", profile: STAND, width: 70, material: "PETG" }))!;
  const tris = partTriangles(part);
  const n = part.profile.length;
  assert.equal(tris.length, 2 * (n - 2) + 2 * n);

  // Every edge is shared by exactly two faces, running opposite ways: closed and consistently wound.
  const edges = new Map<string, number>();
  const key = (p: number[]) => p.join(",");
  for (const t of tris) for (let i = 0; i < 3; i++) edges.set(`${key(t[i])}>${key(t[(i + 1) % 3])}`, (edges.get(`${key(t[i])}>${key(t[(i + 1) % 3])}`) ?? 0) + 1);
  for (const [edge, count] of edges) {
    const [a, b] = edge.split(">");
    assert.equal(count, 1, `edge ${edge} used once in each direction`);
    assert.equal(edges.get(`${b}>${a}`), 1, `edge ${edge} has its twin`);
  }

  const volume = tris.reduce((v, [a, b, c]) => v + (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6, 0);
  assert.ok(Math.abs(volume - signedArea(part.profile) * 70) < 1e-6, "positive volume: faces point out");

  const stl = partStl(part, "Phone stand");
  assert.equal(stl.byteLength, 84 + tris.length * 50);
  const view = new DataView(stl.buffer);
  assert.equal(view.getUint32(80, true), tris.length);
  assert.match(new TextDecoder().decode(stl.slice(0, 20)), /^solve part: Phone st/);
});

it("designs a part through the connector, serves it only to people who may see the World, and saves the print", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:part-ana")));
  const eve = kernelClient(localSupabase(db, user("auth:part-eve")));
  const anaId = await ana.register("Ana");
  await eve.register("Eve");
  const anaBot = (await saveBot(ana, { name: "Nova" }, "persona-part-ana")).avatar!.agent_id;
  const botAs = (agentId: string) => kernelClient(localSupabase(db, service), { actAs: agentId });
  await approveConnection(ana, anaId, anaBot, { clientId: "00000000-0000-4000-8000-0000000c1a0d", clientName: "Claude", mode: "remember" }, "part-connect");
  const call = async (person: Kernel, name: string, args: Record<string, unknown>) => {
    const s: Session = { clientId: "00000000-0000-4000-8000-0000000c1a0d", person, botAs, appUrl: "https://sov.test" };
    return ((await createConnector(s).handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })) as { result: { content: { text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> } }).result;
  };
  const worldId = "8b1d2c3b-4a59-4687-9a0b-1c2d3e4f5a6d";
  const world = await createCreativeWorld(ana, { worldId, title: "Desk" });
  await setBotAccess(ana, { scope: world.scope, botAgentId: anaBot, access: "add" }, "in");

  const crossing = await call(ana, "design_part", { world_id: worldId, title: "Bad", purpose: "x", profile: [[0, 0], [10, 10], [10, 0], [0, 10]], width_mm: 10, material: "PLA" });
  assert.match(crossing.content[0].text, /Nothing was written: the outline crosses itself/);

  const designed = await call(ana, "design_part", { world_id: worldId, title: "Phone stand", purpose: "Holds a phone in a case up to 12 mm at about 60°", profile: STAND, width_mm: 70, material: "PETG" });
  assert.equal(designed.isError, undefined, designed.content[0].text);
  const { artifact_id: pieceId, stl_url } = designed.structuredContent as { artifact_id: string; stl_url: string };
  assert.match(designed.content[0].text, /^Ready to print: Phone stand, 80 × 70 × 63 mm in PETG\. Prints without supports\. STL: https:\/\/sov\.test\/parts\/.+\.stl\./);
  assert.equal(stl_url, `https://sov.test/parts/${worldId}/${pieceId}.stl`);

  const read = await call(ana, "read_world", { world_id: worldId });
  assert.match(read.content[0].text, /Phone stand: printable part, 80 × 70 × 63 mm in PETG, for: Holds a phone/);
  assert.doesNotMatch(read.content[0].text, /SOV_PART_V1/, "the assistant sees the part, not its encoding");

  const file = await partFile(ana, worldId, `${pieceId}.stl`);
  assert.equal(file?.filename, "phone-stand.stl");
  assert.ok((file?.bytes.byteLength ?? 0) > 84);
  assert.equal(await partFile(ana, worldId, `${pieceId}.obj`), null);
  await assert.rejects(partFile(eve, worldId, `${pieceId}.stl`), "someone who may not see the World gets nothing");

  const saved = await call(ana, "add_proof", { world_id: worldId, artifact_id: pieceId, what_happened: "Printed it in PETG, holds the phone", proof: "Photo of the stand on the desk" });
  assert.match(saved.content[0].text, /^Saved\. No\. \d+: Printed it in PETG, holds the phone\. On your word\./);
  assert.equal((await proofsIn(ana, world.scope))[0].pieceId, pieceId);
});

function assertSolid(part: NonNullable<ReturnType<typeof parsePart>>, volume: number) {
  const tris = partTriangles(part);
  const edges = new Map<string, number>();
  const key = (p: number[]) => p.map((v) => v.toFixed(5)).join(",");
  for (const t of tris) for (let i = 0; i < 3; i++) { const e = `${key(t[i])}>${key(t[(i + 1) % 3])}`; edges.set(e, (edges.get(e) ?? 0) + 1); }
  for (const [edge, count] of edges) {
    const [a, b] = edge.split(">");
    assert.equal(count, 1, `edge ${edge} used once in each direction`);
    assert.equal(edges.get(`${b}>${a}`), 1, `edge ${edge} has its twin`);
  }
  const v = tris.reduce((sum, [a, b, c]) => sum + (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6, 0);
  assert.ok(Math.abs(v - volume) < 1e-3 * Math.max(1, volume), `volume ${v} ≈ ${volume}`);
  assert.equal(Math.min(...tris.flat().map((p) => p[2])), 0, "it sits on the bed");
}

it("makes flat parts and parts with holes as closed solids of the right volume", async () => {
  const { holeLoop } = await import("../../lib/bot/part");
  const holeArea = (d: number) => -signedArea(holeLoop([0, 0, d]));

  const plate = parsePart(encodePart({ purpose: "Wall plate for two M4 screws", profile: [[0, 0], [60, 0], [60, 40], [0, 40]], width: 3, material: "PETG", holes: [[12, 20, 4.5], [48, 20, 4.5]], lay: "flat" }))!;
  assert.deepEqual(plate.holes, [[12, 20, 4.5], [48, 20, 4.5]]);
  assert.equal(plate.lay, "flat");
  assert.equal(sizeText(plate), "60 × 40 × 3", "flat: the outline on the bed, the width as height");
  assertSolid(plate, (2400 - 2 * holeArea(4.5)) * 3);

  const ring: Point[] = Array.from({ length: 24 }, (_, i) => [10 + 10 * Math.cos((2 * Math.PI * i) / 24), 10 + 10 * Math.sin((2 * Math.PI * i) / 24)] as Point);
  const washer = parsePart(encodePart({ purpose: "Washer", profile: ring, width: 2, material: "PLA", holes: [[10, 10, 8]], lay: "flat" }))!;
  assertSolid(washer, (signedArea(washer.profile) - holeArea(8)) * 2);

  const grid = parsePart(encodePart({ purpose: "Pegboard", profile: [[0, 0], [80, 0], [80, 50], [0, 50]], width: 4, material: "PLA", holes: [[15, 15, 6], [40, 15, 6], [65, 15, 6], [15, 35, 6], [40, 35, 6], [65, 35, 6]], lay: "flat" }))!;
  assertSolid(grid, (4000 - 6 * holeArea(6)) * 4);

  const bracket = parsePart(encodePart({ purpose: "L bracket", profile: [[0, 0], [50, 0], [50, 5], [5, 5], [5, 40], [0, 40]], width: 20, material: "PETG", holes: [[2.5, 25, 1.5]] }))!;
  assertSolid(bracket, (signedArea(bracket.profile) - holeArea(1.5)) * 20);
  assertSolid(parsePart(encodePart({ purpose: "Phone stand", profile: STAND, width: 70, material: "PETG" }))!, signedArea(STAND) * 70);

  const square = [[0, 0], [30, 0], [30, 30], [0, 30]];
  const refused: [unknown, RegExp][] = [
    [[[40, 15, 4]], /wall around it/],
    [[[1, 15, 4]], /wall around it/],
    [[[15, 15, 6], [20, 15, 6]], /too close together/],
    [[[15, 15, 0]], /diameter must be/],
    [[[15, 15]], /\[x, z, diameter\]/],
  ];
  for (const [holes, why] of refused) assert.throws(() => encodePart({ purpose: "x", profile: square, width: 3, material: "PLA", holes }), why);
  const moved = parsePart(encodePart({ purpose: "x", profile: [[100, 100], [130, 100], [130, 130], [100, 130]], width: 3, material: "PLA", holes: [[115, 115, 5]] }))!;
  assert.deepEqual(moved.holes, [[15, 15, 5]], "holes move with the outline onto the bed");
});

it("says how a part will print: supports for real overhangs, a brim for little bed contact", () => {
  const notes = (profile: unknown, extra: Record<string, unknown> = {}) => printNotes(parsePart(encodePart({ purpose: "x", profile, width: 20, material: "PLA", ...extra }))!);
  assert.deepEqual(notes(STAND), { supports: false, overhangMm: 0, note: "Prints without supports." });
  const shelf = notes([[0, 0], [10, 0], [10, 30], [40, 30], [40, 36], [-30, 36], [-30, 30], [0, 30]]);
  assert.deepEqual([shelf.supports, shelf.overhangMm], [true, 60], "both 30 mm arms of a T hang in the air");
  assert.equal(notes([[0, 0], [20, 0], [20, 10], [24, 10], [24, 14], [0, 14]]).supports, false, "a 4 mm ledge bridges");
  assert.equal(notes([[0, 0], [60, 0], [60, 40], [0, 40]], { lay: "flat" }).note, "Prints flat, no supports.");
  assert.match(notes([[0, 0], [4, 0], [4, 40], [0, 40]]).note, /add a brim/);
  assert.match(notes([[0, 0], [40, 0], [40, 40], [0, 40]], { holes: [[20, 20, 12]] }).note, /large sideways hole may sag/);
});
