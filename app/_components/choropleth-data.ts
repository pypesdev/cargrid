// Simplified rectangular world map: each country tile is positioned by approximate
// continent location. Not geographically precise — intentionally minimalist to
// avoid a heavy mapping dependency. The seeded partner list is fully covered.

export interface CountryRect {
  iso2: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const COUNTRY_RECTS: CountryRect[] = [
  // North America
  { iso2: "CA", name: "Canada", x: 90, y: 60, w: 110, h: 50 },
  { iso2: "US", name: "United States", x: 90, y: 115, w: 110, h: 55 },
  { iso2: "MX", name: "Mexico", x: 90, y: 175, w: 70, h: 35 },
  // South America
  { iso2: "BR", name: "Brazil", x: 170, y: 215, w: 70, h: 60 },
  // Europe
  { iso2: "GB", name: "United Kingdom", x: 320, y: 90, w: 30, h: 25 },
  { iso2: "IE", name: "Ireland", x: 285, y: 90, w: 30, h: 25 },
  { iso2: "FR", name: "France", x: 320, y: 120, w: 35, h: 30 },
  { iso2: "ES", name: "Spain", x: 285, y: 145, w: 35, h: 30 },
  { iso2: "DE", name: "Germany", x: 360, y: 100, w: 35, h: 30 },
  { iso2: "IT", name: "Italy", x: 360, y: 135, w: 30, h: 35 },
  { iso2: "NL", name: "Netherlands", x: 355, y: 70, w: 30, h: 25 },
  { iso2: "BE", name: "Belgium", x: 320, y: 70, w: 30, h: 20 },
  { iso2: "CH", name: "Switzerland", x: 360, y: 165, w: 30, h: 20 },
  { iso2: "SE", name: "Sweden", x: 400, y: 60, w: 30, h: 35 },
  { iso2: "PL", name: "Poland", x: 400, y: 100, w: 35, h: 30 },
  // Asia
  { iso2: "RU", name: "Russia", x: 440, y: 60, w: 130, h: 60 },
  { iso2: "CN", name: "China", x: 530, y: 125, w: 90, h: 60 },
  { iso2: "JP", name: "Japan", x: 625, y: 130, w: 30, h: 35 },
  { iso2: "KR", name: "South Korea", x: 625, y: 170, w: 28, h: 22 },
  { iso2: "IN", name: "India", x: 490, y: 175, w: 60, h: 45 },
  { iso2: "TH", name: "Thailand", x: 555, y: 195, w: 28, h: 30 },
  { iso2: "VN", name: "Vietnam", x: 585, y: 195, w: 28, h: 30 },
  { iso2: "ID", name: "Indonesia", x: 585, y: 235, w: 60, h: 25 },
  // Middle East
  { iso2: "TR", name: "Turkey", x: 425, y: 145, w: 45, h: 25 },
  { iso2: "SA", name: "Saudi Arabia", x: 440, y: 175, w: 45, h: 35 },
  { iso2: "AE", name: "United Arab Emirates", x: 478, y: 200, w: 28, h: 18 },
  // Africa
  { iso2: "EG", name: "Egypt", x: 405, y: 185, w: 30, h: 25 },
  { iso2: "ZA", name: "South Africa", x: 380, y: 275, w: 45, h: 30 },
  { iso2: "NG", name: "Nigeria", x: 335, y: 215, w: 30, h: 25 },
  // Oceania
  { iso2: "AU", name: "Australia", x: 590, y: 270, w: 80, h: 45 },
  { iso2: "NZ", name: "New Zealand", x: 670, y: 295, w: 30, h: 25 },
];
