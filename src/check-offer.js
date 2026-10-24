// Offline mirror of the LAX registry offer validation (https://lax.kognai.ai/aiax/sections/lax_offer.json)
// plus the rules the registry enforces live (capability description at most 200 characters) and the
// hackathon rule that the endpoint is on your own domain. Returns a list of errors, empty when valid.
import { FIVE_LAWS } from "./offer.js";

const AMOUNT = /^\d+(\.\d{1,6})?$/;
const MODELS = ["per_call", "per_minute", "flat", "free"];

function httpsOwn(u, field, errors) {
  let url;
  try { url = new URL(u); } catch { errors.push(`${field} must be an https url`); return; }
  if (url.protocol !== "https:") errors.push(`${field} must be an https url`);
  if (/(^|\.)kognai\.ai$/i.test(url.hostname)) errors.push(`${field} must be on your own domain, not kognai.ai`);
}

export function checkOffer(o) {
  const errors = [];
  if (!o || typeof o !== "object") return ["offer must be a JSON object"];
  if (o.lax_version !== undefined && o.lax_version !== "1.0") errors.push("lax_version must be 1.0");
  if (typeof o.name !== "string" || o.name.length < 3 || o.name.length > 80) errors.push("name must be 3 to 80 characters");
  if (typeof o.description !== "string" || o.description.length < 20 || o.description.length > 600) errors.push("description must be 20 to 600 characters");
  if (o.category !== undefined && (typeof o.category !== "string" || o.category.length < 2 || o.category.length > 40)) errors.push("category must be 2 to 40 characters");
  if (!o.endpoint && !o.pact_endpoint) errors.push("endpoint or pact_endpoint is required");
  if (o.endpoint) httpsOwn(o.endpoint, "endpoint", errors);
  if (o.pact_endpoint) httpsOwn(o.pact_endpoint, "pact_endpoint", errors);
  if (o.agent_did !== undefined && !/^did:[a-z0-9]+:.+$/.test(o.agent_did)) errors.push("agent_did must be did:method:identifier");
  if (!Array.isArray(o.capabilities) || o.capabilities.length < 1 || o.capabilities.length > 10) errors.push("capabilities must have 1 to 10 items");
  else o.capabilities.forEach((c, i) => {
    const at = `capabilities[${i}]`;
    if (!c || typeof c.skill_id !== "string" || !c.skill_id) errors.push(`${at}.skill_id is required`);
    if (typeof c.description !== "string" || !c.description) errors.push(`${at}.description is required`);
    else if (c.description.length > 200) errors.push(`${at}.description must be at most 200 characters`);
    const p = c && c.pricing;
    if (!p || !MODELS.includes(p.model)) errors.push(`${at}.pricing.model must be one of ${MODELS.join(", ")}`);
    else {
      if (p.model !== "free" && !(typeof p.amount === "string" && AMOUNT.test(p.amount))) errors.push(`${at}.pricing.amount must be a decimal string like "0.05"`);
      if (p.currency !== "USDC") errors.push(`${at}.pricing.currency must be USDC`);
      if (p.rail !== "x402") errors.push(`${at}.pricing.rail must be x402`);
    }
    for (const k of ["input_schema", "output_schema"]) if (c && c[k] !== undefined && (typeof c[k] !== "object" || c[k] === null)) errors.push(`${at}.${k} must be an object`);
  });
  const laws = Array.isArray(o.constitutional_constraints) ? o.constitutional_constraints : [];
  for (const law of FIVE_LAWS) if (!laws.includes(law)) errors.push(`constitutional_constraints must include "${law}"`);
  if (o.payment_rails !== undefined && (!Array.isArray(o.payment_rails) || o.payment_rails.some((r) => !["x402", "usdc", "usdc-base"].includes(r)))) errors.push("payment_rails may only hold x402, usdc or usdc-base");
  return errors;
}
