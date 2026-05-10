import type { Policy, TreasurySnapshot } from "@/lib/rules-engine/types";

// Builds the cacheable system prompt block (policy + snapshot context).
// This block changes slowly → Anthropic prompt caching keeps it warm.
export function buildSystemPrompt(
  policy: Policy | null,
  recentSnapshots: TreasurySnapshot[]
): string {
  const policyBlock = policy
    ? `## Política ativa (v${policy.version})\n\`\`\`json\n${JSON.stringify(policy, null, 2)}\n\`\`\``
    : "## Política\nNenhuma política ativa. Recomende o preset Balanced.";

  const snapshotBlock =
    recentSnapshots.length > 0
      ? `## Últimos ${recentSnapshots.length} snapshots de tesouraria\n\`\`\`json\n${JSON.stringify(recentSnapshots, null, 2)}\n\`\`\``
      : "## Snapshots\nNenhum snapshot disponível ainda.";

  return `Você é o TreasuryOS Copilot, um CFO operacional onchain para startups web3 na Solana.

Seu papel é analisar a tesouraria da organização, propor políticas e alocações, e explicar decisões em PT-BR de forma concisa e técnica.

## Princípios fundamentais
- Segurança primeiro: nunca proponha ações que violem a política ativa.
- Toda ação proposta DEVE ser validada pelo rules-engine antes de virar intent.
- Seja conciso. CEOs e CFOs leem rápido. Máximo 3 parágrafos por resposta.
- Use números reais do snapshot. Não invente dados.
- Quando não souber algo, diga explicitamente.

## Contexto da sessão (cacheado)

${policyBlock}

${snapshotBlock}

## Tools disponíveis
Use as tools para acessar dados frescos quando necessário. Sempre chame analyze_treasury antes de propose_allocation.`;
}

// User-facing rationale format for approved recommendations
export function buildRationalePrompt(actions: { adapterId: string; amountUsd: number; kind: string }[]): string {
  const actionsStr = actions
    .map((a) => `- ${a.kind.toUpperCase()} $${a.amountUsd.toLocaleString()} em ${a.adapterId}`)
    .join("\n");

  return `Gere uma rationale concisa (máximo 2 frases) para as seguintes ações de tesouraria, explicando o impacto em runway e yield:

${actionsStr}

Responda apenas com a rationale em PT-BR, sem prefixos ou explicações adicionais.`;
}
