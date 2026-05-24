import { createUnComtradeIngester } from "../src/ingesters/un_comtrade";
import { parseArg, runCli } from "../src/ingesters/cli";

async function main() {
  const argv = process.argv.slice(2);
  const year = Number(parseArg(argv, "year") ?? "2024");
  const reporter = parseArg(argv, "reporter") ?? "US";
  const fixture =
    parseArg(argv, "fixture") ?? "fixtures/un_comtrade/us-reporter-2024.json";
  const ingester = createUnComtradeIngester({ year, reporter });
  const result = await runCli(ingester, { fixture });
  process.exit(result.status === "ok" ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`un_comtrade failed: ${err}\n`);
  process.exit(1);
});
