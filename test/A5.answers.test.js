import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { checkIban } from "../src/iban.js";
import { verdict, nameMatch } from "../src/counterparty.js";
import { offer, readme, b64, unb64, mockFetch } from "./helpers.js";
import { validateSchema } from "../src/schema.js";

const O = offer().endpoint;
const call = (path, headers = {}) => worker.fetch(new Request(O + path, { headers }), {}, { waitUntil() {} });
const PAYER = "0x170ccDbaCede02956F96f0DD4903Cf11b0F0f57B";
function payment(amount) {
  return b64({ x402Version: 2, accepted: { scheme: "exact", network: "eip155:8453", amount, asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", payTo: "0x40f100ccCF51EEA928a3f314fB6ab63Bf8fa51F3" }, payload: { signature: "0xtest", authorization: {} } });
}
const VIES_OK = { isValid: true, userError: "VALID", name: "SA ELECTRABEL", address: "Boulevard Simon Bolivar 36\n1000 Bruxelles", requestDate: "2026-10-24T12:00:00Z" };
const out = (id) => offer().capabilities.find((c) => c.skill_id === id).output_schema;

test("A5 a paid counterparty call is verified, answered, then settled", async (t) => {
  const calls = mockFetch(t, {
    "/verify": () => ({ isValid: true, payer: PAYER }),
    "/settle": () => ({ success: true, transaction: "0xabc", network: "eip155:8453", payer: PAYER }),
    "vies/rest-api/ms/BE/vat/0403170701": () => VIES_OK,
  });
  const r = await call("/v1/eu/counterparty?vat=BE0403170701&iban=BE68539007547034&name=Electrabel", { "PAYMENT-SIGNATURE": payment("10000") });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.verdict, "pass");
  assert.deepEqual(validateSchema(out("eu_counterparty_check"), body), []);
  assert.equal(unb64(r.headers.get("PAYMENT-RESPONSE")).transaction, "0xabc");
  assert.deepEqual(calls.map((c) => c.url.split("/").pop()), ["verify", "0403170701", "settle"]);
});

test("A5 a wrong amount is refused with 402 and nothing runs", async (t) => {
  const calls = mockFetch(t, {});
  const r = await call("/v1/eu/counterparty?vat=BE0403170701", { "PAYMENT-SIGNATURE": payment("3000") });
  assert.equal(r.status, 402);
  assert.equal(calls.length, 0);
});

test("A5 a failed verification never reaches VIES or settlement", async (t) => {
  const calls = mockFetch(t, { "/verify": () => ({ isValid: false, invalidReason: "invalid_exact_evm_insufficient_balance" }) });
  const r = await call("/v1/eu/vat?vat=BE0403170701", { "PAYMENT-SIGNATURE": payment("3000") });
  assert.equal(r.status, 402);
  assert.equal(calls.length, 1);
});

test("A5 when VIES is busy the buyer gets 502 and is not charged (never a false invalid)", async (t) => {
  const calls = mockFetch(t, {
    "/verify": () => ({ isValid: true, payer: PAYER }),
    "/settle": () => { throw new Error("must not settle"); },
    "vies/rest-api": () => ({ isValid: false, userError: "MS_MAX_CONCURRENT_REQ", name: "---", address: "---" }),
  });
  const r = await call("/v1/eu/vat?vat=FR39356000000", { "PAYMENT-SIGNATURE": payment("3000") });
  assert.equal(r.status, 502);
  assert.equal((await r.json()).charged, false);
  assert.ok(!calls.some((c) => c.url.endsWith("/settle")));
});

test("A5 IBAN answers are correct on known good and bad numbers", () => {
  for (const ok of ["DE89 3704 0044 0532 0130 00", "GB82WEST12345698765432", "FR7630006000011234567890189", "BE68539007547034", "NL91ABNA0417164300"]) assert.equal(checkIban(ok).valid, true, ok);
  const typo = checkIban("DE89370400440532013001");
  assert.equal(typo.valid, false);
  assert.match(typo.errors.join(" "), /mod 97/);
  const short = checkIban("DE8937040044053201300");
  assert.equal(short.valid, false);
  assert.match(short.errors.join(" "), /length/);
  assert.equal(checkIban("NL91ABNA0417164300").bank_code, "ABNA");
  assert.equal(checkIban("GB82WEST12345698765432").eu, false);
  assert.equal(checkIban("GB82WEST12345698765432").sepa, true);
});

test("A5 the verdict flags the classic invoice fraud signals", () => {
  const vat = { vat: "BE0403170701", country: "BE", valid: true, name: "SA ELECTRABEL" };
  assert.equal(verdict({ vat, iban: checkIban("BE68539007547034"), name: "Electrabel" }).verdict, "pass");
  assert.equal(verdict({ vat, iban: checkIban("LT121000011101001000"), name: "Electrabel" }).verdict, "review");
  assert.equal(verdict({ vat, iban: checkIban("BE68539007547035"), name: "Electrabel" }).verdict, "fail");
  assert.equal(verdict({ vat: { ...vat, valid: false, status: "INVALID" } }).verdict, "fail");
  assert.equal(verdict({ vat, name: "Totally Other Corp" }).verdict, "review");
  assert.equal(verdict({ vat: { vat: "EL094014201", country: "EL", valid: true, name: null }, iban: checkIban("GR1601101250000000012300695") }).verdict, "pass", "EL VAT maps to GR IBAN");
  assert.equal(nameMatch("Société Générale SA", "SOCIETE GENERALE"), 1);
});

const PROOF = /A5 Kognai test calls: (0x[0-9a-fA-F]{64})[^\n]*(0x[0-9a-fA-F]{64})[^\n]*(0x[0-9a-fA-F]{64})/;
test("A5 three paid test calls by Kognai are answered (settlement tx in the README)", { todo: PROOF.test(readme()) ? false : "after the listing, when Kognai makes its three paid calls" }, () => {
  assert.match(readme(), PROOF);
});
