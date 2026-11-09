export const DOCUMENT_TYPES = ["cnpj"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskCnpj(digits: string): string {
  const d = onlyDigits(digits);
  const last4 = d.slice(-4).padStart(4, "*");
  return `**.***.***/****-${last4.slice(-2)}`;
}

/** Mask while typing is not applied — lists/details use this. */
export function formatCnpjInput(digits: string): string {
  const d = onlyDigits(digits).slice(0, 14);
  const p = [
    d.slice(0, 2),
    d.slice(2, 5),
    d.slice(5, 8),
    d.slice(8, 12),
    d.slice(12, 14),
  ];
  if (d.length <= 2) return p[0];
  if (d.length <= 5) return `${p[0]}.${p[1]}`;
  if (d.length <= 8) return `${p[0]}.${p[1]}.${p[2]}`;
  if (d.length <= 12) return `${p[0]}.${p[1]}.${p[2]}/${p[3]}`;
  return `${p[0]}.${p[1]}.${p[2]}/${p[3]}-${p[4]}`;
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
