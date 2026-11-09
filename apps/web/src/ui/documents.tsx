"use client";

import { useState } from "react";
import { formatCnpjInput, isValidCnpj, onlyDigits } from "@saas-frota/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiSend, isApiError } from "./api";
import { COPY } from "./copy";

export function CnpjField({
  value,
  onChange,
  onRegistry,
  disabled,
}: {
  value: string;
  onChange: (digits: string) => void;
  onRegistry?: (data: { razao_social: string | null; cnpj_registro_pendente: boolean }) => void;
  disabled?: boolean;
}) {
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [registryDown, setRegistryDown] = useState(false);
  const [busy, setBusy] = useState(false);
  const digits = onlyDigits(value);
  const invalid = digits.length === 14 && !isValidCnpj(digits);

  async function lookup() {
    if (digits.length !== 14 || !isValidCnpj(digits)) return;
    setBusy(true);
    setLookupError(null);
    setRegistryDown(false);
    try {
      const data = await apiSend<{
        razao_social: string | null;
        cnpj_registro_pendente?: boolean;
        warning?: string;
      }>("/api/identidade/cnpj", "POST", { cnpj: digits });
      if (data.cnpj_registro_pendente || !data.razao_social) {
        setRegistryDown(true);
      }
      onRegistry?.({
        razao_social: data.razao_social,
        cnpj_registro_pendente: !!data.cnpj_registro_pendente || !data.razao_social,
      });
    } catch (err) {
      setRegistryDown(true);
      onRegistry?.({ razao_social: null, cnpj_registro_pendente: true });
      if (isApiError(err) && err.code === "checksum_invalido") {
        setLookupError(COPY.cnpj_invalid);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor="cnpj">{COPY.cnpj}</FieldLabel>
      <Input
        id="cnpj"
        name="cnpj"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled || busy}
        value={formatCnpjInput(digits)}
        onChange={(e) => onChange(onlyDigits(e.target.value).slice(0, 14))}
        onBlur={() => void lookup()}
        aria-invalid={invalid || undefined}
      />
      {invalid ? <FieldError>{COPY.cnpj_invalid}</FieldError> : null}
      {lookupError ? <FieldError>{lookupError}</FieldError> : null}
      {registryDown ? (
        <Alert className="mt-2 border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10">
          <AlertDescription>{COPY.registry_down}</AlertDescription>
        </Alert>
      ) : (
        <FieldDescription>Consulta automática ao sair do campo.</FieldDescription>
      )}
    </Field>
  );
}
