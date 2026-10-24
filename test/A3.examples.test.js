import test from "node:test";
import assert from "node:assert/strict";
import { offer, examples } from "./helpers.js";
import { validateSchema } from "../src/schema.js";
import { checkIban } from "../src/iban.js";
import { verdict } from "../src/counterparty.js";

const cap = (id) => offer().capabilities.find((c) => c.skill_id === id);
const query = (u) => Object.fromEntries(new URL(u).searchParams);

test("A3 at least three examples, covering every listed capability", () => {
  const ex = examples();
  assert.ok(ex.length >= 3);
  for (const c of offer().capabilities) assert.ok(ex.some((e) => e.capability === c.skill_id), c.skill_id);
});

test("A3 every example request matches its input schema and hits the listed endpoint", () => {
  for (const e of examples()) {
    const c = cap(e.capability);
    assert.ok(c, e.file);
    assert.equal(e.request.method, "GET");
    assert.ok(e.request.url.startsWith(offer().endpoint + "/"), e.file);
    assert.deepEqual(validateSchema(c.input_schema, query(e.request.url)), [], e.file);
    assert.equal(e.request.price_usdc, Number(c.pricing.amount), e.file);
  }
});

test("A3 every example response matches its output schema", () => {
  for (const e of examples()) assert.deepEqual(validateSchema(cap(e.capability).output_schema, e.response), [], e.file);
});

test("A3 the schema checker catches a wrong response", () => {
  const c = cap("eu_counterparty_check");
  assert.ok(validateSchema(c.output_schema, { vat: {}, verdict: "maybe", reasons: [] }).length >= 3);
});

test("A3 recorded answers are reproducible from the agent's own rules (offline)", () => {
  for (const e of examples()) {
    const q = query(e.request.url);
    if (e.capability === "iban_check") {
      const { checked_at, source, ...rest } = e.response;
      assert.deepEqual(rest, checkIban(q.iban), e.file);
    }
    if (e.capability === "eu_counterparty_check") {
      const r = e.response;
      assert.deepEqual(verdict({ vat: r.vat, iban: r.iban, name: r.claimed_name }), { verdict: r.verdict, reasons: r.reasons, name_match: r.name_match }, e.file);
    }
  }
});
