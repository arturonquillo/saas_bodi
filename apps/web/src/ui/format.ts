import { formatCnpjInput as sharedFormatCnpj, maskCnpj, onlyDigits } from "@saas-frota/shared";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function formatMoney(centavos: number) {
  return money.format(centavos / 100);
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return dateTime.format(d);
}

export function formatDateOnly(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return dateOnly.format(d);
}

export function formatCnpjInput(digits: string) {
  return sharedFormatCnpj(digits);
}

export function maskTaxId(value?: string) {
  if (!value) return undefined;
  if (value.includes("*")) return value;
  return maskCnpj(onlyDigits(value));
}

export function maskRecipient(value?: string) {
  if (!value) return "—";
  const digits = onlyDigits(value);
  if (digits.length === 14) return maskCnpj(digits);
  const at = value.indexOf("@");
  if (at > 0) {
    const local = value.slice(0, at);
    const domain = value.slice(at);
    return `${local[0]}***${domain}`;
  }
  if (digits.length >= 8) return `***${digits.slice(-4)}`;
  return value;
}

export function firstName(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome;
}
