/** CPF helpers kept for later varejo; MVP cadastro path is CNPJ-only. */
export const DOCUMENT_TYPES = ["cpf", "cnpj"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskCpf(digits: string): string {
  const d = onlyDigits(digits);
  const last4 = d.slice(-4).padStart(4, "*");
  return `***.***.***-${last4.slice(-2)}`;
}

export function maskCnpj(digits: string): string {
  const d = onlyDigits(digits);
  const last4 = d.slice(-4).padStart(4, "*");
  return `**.***.***/****-${last4.slice(-2)}`;
}

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const n = d.split("").map(Number);
  const check = (len: number) => {
    const sum = n.slice(0, len).reduce((acc, digit, i) => acc + digit * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    return (r === 10 ? 0 : r) === n[len];
  };
  return check(9) && check(10);
}

export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const n = d.split("").map(Number);
  const digit = (weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + n[i] * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = digit([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digit([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return n[12] === d1 && n[13] === d2;
}

export function isValidTaxId(type: DocumentType, value: string): boolean {
  return type === "cpf" ? isValidCpf(value) : isValidCnpj(value);
}

export function cnpjLast4(digits: string): string {
  return onlyDigits(digits).slice(-4);
}

export function formatCnpjInput(digits: string): string {
  const d = onlyDigits(digits).slice(0, 14);
  const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  if (d.length <= 2) return p[0];
  if (d.length <= 5) return `${p[0]}.${p[1]}`;
  if (d.length <= 8) return `${p[0]}.${p[1]}.${p[2]}`;
  if (d.length <= 12) return `${p[0]}.${p[1]}.${p[2]}/${p[3]}`;
  return `${p[0]}.${p[1]}.${p[2]}/${p[3]}-${p[4]}`;
}
