import test from "node:test";
import assert from "node:assert/strict";
import { offer } from "./helpers.js";
import { checkOffer } from "../src/check-offer.js";
import { laxOffer, FIVE_LAWS } from "../src/offer.js";
import { ROUTES } from "../src/worker.js";

test("A1 lax-offer.json passes the LAX offer validation with the Five Laws", () => {
  assert.deepEqual(checkOffer(offer()), []);
  for (const law of FIVE_LAWS) assert.ok(offer().constitutional_constraints.includes(law), law);
});

test("A1 the endpoint is https on our own domain, not kognai.ai", () => {
  const u = new URL(offer().endpoint);
  assert.equal(u.protocol, "https:");
  assert.ok(!u.hostname.endsWith("kognai.ai"));
  assert.ok(checkOffer({ ...offer(), endpoint: "https://lax.kognai.ai/x" }).some((e) => e.includes("own domain")));
});

test("A1 the listed file is exactly what the live agent serves at /lax-offer.json (no drift)", () => {
  assert.deepEqual(offer(), laxOffer(ROUTES));
});

test("A1 the checker rejects what the registry rejects", () => {
  const o = offer();
  assert.ok(checkOffer({ ...o, constitutional_constraints: FIVE_LAWS.slice(1) }).some((e) => e.includes("Solidarity Oath")));
  const longCap = { ...o, capabilities: [{ ...o.capabilities[0], description: "x".repeat(201) }] };
  assert.ok(checkOffer(longCap).some((e) => e.includes("at most 200")));
  assert.ok(checkOffer({ ...o, capabilities: [] }).length > 0);
});
