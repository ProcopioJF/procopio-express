import { prisma } from "../db.js";
import { normalizeName } from "./normalization.js";
import { getRoadDistanceKm, type Coordinates } from "./routing.js";

export type ResolvedPrice = {
  success: true;
  pricingType: "FIXED" | "RANGE" | "PER_KM" | "QUOTE";
  origin: string;
  destination: string;
  priceTable?: string;
  priceTableId?: string;
  price: number | null;
  perKmRate?: number | null;
  distanceKm?: number | null;
  minimumPrice: number | null;
  maximumPrice: number | null;
  pricingRouteId?: string;
};

function quotePrice(origin: string, destination: string, priceTable?: string, priceTableId?: string): ResolvedPrice {
  return {
    success: true,
    pricingType: "QUOTE",
    origin,
    destination,
    priceTable,
    priceTableId,
    price: null,
    minimumPrice: null,
    maximumPrice: null,
  };
}

export async function getRoutePrice(
  city: string,
  pickupNeighborhood: string,
  deliveryNeighborhood: string,
  pickupCoordinates?: Coordinates,
  deliveryCoordinates?: Coordinates,
): Promise<ResolvedPrice> {
  const normalizedOrigin = normalizeName(pickupNeighborhood);
  const normalizedDestination = normalizeName(deliveryNeighborhood);
  const origin = await prisma.priceTableOrigin.findFirst({
    where: {
      active: true,
      normalizedOriginName: normalizedOrigin,
      priceTable: { active: true },
    },
    include: { priceTable: true },
  });

  if (origin) {
    const destination = await prisma.priceTableDestination.findFirst({
      where: { priceTableId: origin.priceTableId, normalizedDestinationName: normalizedDestination, active: true },
    });
    if (!destination) return quotePrice(pickupNeighborhood, deliveryNeighborhood, origin.priceTable.name, origin.priceTableId);
    if (destination.pricingType === "PER_KM") {
      const perKmRate = destination.perKmRate === null ? null : Number(destination.perKmRate);
      if (!perKmRate || !pickupCoordinates || !deliveryCoordinates) {
        return quotePrice(pickupNeighborhood, deliveryNeighborhood, origin.priceTable.name, origin.priceTableId);
      }
      const distanceKm = await getRoadDistanceKm(pickupCoordinates, deliveryCoordinates);
      if (distanceKm === null) {
        return quotePrice(pickupNeighborhood, deliveryNeighborhood, origin.priceTable.name, origin.priceTableId);
      }
      return {
        success: true,
        pricingType: "PER_KM",
        origin: pickupNeighborhood,
        destination: deliveryNeighborhood,
        priceTable: origin.priceTable.name,
        priceTableId: origin.priceTableId,
        price: Math.round(perKmRate * distanceKm * 100) / 100,
        perKmRate,
        distanceKm,
        minimumPrice: null,
        maximumPrice: null,
      };
    }
    if (destination.pricingType === "QUOTE") {
      return quotePrice(pickupNeighborhood, deliveryNeighborhood, origin.priceTable.name, origin.priceTableId);
    }
    return {
      success: true,
      pricingType: destination.pricingType as ResolvedPrice["pricingType"],
      origin: pickupNeighborhood,
      destination: deliveryNeighborhood,
      priceTable: origin.priceTable.name,
      priceTableId: origin.priceTableId,
      price: destination.fixedPrice === null ? null : Number(destination.fixedPrice),
      minimumPrice: destination.minimumPrice === null ? null : Number(destination.minimumPrice),
      maximumPrice: destination.maximumPrice === null ? null : Number(destination.maximumPrice),
    };
  }

  const legacyRoute = await prisma.pricingRoute.findFirst({
    where: {
      active: true,
      city: { equals: city, mode: "insensitive" },
      OR: [
        { pickupNeighborhood: { equals: pickupNeighborhood, mode: "insensitive" }, deliveryNeighborhood: { equals: deliveryNeighborhood, mode: "insensitive" } },
        { pickupNeighborhood: { equals: deliveryNeighborhood, mode: "insensitive" }, deliveryNeighborhood: { equals: pickupNeighborhood, mode: "insensitive" } },
      ],
    },
  });
  if (legacyRoute) {
    return {
      success: true,
      pricingType: "FIXED",
      origin: pickupNeighborhood,
      destination: deliveryNeighborhood,
      priceTable: "Tabela legada",
      price: Number(legacyRoute.price),
      minimumPrice: null,
      maximumPrice: null,
      pricingRouteId: legacyRoute.id,
    };
  }

  return quotePrice(pickupNeighborhood, deliveryNeighborhood);
}
