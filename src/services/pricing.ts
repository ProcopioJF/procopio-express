import type { ApiPricingType } from "./api";
import type { PriceTableDestinationInput } from "./api";

function parseCsvRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("O CSV contém aspas sem fechamento.");
  cells.push(cell.trim());
  return cells;
}

function normalizeHeader(header: string): string {
  return header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR").replace(/[\s_-]+/g, "");
}

function parseMoney(value: string): number {
  const numeric = value.trim().replace(/[^\d,.-]/g, "");
  const decimal = numeric.includes(",")
    ? numeric.replace(/\./g, "").replace(",", ".")
    : numeric;
  const amount = Number(decimal);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Valor inválido: "${value}".`);
  return amount;
}

function parsePricingType(value: string): ApiPricingType | undefined {
  const normalized = normalizeHeader(value);
  if (normalized === "fixed" || normalized === "fixa" || normalized === "fixo") return "FIXED";
  if (normalized === "range" || normalized === "faixa") return "RANGE";
  if (normalized === "perkm" || normalized === "km") return "PER_KM";
  if (normalized === "quote" || normalized === "consultar" || normalized === "sobconsulta") return "QUOTE";
  return undefined;
}

export function parsePriceTableCsv(csv: string): PriceTableDestinationInput[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error("O CSV está vazio.");
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const firstRow = parseCsvRow(lines[0], delimiter);
  const headers = firstRow.map(normalizeHeader);
  const hasHeader = headers.some((header) => ["destino", "bairro", "neighborhood", "destination", "nome"].includes(header));
  const rows = hasHeader ? lines.slice(1) : lines;
  const destinationColumn = hasHeader
    ? headers.findIndex((header) => ["destino", "bairro", "neighborhood", "destination", "nome"].includes(header))
    : 0;
  const priceColumn = hasHeader
    ? headers.findIndex((header) => ["preco", "valor", "price", "fixedprice"].includes(header))
    : 1;
  const typeColumn = hasHeader ? headers.findIndex((header) => ["tipo", "tipotarifa", "pricingtype"].includes(header)) : -1;
  const minimumColumn = hasHeader ? headers.findIndex((header) => ["minimo", "minimum", "minimumprice"].includes(header)) : -1;
  const maximumColumn = hasHeader ? headers.findIndex((header) => ["maximo", "maximum", "maximumprice"].includes(header)) : -1;
  const perKmColumn = hasHeader ? headers.findIndex((header) => ["precoporkm", "valorporquilometro", "rateperkm", "perkmrate"].includes(header)) : -1;
  if (destinationColumn < 0) throw new Error("O CSV precisa ter uma coluna de bairro ou destino.");

  return rows.map((line, rowIndex) => {
    const cells = parseCsvRow(line, delimiter);
    const destinationName = cells[destinationColumn]?.trim();
    if (!destinationName) throw new Error(`Linha ${rowIndex + (hasHeader ? 2 : 1)}: informe o destino.`);
    const priceText = priceColumn >= 0 ? (cells[priceColumn] ?? "").trim() : "";
    const explicitTypeText = typeColumn >= 0 ? (cells[typeColumn] ?? "").trim() : "";
    const explicitType = explicitTypeText ? parsePricingType(explicitTypeText) : undefined;
    if (explicitTypeText && !explicitType) throw new Error(`Linha ${rowIndex + (hasHeader ? 2 : 1)}: tipo de tarifa inválido.`);
    if (/^(?:R\$\s*)?\d+(?:[,.]\d{2})?\/\d+(?:[,.]\d{2})?$/.test(priceText) && explicitType !== "QUOTE") {
      throw new Error(`Linha ${rowIndex + (hasHeader ? 2 : 1)}: a notação "${priceText}" é ambígua; informe QUOTE ou confirme o tipo de tarifa.`);
    }
    const perKmText = perKmColumn >= 0 ? (cells[perKmColumn] ?? "").trim() : "";
    const inferredType = perKmText
      ? "PER_KM"
      : /^(?:km|por\s*km)$/i.test(priceText)
      ? "PER_KM"
      : /^(?:consultar(?: valor)?|sob consulta|quote)$/i.test(priceText)
        ? "QUOTE"
        : undefined;
    const range = priceText.match(/(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:a|até|-|–|—)\s*(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
    const type = explicitType ?? inferredType ?? (range ? "RANGE" : priceText ? "FIXED" : "QUOTE");
    if (type === "PER_KM") {
      const rateText = perKmColumn >= 0 ? perKmText : priceText;
      const perKmRate = rateText && !/^(?:km|por\s*km)$/i.test(rateText) ? parseMoney(rateText) : undefined;
      return { destinationName, pricingType: type, ...(perKmRate === undefined ? {} : { perKmRate }) };
    }
    if (type === "QUOTE") return { destinationName, pricingType: type };
    if (type === "RANGE") {
      const minimumPrice = minimumColumn >= 0 && cells[minimumColumn] ? parseMoney(cells[minimumColumn]) : range ? parseMoney(range[1]) : undefined;
      const maximumPrice = maximumColumn >= 0 && cells[maximumColumn] ? parseMoney(cells[maximumColumn]) : range ? parseMoney(range[2]) : undefined;
      if (minimumPrice === undefined || maximumPrice === undefined) {
        throw new Error(`Linha ${rowIndex + (hasHeader ? 2 : 1)}: informe os limites da faixa de preço.`);
      }
      return { destinationName, pricingType: type, minimumPrice, maximumPrice };
    }
    const fixedPrice = parseMoney(priceText);
    return { destinationName, pricingType: type, fixedPrice };
  });
}

export async function parsePriceTableXlsx(file: File): Promise<PriceTableDestinationInput[]> {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  const rows = sheets[0]?.data ?? [];
  const csv = rows
    .map((row) => row.map((cell) => {
      const value = cell === null ? "" : String(cell);
      if (/[\r\n]/.test(value)) throw new Error("O XLSX contém uma célula com quebra de linha não suportada.");
      return `"${value.replace(/"/g, '""')}"`;
    }).join(";"))
    .join("\n");
  return parsePriceTableCsv(csv);
}
