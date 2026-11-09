import { isValidCnpj, onlyDigits } from "@saas-frota/shared";
import { ApiError } from "../http/respond";
import { cnpjRegistryPort } from "../ports/cnpj-registry";
import { taxIdLast4 } from "../authz/mask";

export async function lookupCnpj(raw: string) {
  const cnpj = onlyDigits(raw);
  if (!isValidCnpj(cnpj)) {
    throw new ApiError("checksum_invalido", "CNPJ inválido.");
  }
  const result = await cnpjRegistryPort.lookup(cnpj);
  if (result.ok) {
    return {
      cnpj_digits: cnpj,
      cnpj_last4: cnpj.slice(-4),
      razao_social: result.razaoSocial,
      cnpj_registro_pendente: false,
      registry: "ok" as const,
    };
  }
  console.info("cnpj_lookup_degraded", { last4: taxIdLast4(cnpj), reason: result.reason });
  return {
    cnpj_digits: cnpj,
    cnpj_last4: cnpj.slice(-4),
    razao_social: null as string | null,
    cnpj_registro_pendente: true,
    registry: result.reason,
  };
}
