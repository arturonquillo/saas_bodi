import type { IntegrationConnectPort } from "@saas-frota/shared";

/** Never opens Slack/Linear/etc sockets in default tests. */
export const integrationConnectPort: IntegrationConnectPort = {
  async test() {
    return { ok: true, stub: true };
  },
};
