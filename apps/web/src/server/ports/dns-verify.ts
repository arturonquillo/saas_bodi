import type { DnsVerifyPort } from "@saas-frota/shared";

/**
 * DNS TXT verify stub. In tests, DNS_VERIFY_STUB_SUCCESS=true marks verified.
 * Without provider, fail-closed (verified=false, skipped=no_provider).
 */
export const dnsVerifyPort: DnsVerifyPort = {
  async verifyTxt(input) {
    if (process.env.DNS_VERIFY_STUB_SUCCESS === "true") {
      return { verified: Boolean(input.expectedToken && input.domain) };
    }
    if (process.env.DNS_VERIFY_PROVIDER_ENABLED === "true") {
      // Reserved live path — not implemented unpaid.
      return { verified: false };
    }
    return { verified: false, skipped: "no_provider" };
  },
};
