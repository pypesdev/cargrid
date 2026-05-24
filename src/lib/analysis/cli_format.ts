import type { CorridorStat } from "./flow_aggregations";
import type { RouteOption } from "./cheapest_route";

// Port short-code resolver. Maps 3-letter aliases the CLI accepts to their
// canonical UN/LOCODE used in the shipping_rates table.
export const PORT_ALIASES: Record<string, string> = {
  LAX: "USLAX",
  NYC: "USNYC",
  SHA: "CNSHA",
  RTM: "NLRTM",
};

export function resolvePort(code: string): string {
  const up = code.toUpperCase();
  if (up.length === 5) return up;
  const mapped = PORT_ALIASES[up];
  if (!mapped) {
    throw new Error(
      `unknown port code: ${code}. Known short codes: ${Object.keys(PORT_ALIASES).join(", ")}; full UN/LOCODEs (5 chars) also accepted.`,
    );
  }
  return mapped;
}

export function formatRoutesTable(routes: RouteOption[]): string {
  if (routes.length === 0) {
    return "no route found\n";
  }
  const lines: string[] = [];
  lines.push(
    pad("rank", 4) +
      pad("path", 32) +
      pad("shipping", 12) +
      pad("duty", 10) +
      pad("broker", 10) +
      pad("landed", 12) +
      "eta",
  );
  lines.push("-".repeat(86));
  routes.forEach((r, i) => {
    const path = pathString(r);
    lines.push(
      pad(String(i + 1), 4) +
        pad(path, 32) +
        pad(usd(r.shippingCostUsd), 12) +
        pad(usd(r.dutyUsd), 10) +
        pad(usd(r.brokerFeesUsd), 10) +
        pad(usd(r.totalLandedCostUsd), 12) +
        `${r.etaDays}d`,
    );
  });
  return lines.join("\n") + "\n";
}

export function formatCorridorsTable(corridors: CorridorStat[]): string {
  if (corridors.length === 0) {
    return "no corridors found\n";
  }
  const lines: string[] = [];
  lines.push(
    pad("rank", 4) +
      pad("reporter", 10) +
      pad("partner", 10) +
      pad("value", 18) +
      pad("qty", 14) +
      "months",
  );
  lines.push("-".repeat(70));
  corridors.forEach((c, i) => {
    lines.push(
      pad(String(i + 1), 4) +
        pad(c.reporter, 10) +
        pad(c.partner, 10) +
        pad(usd(c.totalValueUsd), 18) +
        pad(c.totalQuantity.toLocaleString("en-US"), 14) +
        String(c.monthCount),
    );
  });
  return lines.join("\n") + "\n";
}

function pad(s: string, width: number): string {
  if (s.length >= width) return s + " ";
  return s + " ".repeat(width - s.length);
}

function usd(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function pathString(r: RouteOption): string {
  if (r.hops.length === 0) return "(empty)";
  const nodes = [r.hops[0].fromPort, ...r.hops.map((h) => h.toPort)];
  return nodes.join(" → ");
}
