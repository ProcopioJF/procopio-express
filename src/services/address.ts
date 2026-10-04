export type Coordinates = { latitude: number; longitude: number };
export type StructuredAddress = {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  complemento?: string;
  cidade: string;
  estado: string;
  coordinates?: Coordinates;
};

export const SERVICE_CITY = 'Juiz de Fora';
export const SERVICE_STATE = 'MG';

export const emptyAddress = (): StructuredAddress => ({
  cep: '', rua: '', numero: '', bairro: '', complemento: '', cidade: SERVICE_CITY, estado: SERVICE_STATE
});
export const cleanCep = (value: string) => value.replace(/\D/g, '').slice(0, 8);
export const isValidCep = (value: string) => /^\d{8}$/.test(cleanCep(value));
export const isValidOptionalCep = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 0 || /^\d{8}$/.test(digits);
};
export const addressComplete = (address: StructuredAddress) =>
  !!address.rua.trim() && !!address.numero.trim() && !!address.bairro.trim();

export async function lookupCep(value: string): Promise<Partial<StructuredAddress>> {
  const cep = cleanCep(value);
  if (!isValidCep(cep)) throw new Error('Informe um CEP válido com 8 dígitos.');
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!response.ok) throw new Error('Não foi possível consultar o CEP.');
  const data = await response.json();
  if (data.erro) throw new Error('CEP não encontrado. Confira os números.');
  return { cep, rua: data.logradouro || '', bairro: data.bairro || '', cidade: data.localidade || '', estado: data.uf || '' };
}

export async function geocodeAddress(address: StructuredAddress): Promise<Coordinates | undefined> {
  if (!addressComplete(address)) return undefined;
  const query = `${address.rua}, ${address.numero}, ${address.bairro}, ${SERVICE_CITY}, ${SERVICE_STATE}, Brasil`;
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`);
  if (!response.ok) return undefined;
  const results = await response.json();
  return results[0] ? { latitude: Number(results[0].lat), longitude: Number(results[0].lon) } : undefined;
}
