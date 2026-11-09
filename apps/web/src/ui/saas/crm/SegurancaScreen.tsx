"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, asPage, isApiError, type UserDto } from "../../api";
import { COPY } from "../../copy";
import {
  adminResetMfa,
  confirmMfa,
  disableMfa,
  getMfaStatus,
  getSamlConfig,
  putSamlConfig,
  putSecurityPolicy,
  startMfa,
  testSamlConfig,
} from "../../crm/phase-e";
import type { CrmMfaStatusDto, CrmSamlConfigDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, FormSkeleton } from "../../states";

export function SegurancaScreen() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [saml, setSaml] = useState<CrmSamlConfigDto | null>(null);
  const [mfa, setMfa] = useState<CrmMfaStatusDto | null>(null);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [policy, setPolicy] = useState({
    mfa_required: false,
    saml_enabled: false,
    jit_provision: false,
  });
  const [idpEntityId, setIdpEntityId] = useState("");
  const [idpSsoUrl, setIdpSsoUrl] = useState("");
  const [certPem, setCertPem] = useState("");
  const [enrollSecret, setEnrollSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [s, m, u] = await Promise.all([
        getSamlConfig().catch(() => null),
        getMfaStatus().catch(() => ({ enabled: false })),
        apiGet("/api/saas/usuarios")
          .then((d) => asPage<UserDto>(d).items)
          .catch(() => [] as UserDto[]),
      ]);
      setSaml(s);
      setMfa(m);
      setUsers(u.filter((x) => x.ativo));
      setIdpEntityId(s?.idp_entity_id ?? "");
      setIdpSsoUrl(s?.idp_sso_url ?? "");
      setPolicy({
        mfa_required: false,
        saml_enabled: Boolean(s?.enabled),
        jit_provision: Boolean(s?.jit_provision),
      });
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSaml(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await putSamlConfig({
        enabled: policy.saml_enabled,
        idp_entity_id: idpEntityId.trim() || null,
        idp_sso_url: idpSsoUrl.trim() || null,
        idp_certificate_pem: certPem.trim() || undefined,
        jit_provision: policy.jit_provision,
      });
      setSaml(saved);
      setCertPem("");
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onTestSaml() {
    setBusy(true);
    try {
      const res = await testSamlConfig();
      toast.success(res.message || "SAML stub OK");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy() {
    setBusy(true);
    try {
      await putSecurityPolicy(policy);
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onStartMfa() {
    setBusy(true);
    try {
      const res = await startMfa();
      setEnrollSecret(res.secret);
      setOtpauth(res.otpauth_uri);
      toast.success(COPY.crm.mfa_secret_once);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmMfa(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await confirmMfa(mfaCode.trim());
      setEnrollSecret(null);
      setOtpauth(null);
      setMfaCode("");
      setMfa(await getMfaStatus());
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onDisableMfa(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await disableMfa(mfaCode.trim());
      setMfaCode("");
      setMfa(await getMfaStatus());
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onAdminReset(userId: string) {
    setBusy(true);
    try {
      await adminResetMfa(userId);
      toast.success(COPY.crm.mfa_admin_reset_ok);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <SaasPage title={COPY.crm.nav_seguranca}>
        <FormSkeleton />
      </SaasPage>
    );
  }

  if (status === "error") {
    return (
      <SaasPage title={COPY.crm.nav_seguranca}>
        <ErrorState onRetry={() => void load()} />
      </SaasPage>
    );
  }

  return (
    <SaasPage title={COPY.crm.nav_seguranca}>
      <Alert className="mb-6">
        <AlertDescription>{COPY.crm.seguranca_stub_note}</AlertDescription>
      </Alert>

      <Tabs defaultValue="politica">
        <TabsList>
          <TabsTrigger value="politica">Política</TabsTrigger>
          <TabsTrigger value="saml">SAML</TabsTrigger>
          <TabsTrigger value="mfa">MFA</TabsTrigger>
        </TabsList>

        <TabsContent value="politica" className="mt-4">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>{COPY.crm.seguranca_policy}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={policy.mfa_required}
                  onCheckedChange={(v) => setPolicy((p) => ({ ...p, mfa_required: Boolean(v) }))}
                />
                MFA obrigatório
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={policy.saml_enabled}
                  onCheckedChange={(v) => setPolicy((p) => ({ ...p, saml_enabled: Boolean(v) }))}
                />
                SAML habilitado
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={policy.jit_provision}
                  onCheckedChange={(v) => setPolicy((p) => ({ ...p, jit_provision: Boolean(v) }))}
                />
                Provisionamento JIT (admin)
              </label>
              <Button type="button" disabled={busy} onClick={() => void savePolicy()}>
                {COPY.actions.salvar}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saml" className="mt-4">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>SAML IdP</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={saveSaml}>
                <div>
                  <Label htmlFor="idp_entity">Entity ID do IdP</Label>
                  <Input
                    id="idp_entity"
                    className="mt-1"
                    value={idpEntityId}
                    onChange={(e) => setIdpEntityId(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="idp_sso">SSO URL</Label>
                  <Input
                    id="idp_sso"
                    className="mt-1"
                    value={idpSsoUrl}
                    onChange={(e) => setIdpSsoUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="idp_cert">
                    Certificado PEM
                    {saml?.certificate_present || saml?.idp_certificate_present
                      ? " (já salvo — deixe vazio para manter)"
                      : ""}
                  </Label>
                  <Textarea
                    id="idp_cert"
                    className="mt-1 font-mono text-xs"
                    rows={4}
                    value={certPem}
                    onChange={(e) => setCertPem(e.target.value)}
                    placeholder="-----BEGIN CERTIFICATE-----"
                  />
                </div>
                {saml?.acs_url || saml?.metadata_url ? (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {saml.acs_url ? <p>ACS: {saml.acs_url}</p> : null}
                    {saml.metadata_url ? <p>Metadata: {saml.metadata_url}</p> : null}
                    {saml.sp_entity_id ? <p>SP entity: {saml.sp_entity_id}</p> : null}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={busy}>
                    {COPY.actions.salvar}
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void onTestSaml()}>
                    Testar (stub)
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mfa" className="mt-4 space-y-6">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Meu MFA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {mfa?.enrolled || mfa?.enabled ? "Ativo" : "Inativo"}
                </Badge>
                {mfa?.mfa_required ? (
                  <span className="text-sm text-muted-foreground">obrigatório no tenant</span>
                ) : null}
              </div>
              {!(mfa?.enrolled || mfa?.enabled) ? (
                <>
                  {!enrollSecret ? (
                    <Button type="button" disabled={busy} onClick={() => void onStartMfa()}>
                      Iniciar cadastro MFA
                    </Button>
                  ) : (
                    <form className="space-y-3" onSubmit={onConfirmMfa}>
                      <Alert>
                        <AlertDescription>
                          Segredo (uma vez): <code className="text-xs">{enrollSecret}</code>
                          {otpauth ? (
                            <>
                              <br />
                              <span className="break-all text-xs">{otpauth}</span>
                            </>
                          ) : null}
                        </AlertDescription>
                      </Alert>
                      <div>
                        <Label htmlFor="mfa_code">Código TOTP</Label>
                        <Input
                          id="mfa_code"
                          className="mt-1"
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value)}
                          required
                        />
                      </div>
                      <Button type="submit" disabled={busy}>
                        Confirmar
                      </Button>
                    </form>
                  )}
                </>
              ) : (
                <form className="space-y-3" onSubmit={onDisableMfa}>
                  <div>
                    <Label htmlFor="mfa_disable">Código para desativar</Label>
                    <Input
                      id="mfa_disable"
                      className="mt-1"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" variant="outline" disabled={busy}>
                    Desativar MFA
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reset admin</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{u.nome}</p>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onAdminReset(u.id)}
                    >
                      Reset MFA
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </SaasPage>
  );
}
