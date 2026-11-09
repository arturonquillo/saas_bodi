import type { CaptainAiPort } from "@saas-frota/shared";

function stubProposal(mode: string, promptStub?: string) {
  switch (mode) {
    case "triage":
      return {
        labels: ["intent:outro"],
        priority: "medium",
        note: "Sugestão stub de triagem",
      };
    case "monitor":
      return {
        flag: "atencao",
        reason: "Monitoramento stub — sem modelo ao vivo",
      };
    case "assistant":
      return {
        answer: promptStub?.trim() || "Resposta stub com base na Central de Ajuda (sem retrieval live).",
        article_slugs: ["como-fazer-um-pedido"],
      };
    case "copilot":
    default:
      return {
        reply:
          promptStub?.trim() ||
          "Olá! Sou uma sugestão stub do Captain. Confirme antes de enviar ao contato.",
      };
  }
}

/**
 * Default Captain adapter = deterministic fixtures.
 * Live model only when CAPTAIN_PROVIDER_ENABLED=true AND a key is present.
 * Never calls Meta Graph.
 */
export const captainAiPort: CaptainAiPort = {
  async suggest(input) {
    const unlocked =
      process.env.CAPTAIN_PROVIDER_ENABLED === "true" &&
      Boolean(process.env.CAPTAIN_PROVIDER_API_KEY?.trim());
    if (unlocked) {
      // Live unlock path still returns a shaped fixture in this MVP — no unpaid HTTP.
      return {
        proposal: {
          ...stubProposal(input.mode, input.promptStub),
          provider_note: "live_unlocked_fixture",
        },
        provider: "live",
      };
    }
    return {
      proposal: stubProposal(input.mode, input.promptStub),
      provider: "stub",
    };
  },
};
