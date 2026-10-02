import { config } from "../config.js";

export type Coordinates = { latitude: number; longitude: number };

export async function getRoadDistanceKm(pickup: Coordinates, delivery: Coordinates): Promise<number | null> {
  if (!config.perKmPricingEnabled || !config.routingApiUrl) return null;

  let baseUrl: URL;
  try {
    baseUrl = new URL(config.routingApiUrl);
  } catch {
    console.error("ROUTING_API_URL não contém uma URL válida.");
    return null;
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname);
  if (baseUrl.protocol !== "https:" && !(baseUrl.protocol === "http:" && localHost)) {
    console.error("ROUTING_API_URL deve usar HTTPS, exceto em ambiente local.");
    return null;
  }

  const routeUrl = new URL(
    `${baseUrl.pathname.replace(/\/+$/, "")}/${pickup.longitude},${pickup.latitude};${delivery.longitude},${delivery.latitude}`,
    baseUrl.origin,
  );
  baseUrl.searchParams.forEach((value, key) => routeUrl.searchParams.set(key, value));
  routeUrl.searchParams.set("overview", "false");

  let response: Response;
  try {
    response = await fetch(routeUrl, { signal: AbortSignal.timeout(8000) });
  } catch (error) {
    console.error("Falha ao consultar o provedor de rotas", error);
    return null;
  }
  if (!response.ok) {
    console.error(`O provedor de rotas respondeu com HTTP ${response.status}.`);
    return null;
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    console.error("O provedor de rotas retornou JSON inválido.");
    return null;
  }
  if (typeof result !== "object" || result === null || !("code" in result) || !("routes" in result)) {
    console.error("O provedor de rotas retornou uma resposta incompatível com OSRM.");
    return null;
  }
  if (result.code === "NoRoute") return null;
  if (result.code !== "Ok" || !Array.isArray(result.routes)) {
    console.error("O provedor de rotas retornou uma resposta incompatível com OSRM.");
    return null;
  }

  const firstRoute: unknown = result.routes[0];
  if (typeof firstRoute !== "object" || firstRoute === null || !("distance" in firstRoute)) {
    console.error("O provedor de rotas não retornou uma distância válida.");
    return null;
  }
  const distanceMeters = Number(firstRoute.distance);
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;
  return distanceMeters / 1000;
}
