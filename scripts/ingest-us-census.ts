import { createUsCensusIngester } from "../src/ingesters/us_census";
import { parseArg, runCli } from "../src/ingesters/cli";

async function main() {
  const argv = process.argv.slice(2);
  const quarter = parseArg(argv, "quarter") ?? "2024Q1";
  const fixture =
    parseArg(argv, "fixture") ?? "fixtures/us_census/q1-2024-port-detail.json";
  const ingester = createUsCensusIngester({ quarter });
  const result = await runCli(ingester, { fixture });
  process.exit(result.status === "ok" ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`us_census failed: ${err}\n`);
  process.exit(1);
});
