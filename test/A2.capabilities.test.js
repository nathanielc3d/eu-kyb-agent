import test from "node:test";
import assert from "node:assert/strict";
import { offer } from "./helpers.js";
import { ROUTES } from "../src/worker.js";

test("A2 each capability has an input schema, an output schema and a per call price", () => {
  const caps = offer().capabilities;
  assert.ok(caps.length >= 3);
  for (const c of caps) {
    assert.equal(c.input_schema?.type, "object", c.skill_id);
    assert.equal(c.output_schema?.type, "object", c.skill_id);
    assert.ok(c.output_schema.required.length > 0, c.skill_id);
    assert.equal(c.pricing.model, "per_call");
    assert.equal(c.pricing.currency, "USDC");
    assert.equal(c.pricing.rail, "x402");
    assert.ok(Number(c.pricing.amount) > 0 && Number(c.pricing.amount) <= 1, "Kognai pays at most 1 USDC per test call");
  }
});

test("A2 listed prices and inputs match what the endpoint charges and reads", () => {
  for (const c of offer().capabilities) {
    const [path, route] = Object.entries(ROUTES).find(([, r]) => r.name === c.skill_id);
    assert.equal(Number(c.pricing.amount), Number(route.price) / 1e6, c.skill_id);
    assert.deepEqual(Object.keys(c.input_schema.properties).sort(), Object.keys(route.params).sort(), path);
    assert.deepEqual(c.input_schema.required, Object.entries(route.params).filter(([, p]) => p.required).map(([k]) => k));
  }
});
