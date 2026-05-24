import { createFreightosIngester } from "../src/ingesters/freightos";
import { parseArg, runCli } from "../src/ingesters/cli";

async function main() {
  const argv = process.argv.slice(2);
  const lookback = Number(parseArg(argv, "lookback") ?? "90");
  const fixture =
    parseArg(argv, "fixture") ?? "fixtures/freightos/90d-major-lanes.json";
  const ingester = createFreightosIngester({ lookbackDays: lookback });
  const result = await runCli(ingester, { fixture });
  process.exit(result.status === "ok" ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`freightos failed: ${err}\n`);
  process.exit(1);
});
