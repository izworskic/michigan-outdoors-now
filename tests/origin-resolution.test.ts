import assert from "node:assert/strict";
import test from "node:test";
import { resolveMichiganOrigin } from "../src/lib/live-data";

test("known typed Michigan city resolves to canonical coordinates without network ambiguity", async () => {
  const origin = await resolveMichiganOrigin("Bay City");
  assert.ok(origin);
  assert.equal(origin.name, "Bay City, Michigan");
  assert.ok(Math.abs(origin.latitude - 43.5945) < 0.001);
  assert.ok(Math.abs(origin.longitude - -83.8889) < 0.001);
});

test("known Michigan ZIP resolves through the same origin contract", async () => {
  const origin = await resolveMichiganOrigin("49855");
  assert.ok(origin);
  assert.equal(origin.name, "Marquette, Michigan");
});
