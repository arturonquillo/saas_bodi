"use client";

import { useState } from "react";
import Link from "next/link";
import { isValidCnpj, onlyDigits } from "@saas-frota/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiSend, isApiError, type CadastroDto } from "../api";
import { BrandMark } from "../BrandMark";
import { COPY } from "../copy";
import { CnpjField } from "../documents";
import { AUTH_CARD, AuthStage } from "../layout";

export function RegisterScreen() {
  const [cnpj, setCnpj] = useState("");
  const [razao, setRazao] = useState("");
  const [registroPendente, setRegistroPendente] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const digits = onlyDigits(cnpj);
    if (!isValidCnpj(digits)) {
      setError(COPY.cnpj_invalid);
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiSend<CadastroDto>("/api/loja/cadastro", "POST", {
        cnpj: digits,
        razao_social: razao || fd.get("razao_social"),
        contato_nome: fd.get("contato_nome"),
        whatsapp: fd.get("whatsapp"),
        email: fd.get("email"),
        senha: fd.get("password"),
        cnpj_registro_pendente: registroPendente,
      });
      setOk(true);
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
      setBusy(false);
    }
  }

  return (
    <AuthStage>
      <Card className={AUTH_CARD}>
        <CardHeader className="space-y-4">
          <BrandMark href="/loja" />
          <CardTitle className="font-display text-xl">{COPY.cadastro_title}</CardTitle>
        </CardHeader>
        <CardContent>
          {ok ? (
            <Alert className="border-[var(--color-success)]/30 bg-[var(--color-success)]/10">
              <AlertDescription>{COPY.cadastro_ok}</AlertDescription>
            </Alert>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <CnpjField
                value={cnpj}
                onChange={setCnpj}
                onRegistry={({ razao_social, cnpj_registro_pendente }) => {
                  if (razao_social) setRazao(razao_social);
                  setRegistroPendente(cnpj_registro_pendente);
                }}
              />
              <Field>
                <FieldLabel htmlFor="razao_social">{COPY.razao_social}</FieldLabel>
                <Input
                  id="razao_social"
                  name="razao_social"
                  required
                  value={razao}
                  onChange={(e) => setRazao(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contato_nome">{COPY.contato}</FieldLabel>
                <Input id="contato_nome" name="contato_nome" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="whatsapp">{COPY.whatsapp}</FieldLabel>
                <Input id="whatsapp" name="whatsapp" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">{COPY.email}</FieldLabel>
                <Input id="email" name="email" type="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{COPY.password}</FieldLabel>
                <Input id="password" name="password" type="password" required />
              </Field>
              {error ? <FieldError>{error}</FieldError> : null}
              <Button type="submit" className="h-11 w-full" disabled={busy}>
                {COPY.cadastro_submit}
              </Button>
              <p className="text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Link href="/loja/entrar" className="text-primary hover:underline">
                  {COPY.submit_login}
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthStage>
  );
}
