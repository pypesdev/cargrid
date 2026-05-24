// Deterministic fixture generator. Run with `tsx scripts/generate-fixtures.ts`
// to (re)materialize committed fixtures from a known seed. Not part of the
// runtime path; fixtures themselves are the contract.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function write(rel: string, value: unknown) {
  const abs = resolve(process.cwd(), rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(value, null, 2) + "\n", "utf8");
  process.stdout.write(`wrote ${rel}\n`);
}

// ---------- UN Comtrade: US-as-reporter, 12 months 2024, 3 HS codes, 5 partners, 2 directions ----------
function genComtrade() {
  const rand = lcg(0xc01dbeef);
  const partnerMeta: Record<string, { iso3: string; code: number; mult: number }> = {
    MX: { iso3: "MEX", code: 484, mult: 1.4 },
    CA: { iso3: "CAN", code: 124, mult: 1.2 },
    JP: { iso3: "JPN", code: 392, mult: 0.9 },
    DE: { iso3: "DEU", code: 276, mult: 0.7 },
    KR: { iso3: "KOR", code: 410, mult: 0.5 },
    GB: { iso3: "GBR", code: 826, mult: 0.45 },
    IT: { iso3: "ITA", code: 380, mult: 0.35 },
    FR: { iso3: "FRA", code: 251, mult: 0.3 },
    CN: { iso3: "CHN", code: 156, mult: 0.25 },
    BE: { iso3: "BEL", code: 56, mult: 0.2 },
    ES: { iso3: "ESP", code: 724, mult: 0.18 },
    NL: { iso3: "NLD", code: 528, mult: 0.16 },
    CH: { iso3: "CHE", code: 756, mult: 0.12 },
    AU: { iso3: "AUS", code: 36, mult: 0.1 },
  };
  const partners = Object.keys(partnerMeta);
  const hsCodes = ["8703", "8704", "8711"];
  const flows = [
    { code: "M", direction: "import" as const },
    { code: "X", direction: "export" as const },
  ];
  const data: Array<Record<string, unknown>> = [];
  for (let month = 1; month <= 12; month++) {
    for (const partner of partners) {
      for (const hs of hsCodes) {
        for (const flow of flows) {
          const baseValue = hs === "8703" ? 1_500_000_000 : hs === "8704" ? 700_000_000 : 80_000_000;
          const partnerMult = partnerMeta[partner].mult;
          const dirMult = flow.direction === "import" ? 1 : 0.4;
          const seasonal = 0.85 + 0.3 * rand();
          const value = Math.round(baseValue * partnerMult * dirMult * seasonal);
          const quantity = Math.round(value / 22_500);
          data.push({
            typeCode: "C",
            freqCode: "M",
            refPeriodId: 2024 * 100 + month,
            refYear: 2024,
            refMonth: month,
            period: `${2024}${String(month).padStart(2, "0")}`,
            reporterCode: 842,
            reporterISO: "USA",
            reporterDesc: "USA",
            flowCode: flow.code,
            flowDesc: flow.direction === "import" ? "Import" : "Export",
            partnerCode: partnerMeta[partner].code,
            partnerISO: partnerMeta[partner].iso3,
            partnerDesc: partner,
            partner2Code: 0,
            partner2ISO: "W00",
            classificationCode: "H6",
            cmdCode: hs,
            cmdDesc: hs,
            primaryValue: value,
            qty: quantity,
            qtyUnitCode: 8,
            qtyUnitAbbr: "u",
            netWgt: Math.round(quantity * 1500),
            grossWgt: Math.round(quantity * 1650),
            cifvalue: flow.direction === "import" ? value : null,
            fobvalue: flow.direction === "export" ? value : null,
          });
        }
      }
    }
  }
  write("fixtures/un_comtrade/us-reporter-2024.json", {
    count: data.length,
    data,
  });
}

// ---------- US Census: Q1 2024 port-detail trade, US imports by partner ----------
function genCensus() {
  const rand = lcg(0xfeedface);
  const partners = ["MX", "CA", "JP", "DE", "KR", "GB", "IT"];
  const hsCodes = ["8703", "8704", "8711"];
  const ports = ["2704", "1303", "2003", "2402", "4101"];
  const months = [1, 2, 3];
  const rows: Array<Record<string, unknown>> = [];
  for (const m of months) {
    for (const p of partners) {
      for (const hs of hsCodes) {
        for (const port of ports) {
          const base = hs === "8703" ? 110_000_000 : hs === "8704" ? 45_000_000 : 7_000_000;
          const partnerMult =
            { MX: 1.3, CA: 1.0, JP: 0.85, DE: 0.7, KR: 0.55, GB: 0.4, IT: 0.35 }[p] ?? 1;
          const val = Math.round(base * partnerMult * (0.7 + 0.6 * rand()));
          rows.push({
            CTY_CODE: { MX: 2010, CA: 1220, JP: 5880, DE: 4280, KR: 5800, GB: 4120, IT: 4759 }[p],
            CTY_NAME: p,
            I_COMMODITY: hs,
            DISTRICT: port,
            PORT: port,
            GEN_VAL_MO: String(val),
            GEN_QY1_MO: String(Math.round(val / 24_000)),
            YEAR: "2024",
            MONTH: String(m).padStart(2, "0"),
          });
        }
      }
    }
  }
  write("fixtures/us_census/q1-2024-port-detail.json", rows);
}

// ---------- Freightos: 90 days of daily FBX rates across major lanes ----------
function genFreightos() {
  const rand = lcg(0xbada55);
  const lanes = [
    { id: "FBX01", origin: "CNSHA", destination: "USLAX", base: 2900 },
    { id: "FBX02", origin: "CNSHA", destination: "USNYC", base: 3800 },
    { id: "FBX03", origin: "CNSHA", destination: "NLRTM", base: 3300 },
    { id: "FBX04", origin: "NLRTM", destination: "USNYC", base: 2400 },
    { id: "FBX05", origin: "USLAX", destination: "CNSHA", base: 720 },
    { id: "FBX06", origin: "USNYC", destination: "NLRTM", base: 980 },
  ];
  const end = new Date("2026-05-20T00:00:00Z");
  const rates: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 90; i++) {
    const d = new Date(end.getTime() - i * 24 * 3600_000);
    const iso = d.toISOString().slice(0, 10);
    for (const lane of lanes) {
      const drift = 0.85 + 0.3 * rand();
      rates.push({
        index: lane.id,
        date: iso,
        origin_port: lane.origin,
        destination_port: lane.destination,
        rate_usd: Math.round(lane.base * drift),
        currency: "USD",
        equipment: "FEU",
      });
    }
  }
  write("fixtures/freightos/90d-major-lanes.json", { rates });
}

// ---------- Auctions: 200 sold listings from cars_and_bids ----------
function genAuctions() {
  const rand = lcg(0xa11ce5);
  const stockCars = [
    { make: "Porsche", model: "911", years: [1995, 1999, 2004, 2008, 2014, 2019], hs: "8703", base: 80000 },
    { make: "BMW", model: "M3", years: [1988, 2001, 2008, 2015, 2021], hs: "8703", base: 55000 },
    { make: "Toyota", model: "Land Cruiser", years: [1985, 1994, 2002, 2010, 2021], hs: "8703", base: 40000 },
    { make: "Ford", model: "F-150", years: [1996, 2005, 2014, 2020], hs: "8704", base: 32000 },
    { make: "Chevrolet", model: "Corvette", years: [1972, 1985, 1998, 2009, 2020], hs: "8703", base: 50000 },
    { make: "Honda", model: "Civic", years: [1993, 1999, 2006, 2015], hs: "8703", base: 12000 },
    { make: "Ducati", model: "Monster", years: [2003, 2010, 2018], hs: "8711", base: 9000 },
    { make: "Harley-Davidson", model: "Sportster", years: [1996, 2004, 2014], hs: "8711", base: 7500 },
  ];
  const listings: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 200; i++) {
    const car = stockCars[i % stockCars.length];
    const year = car.years[i % car.years.length];
    const ageMult = Math.max(0.5, 1.4 - (2026 - year) * 0.012);
    const noise = 0.6 + 0.9 * rand();
    const price = Math.round(car.base * ageMult * noise);
    const soldDay = 1 + Math.floor(rand() * 28);
    const soldMonth = 1 + Math.floor(rand() * 4);
    const sold = `2026-${String(soldMonth).padStart(2, "0")}-${String(soldDay).padStart(2, "0")}`;
    const listingId = `cab-${String(20000 + i)}`;
    listings.push({
      id: listingId,
      url: `https://carsandbids.com/auctions/${listingId}/${car.make.toLowerCase()}-${car.model.toLowerCase().replace(/\s+/g, "-")}-${year}`,
      title: `${year} ${car.make} ${car.model}`,
      make: car.make,
      model: car.model,
      year,
      hs_code: car.hs,
      sold_price_usd: price,
      sold_date: sold,
      mileage: 5000 + Math.floor(rand() * 120000),
      vin: i % 4 === 0 ? null : `WP0AB2A9${String(100000 + i).slice(-6)}${year}`,
    });
  }
  write("fixtures/auctions/sold-200.json", { source: "cars_and_bids", listings });
}

// ---------- Tariff seed: HTSUS 8703/8704/8711 across US/CA/MX/EU/UK/JP/AU ----------
function genTariffs() {
  const destinations = ["US", "CA", "MX", "EU", "GB", "JP", "AU"];
  const hsCodes = ["8703", "8704", "8711"];
  // Sources: USITC HTS (US 2.5% on 8703, 25% on 8704 light trucks), EU TARIC
  // (10% on 8703), UK Trade Tariff (10% on 8703, 22% on 8704), JETRO tariff
  // database (Japan zero on 8703), Australian Customs (5% on 8703).
  // USMCA preferential rate: 0% between US/CA/MX for originating goods.
  const table: Record<string, Record<string, { ad: number; specific: number }>> = {
    US: { "8703": { ad: 2.5, specific: 0 }, "8704": { ad: 25.0, specific: 0 }, "8711": { ad: 2.4, specific: 0 } },
    CA: { "8703": { ad: 6.1, specific: 0 }, "8704": { ad: 6.1, specific: 0 }, "8711": { ad: 6.0, specific: 0 } },
    MX: { "8703": { ad: 20.0, specific: 0 }, "8704": { ad: 15.0, specific: 0 }, "8711": { ad: 15.0, specific: 0 } },
    EU: { "8703": { ad: 10.0, specific: 0 }, "8704": { ad: 22.0, specific: 0 }, "8711": { ad: 6.0, specific: 0 } },
    GB: { "8703": { ad: 10.0, specific: 0 }, "8704": { ad: 22.0, specific: 0 }, "8711": { ad: 6.0, specific: 0 } },
    JP: { "8703": { ad: 0.0, specific: 0 }, "8704": { ad: 0.0, specific: 0 }, "8711": { ad: 0.0, specific: 0 } },
    AU: { "8703": { ad: 5.0, specific: 0 }, "8704": { ad: 5.0, specific: 0 }, "8711": { ad: 5.0, specific: 0 } },
  };

  const rows: Array<Record<string, unknown>> = [];
  for (const dest of destinations) {
    for (const hs of hsCodes) {
      const t = table[dest][hs];
      rows.push({
        destination_country: dest,
        hs_code: hs,
        ad_valorem_pct: t.ad,
        specific_usd: t.specific,
        trade_agreement: "none",
        effective_from: "2024-01-01",
        effective_to: null,
      });
      // USMCA carveouts: US/CA/MX get 0% on each other for originating goods.
      if (["US", "CA", "MX"].includes(dest)) {
        rows.push({
          destination_country: dest,
          hs_code: hs,
          ad_valorem_pct: 0.0,
          specific_usd: 0,
          trade_agreement: "USMCA",
          effective_from: "2020-07-01",
          effective_to: null,
        });
      }
      // GSP carveout: developing-country origin gets 0% into US/EU/UK/AU on
      // passenger vehicles + motorcycles (8703/8711 only).
      if (["US", "EU", "GB", "AU"].includes(dest) && hs !== "8704") {
        rows.push({
          destination_country: dest,
          hs_code: hs,
          ad_valorem_pct: 0.0,
          specific_usd: 0,
          trade_agreement: "GSP",
          effective_from: "2024-01-01",
          effective_to: null,
        });
      }
    }
  }
  write("fixtures/tariffs/htsus_8703.json", { rows });
}

genComtrade();
genCensus();
genFreightos();
genAuctions();
genTariffs();
