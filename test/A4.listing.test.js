import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { offer, readme, unb64, mockFetch } from "./helpers.js";

const O = offer().endpoint;
const call = (path, headers = {}) => worker.fetch(new Request(O + path, { headers }), {}, { waitUntil() {} });
const PAID = ["/v1/eu/counterparty", "/v1/eu/vat", "/v1/iban"];

for (const path of PAID) {
  test(`A4 unpaid ${path} answers 402 with x402 terms in USDC on Base`, async (t) => {
    const calls = mockFetch(t, {});
    const r = await call(path);
    assert.equal(r.status, 402);
    const v2 = unb64(r.headers.get("PAYMENT-REQUIRED"));
    const a = v2.accepts[0];
    assert.equal(v2.x402Version, 2);
    assert.equal(a.scheme, "exact");
    assert.equal(a.network, "eip155:8453");
    assert.equal(a.asset.toLowerCase(), "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
    assert.equal(a.payTo, "0x40f100ccCF51EEA928a3f314fB6ab63Bf8fa51F3");
    const cap = offer().capabilities.find((c) => c.output_schema && O + path === v2.resource.url && c.description.includes(path));
    assert.equal(Number(a.amount) / 1e6, Number(cap.pricing.amount));
    const v1 = await r.json();
    assert.equal(v1.accepts[0].maxAmountRequired, a.amount);
    assert.equal(calls.length, 0, "no upstream or facilitator call when unpaid");
  });
}

test("A4 bad input is refused with 400 before any payment step", async (t) => {
  const calls = mockFetch(t, {});
  let r = await call("/v1/iban?iban=hello");
  assert.equal(r.status, 400);
  assert.equal((await r.json()).charged, false);
  r = await call("/v1/eu/counterparty?vat=US123456789", { "PAYMENT-SIGNATURE": "e30=" });
  assert.equal(r.status, 400);
  assert.equal(calls.length, 0, "facilitator never called for a bad request");
});

test("A4 the agent serves its own LAX offer", async () => {
  const r = await call("/lax-offer.json");
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), offer());
});

const LISTING = /LAX listing id: `?([0-9a-f-]{8,})`?/i;
const listed = LISTING.test(readme());
test("A4 the README carries the LAX listing id", { todo: listed ? false : "listed after the 0.01 USDC fee is funded" }, () => {
  assert.match(readme(), LISTING);
});
