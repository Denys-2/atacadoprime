export type ParsedLeadAddress = {
  label: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zip: string;
};

function cleanPart(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeZip(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function extractAddressLine(notes: string | null | undefined) {
  const match = (notes ?? "").match(/(?:^|\n)\s*Endere[cç]o:\s*(.+?)(?:\n|$)/i);
  return cleanPart(match?.[1] ?? null)
    .replace(/,?\s*Brasil\.?$/i, "")
    .replace(/[.;]+$/g, "")
    .trim();
}

function splitStreetAndNumber(value: string) {
  const parts = value.split(",").map(cleanPart).filter(Boolean);
  if (parts.length < 2) return { street: cleanPart(value), number: "" };
  const number = parts.pop() ?? "";
  return { street: parts.join(", "), number };
}

function splitDistrictAndCity(value: string, fallbackCity: string | null | undefined) {
  const commaParts = value.split(",").map(cleanPart).filter(Boolean);
  if (commaParts.length >= 2) {
    return {
      district: commaParts.slice(0, -1).join(", "),
      city: commaParts.at(-1) ?? "",
    };
  }
  const city = cleanPart(fallbackCity);
  return value.toLocaleLowerCase("pt-BR") === city.toLocaleLowerCase("pt-BR")
    ? { district: "", city }
    : { district: cleanPart(value), city };
}

export function parseLeadAddress(
  notes: string | null | undefined,
  fallbackCity?: string | null,
  fallbackState?: string | null,
): ParsedLeadAddress | null {
  const addressLine = extractAddressLine(notes);
  if (!addressLine) return null;

  const zipMatch = addressLine.match(/(?:CEP:\s*)?(\d{5}-?\d{3})\b/i);
  const zip = zipMatch ? normalizeZip(zipMatch[1]) : "";
  if (!zip) return null;

  const withoutZip = cleanPart(
    addressLine.replace(/(?:,?\s*)?CEP:\s*\d{5}-?\d{3}\b/i, "").replace(/,?\s*\d{5}-?\d{3}\b/i, ""),
  )
    .replace(/[,-]+$/g, "")
    .trim();

  const stateMatch = withoutZip.match(/(?:,|\s+-\s+)\s*([A-Z]{2})$/i);
  const state = (stateMatch?.[1] ?? fallbackState ?? "").toUpperCase();
  const withoutState = cleanPart(
    stateMatch ? withoutZip.slice(0, stateMatch.index).trim() : withoutZip,
  );

  const hyphenParts = withoutState
    .split(/\s+-\s+/)
    .map(cleanPart)
    .filter(Boolean);
  const streetPart = hyphenParts.shift() ?? "";
  const { street, number } = splitStreetAndNumber(streetPart);
  if (!street || !state) return null;

  let district = "";
  let city = cleanPart(fallbackCity);
  if (hyphenParts.length > 0) {
    const lastPart = hyphenParts.pop() ?? "";
    const parsed = splitDistrictAndCity(lastPart, fallbackCity);
    district = [...hyphenParts, parsed.district].map(cleanPart).filter(Boolean).join(" - ");
    city = parsed.city || city;
  }

  if (!city) return null;

  return {
    label: "Principal",
    street,
    number,
    complement: "",
    district,
    city,
    state,
    zip,
  };
}
