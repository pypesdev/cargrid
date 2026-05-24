import { openDb, parseArg } from "../src/ingesters/cli";
import { cheapestRoute } from "../src/lib/analysis/cheapest_route";
import { formatRoutesTable, resolvePort } from "../src/lib/analysis/cli_format";

function require(name: string, val: string | undefined): string {
  if (!val) {
    process.stderr.write(`missing required --${name}\n`);
    process.exit(2);
  }
  return val;
}

async function main(argv: string[]): Promise<void> {
  const origin = resolvePort(require("origin", parseArg(argv, "origin")));
  const destination = resolvePort(
    require("destination", parseArg(argv, "destination")),
  );
  const hs = require("hs", parseArg(argv, "hs"));
  const value = Number(require("value", parseArg(argv, "value")));
  if (!Number.isFinite(value) || value < 0) {
    process.stderr.write(`--value must be a non-negative number\n`);
    process.exit(2);
  }

  const age = Number(parseArg(argv, "age") ?? "4");
  const asOf = parseArg(argv, "as-of");
  const topK = Number(parseArg(argv, "top") ?? "3");
  const maxHops = Number(parseArg(argv, "max-hops") ?? "3");
  const json = argv.includes("--json");

  const { db, close } = openDb();
  try {
    const routes = cheapestRoute(
      {
        originPort: origin,
        destinationPort: destination,
        hsCode: hs,
        declaredValueUsd: value,
        vehicleAgeYears: age,
        asOf,
        topK,
        maxHops,
      },
      db,
    );

    if (json) {
      process.stdout.write(JSON.stringify(routes, null, 2) + "\n");
    } else {
      process.stdout.write(formatRoutesTable(routes));
    }
  } finally {
    close();
  }
}

main(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`analyze:cheapest failed: ${err}\n`);
  process.exit(1);
});
