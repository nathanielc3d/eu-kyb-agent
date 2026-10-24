// Records examples/<name>.json from the agent's own handlers against the live upstreams (VIES).
// The body is what a paid call returns, without the per payment _meta block.
import { writeFileSync } from "node:fs";
import { ROUTES } from "../src/worker.js";
const O = "https://eu-kyb-x402.moneymachine.workers.dev";
const cases = [
  ["counterparty-electrabel-pass", "/v1/eu/counterparty", { vat: "BE0403170701", iban: "BE68539007547034", name: "Electrabel SA" }],
  ["counterparty-tim-review", "/v1/eu/counterparty", { vat: "IT00488410010", iban: "DE89370400440532013000", name: "TIM S.p.A." }],
  ["counterparty-google-review", "/v1/eu/counterparty", { vat: "IE6388047V", iban: "LT121000011101001000", name: "Gogle Payments Ltd" }],
  ["counterparty-bad-iban-fail", "/v1/eu/counterparty", { vat: "AT U33803701", iban: "AT61 1904 3002 3457 3202", name: "SPAR Osterreichische Warenhandels AG" }],
  ["vat-google-ireland", "/v1/eu/vat", { vat: "IE6388047V" }],
  ["iban-typo", "/v1/iban", { iban: "DE89 3704 0044 0532 0130 01" }],
  ["iban-valid", "/v1/iban", { iban: "DE89 3704 0044 0532 0130 00" }],
];
for (const [name, path, q] of cases) {
  const url = new URL(O + path);
  for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
  let response;
  try { response = await ROUTES[path].handler(url); }
  catch (e) { response = { http_status: 502, charged: false, error: "upstream_unavailable", detail: String(e.message) }; }
  const ex = { capability: ROUTES[path].name, request: { method: "GET", url: url.toString(), price_usdc: Number(ROUTES[path].price) / 1e6 }, response, recorded_at: new Date().toISOString() };
  writeFileSync(new URL(`../examples/${name}.json`, import.meta.url), JSON.stringify(ex, null, 2) + "\n");
  console.log(name, JSON.stringify(response).slice(0, 220));
}
