import { createAuctionsIngester, type AuctionSource } from "../src/ingesters/auctions";
import { parseArg, runCli } from "../src/ingesters/cli";

async function main() {
  const argv = process.argv.slice(2);
  const source = (parseArg(argv, "source") ?? "cars_and_bids") as AuctionSource;
  if (source !== "cars_and_bids" && source !== "bat") {
    process.stderr.write(`unknown --source ${source}; expected cars_and_bids|bat\n`);
    process.exit(2);
  }
  const limit = Number(parseArg(argv, "limit") ?? "200");
  const fixture =
    parseArg(argv, "fixture") ?? "fixtures/auctions/sold-200.json";
  const ingester = createAuctionsIngester({ source, limit });
  const result = await runCli(ingester, { fixture });
  process.exit(result.status === "ok" ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`auctions failed: ${err}\n`);
  process.exit(1);
});
