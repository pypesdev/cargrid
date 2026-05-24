import { openDb, parseArg } from "../src/ingesters/cli";
import { topCorridors } from "../src/lib/analysis/flow_aggregations";
import { formatCorridorsTable } from "../src/lib/analysis/cli_format";

function require(name: string, val: string | undefined): string {
  if (!val) {
    process.stderr.write(`missing required --${name}\n`);
    process.exit(2);
  }
  return val;
}

async function main(argv: string[]): Promise<void> {
  const hs = require("hs", parseArg(argv, "hs"));
  const yearFrom = Number(require("year-from", parseArg(argv, "year-from")));
  const yearTo = Number(require("year-to", parseArg(argv, "year-to")));
  const limit = Number(parseArg(argv, "limit") ?? "10");
  const direction = parseArg(argv, "direction") as
    | "import"
    | "export"
    | undefined;
  const json = argv.includes("--json");

  if (
    !Number.isInteger(yearFrom) ||
    !Number.isInteger(yearTo) ||
    yearFrom > yearTo
  ) {
    process.stderr.write(`invalid --year-from/--year-to: ${yearFrom}..${yearTo}\n`);
    process.exit(2);
  }
  if (direction && direction !== "import" && direction !== "export") {
    process.stderr.write(`--direction must be 'import' or 'export'\n`);
    process.exit(2);
  }

  const { db, close } = openDb();
  try {
    const corridors = topCorridors(
      {
        hsCode: hs,
        yearFrom,
        yearTo,
        limit,
        flowDirection: direction,
      },
      db,
    );

    if (json) {
      process.stdout.write(JSON.stringify(corridors, null, 2) + "\n");
    } else {
      process.stdout.write(formatCorridorsTable(corridors));
    }
  } finally {
    close();
  }
}

main(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`analyze:corridors failed: ${err}\n`);
  process.exit(1);
});
