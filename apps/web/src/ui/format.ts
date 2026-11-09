import { maskCnpj, onlyDigits } from "@saas-frota/shared";

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
  const d = onlyDigits(digits).slice(0, 14);
  const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  if (d.length <= 2) return p[0];
  if (d.length <= 5) return `${p[0]}.${p[1]}`;
  if (d.length <= 8) return `${p[0]}.${p[1]}.${p[2]}`;
  if (d.length <= 12) return `${p[0]}.${p[1]}.${p[2]}/${p[3]}`;
  return `${p[0]}.${p[1]}.${p[2]}/${p[3]}-${p[4]}`;
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
