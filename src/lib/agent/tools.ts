import "server-only";
import type Anthropic from "@anthropic-ai/sdk";

// Tool definitions passed to the Anthropic API.
// All 5 tools from PLAN.md §3.4.

export const COPILOT_TOOLS: Anthropic.Tool[] = [
  {
    name: "analyze_treasury",
    description:
      "Analisa o snapshot atual da tesouraria e identifica gaps, riscos e excedente ocioso. Deve ser chamada antes de propose_allocation.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "explain_policy",
    description:
      "Explica a política de tesouraria ativa em linguagem simples, detalhando cada regra e seus parâmetros.",
    input_schema: {
      type: "object" as const,
      properties: {
        policy_id: {
          type: "string",
          description: "UUID da política a explicar (opcional — usa a ativa se omitido)",
        },
      },
      required: [],
    },
  },
  {
    name: "propose_allocation",
    description:
      "Propõe uma lista de ações de alocação do excedente de tesouraria, validadas pelo rules-engine. Retorna ações ordenadas por prioridade.",
    input_schema: {
      type: "object" as const,
      properties: {
        excess_amount_usd: {
          type: "number",
          description: "Valor em USD disponível para alocação",
        },
        risk_preference: {
          type: "string",
          enum: ["conservative", "balanced", "aggressive"],
          description: "Preferência de risco para a alocação",
        },
      },
      required: ["excess_amount_usd"],
    },
  },
  {
    name: "simulate_scenario",
    description:
      "Executa projectScenario() com as ações fornecidas e retorna o diff de métricas: runway, yield, concentração, compliance.",
    input_schema: {
      type: "object" as const,
      properties: {
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["deposit", "withdraw", "rebalance"] },
              adapter_id: { type: "string" },
              amount_usd: { type: "number" },
            },
            required: ["kind", "adapter_id", "amount_usd"],
          },
          description: "Lista de ações para simular",
        },
      },
      required: ["actions"],
    },
  },
  {
    name: "draft_policy_from_description",
    description:
      "Gera um JSON de política a partir de uma descrição em linguagem natural. O JSON gerado é validado pelo rules-engine antes de retornar.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description: "Descrição da política em linguagem natural (PT ou EN)",
        },
      },
      required: ["description"],
    },
  },
];

// Typed input shapes for each tool
export type AnalyzeTreasuryInput = Record<string, never>;

export interface ExplainPolicyInput {
  policy_id?: string;
}

export interface ProposeAllocationInput {
  excess_amount_usd: number;
  risk_preference?: "conservative" | "balanced" | "aggressive";
}

export interface SimulateScenarioInput {
  actions: { kind: "deposit" | "withdraw" | "rebalance"; adapter_id: string; amount_usd: number }[];
}

export interface DraftPolicyInput {
  description: string;
}

export type ToolInput =
  | AnalyzeTreasuryInput
  | ExplainPolicyInput
  | ProposeAllocationInput
  | SimulateScenarioInput
  | DraftPolicyInput;
