// The 16 Regions of Ghana with their capitals
export const GHANA_REGIONS = [
  { id: "ahafo", name: "Ahafo", capital: "Goaso" },
  { id: "ashanti", name: "Ashanti", capital: "Kumasi" },
  { id: "bono", name: "Bono", capital: "Sunyani" },
  { id: "bono-east", name: "Bono East", capital: "Techiman" },
  { id: "central", name: "Central", capital: "Cape Coast" },
  { id: "eastern", name: "Eastern", capital: "Koforidua" },
  { id: "greater-accra", name: "Greater Accra", capital: "Accra" },
  { id: "north-east", name: "North East", capital: "Nalerigu" },
  { id: "northern", name: "Northern", capital: "Tamale" },
  { id: "oti", name: "Oti", capital: "Dambai" },
  { id: "savannah", name: "Savannah", capital: "Damongo" },
  { id: "upper-east", name: "Upper East", capital: "Bolgatanga" },
  { id: "upper-west", name: "Upper West", capital: "Wa" },
  { id: "volta", name: "Volta", capital: "Ho" },
  { id: "western", name: "Western", capital: "Sekondi" },
  { id: "western-north", name: "Western North", capital: "Sefwi Wiawso" },
] as const;

export type GhanaRegion = (typeof GHANA_REGIONS)[number];

export const regionName = (id: string) =>
  GHANA_REGIONS.find((r) => r.id === id)?.name ?? id;
