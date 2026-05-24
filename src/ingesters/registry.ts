export interface SourceMeta {
  sourceKey: string;
  displayName: string;
  baseUrl: string;
  rateLimitPerSec: number;
}

export const sourceRegistry: Record<string, SourceMeta> = {
  un_comtrade: {
    sourceKey: "un_comtrade",
    displayName: "UN Comtrade",
    baseUrl: "https://comtradeapi.un.org",
    rateLimitPerSec: 1.0,
  },
  us_census: {
    sourceKey: "us_census",
    displayName: "US Census Bureau",
    baseUrl: "https://api.census.gov",
    rateLimitPerSec: 5.0,
  },
  freightos: {
    sourceKey: "freightos",
    displayName: "Freightos Baltic Index",
    baseUrl: "https://fbx.freightos.com",
    rateLimitPerSec: 1.0,
  },
  cars_and_bids: {
    sourceKey: "cars_and_bids",
    displayName: "Cars & Bids",
    baseUrl: "https://carsandbids.com",
    rateLimitPerSec: 1.0,
  },
  bat: {
    sourceKey: "bat",
    displayName: "Bring a Trailer",
    baseUrl: "https://bringatrailer.com",
    rateLimitPerSec: 1.0,
  },
  htsus: {
    sourceKey: "htsus",
    displayName: "USITC Harmonized Tariff Schedule (static)",
    baseUrl: "https://hts.usitc.gov",
    rateLimitPerSec: 1.0,
  },
};
