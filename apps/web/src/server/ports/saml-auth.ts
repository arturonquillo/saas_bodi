import type { SamlAuthPort } from "@saas-frota/shared";

export const samlAuthPort: SamlAuthPort = {
  async getSpMetadata(tenantId) {
    const entityId = `urn:saas-frota:sp:${tenantId}`;
    const acs = `/api/saas/auth/saml/acs?tenant_id=${encodeURIComponent(tenantId)}`;
    return `<?xml version="1.0"?>
<EntityDescriptor entityID="${entityId}" xmlns="urn:oasis:names:tc:SAML:2.0:metadata">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acs}" index="0"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
  },

  async validateAssertion(input) {
    // Fixture harness — no live IdP HTTP. Accept known test markers only.
    const raw = input.rawSamlResponse ?? "";
    if (raw.includes("FIXTURE_OK") || raw === "fixture-ok") {
      return { ok: true, nameId: "fixture-user", email: "saml-fixture@example.local" };
    }
    if (process.env.SAML_LIVE_UNLOCK === "true" && raw.trim()) {
      return { ok: false, reason: "parse_live_nao_implementado" };
    }
    return { ok: false, reason: "assertion_invalida_ou_stub" };
  },
};
