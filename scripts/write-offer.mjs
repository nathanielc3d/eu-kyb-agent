// Writes lax-offer.json from the route table.
import { writeFileSync } from "node:fs";
import { ROUTES } from "../src/worker.js";
import { laxOffer } from "../src/offer.js";
writeFileSync(new URL("../lax-offer.json", import.meta.url), JSON.stringify(laxOffer(ROUTES), null, 2) + "\n");
console.log("lax-offer.json written");
