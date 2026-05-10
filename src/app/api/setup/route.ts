import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { organizations, memberships, buckets, policies, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { POLICY_PRESETS } from "@/lib/rules-engine/policy";
import { verifySiwsAndLinkWallet } from "@/lib/solana/siws";

const DEFAULT_BUCKETS: { kind: typeof buckets.$inferInsert["kind"]; label: string }[] = [
  { kind: "operating", label: "Operacional" },
  { kind: "payroll", label: "Folha" },
  { kind: "tax", label: "Impostos" },
  { kind: "emergency", label: "Reserva" },
  { kind: "yield", label: "Excedente" },
];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    }

    const body = await req.json() as Record<string, unknown>;
    const action = body.action as string;

    if (action === "createOrg") {
      const { name, profile, monthlyBurnUsd, simulatedMode } = body as {
        name: string;
        profile: "startup" | "dao" | "fund";
        monthlyBurnUsd: number;
        simulatedMode: boolean;
      };

      await db
        .insert(users)
        .values({ id: user.id, email: user.email ?? "" })
        .onConflictDoNothing();

      const [org] = await db
        .insert(organizations)
        .values({ name, profile, monthlyBurnUsd, simulatedMode })
        .returning();

      await db.insert(memberships).values({
        orgId: org.id,
        userId: user.id,
        role: "owner",
      });

      await db.insert(buckets).values(
        DEFAULT_BUCKETS.map((b) => ({ ...b, orgId: org.id, targetAmountCents: 0 }))
      );

      const preset = POLICY_PRESETS.balanced;
      await db.insert(policies).values({
        orgId: org.id,
        version: 1,
        status: "active",
        preset: "balanced",
        jsonSpec: preset.rules as unknown as Record<string, unknown>[],
        activatedAt: new Date(),
      });

      return NextResponse.json({ ok: true, orgId: org.id });
    }

    if (action === "linkWallet") {
      const { address, signature, message, orgId } = body as {
        address: string;
        signature: string;
        message: string;
        orgId: string;
      };
      const result = await verifySiwsAndLinkWallet({
        address, signature, message, orgId, label: "Phantom",
      });
      return NextResponse.json(result);
    }

    if (action === "setOrgPreset") {
      const { orgId, preset } = body as {
        orgId: string;
        preset: "conservative" | "balanced" | "aggressive";
      };

      const active = await db.query.policies.findFirst({
        where: and(eq(policies.orgId, orgId), eq(policies.status, "active")),
      });
      if (!active) {
        return NextResponse.json({ ok: false, error: "Política ativa não encontrada." });
      }

      const presetData = POLICY_PRESETS[preset];
      await db
        .update(policies)
        .set({ preset, jsonSpec: presetData.rules as unknown as Record<string, unknown>[] })
        .where(eq(policies.id, active.id));

      return NextResponse.json({ ok: true });
    }

    if (action === "updateBucketTargets") {
      const { orgId, targets } = body as {
        orgId: string;
        targets: { kind: string; amountCents: number }[];
      };

      await Promise.all(
        targets.map((t) =>
          db
            .update(buckets)
            .set({ targetAmountCents: t.amountCents })
            .where(
              and(
                eq(buckets.orgId, orgId),
                eq(buckets.kind, t.kind as typeof buckets.$inferInsert["kind"])
              )
            )
        )
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/setup] error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
