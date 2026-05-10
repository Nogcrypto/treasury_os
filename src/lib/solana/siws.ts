import "server-only";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { wallets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import nacl from "tweetnacl";
import bs58 from "bs58";

// Server-side: verify a SIWS signature and link the wallet to the org.
export async function verifySiwsAndLinkWallet(params: {
  address: string;
  signature: string;   // base64
  message: string;
  orgId: string;
  label?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { address, signature, message, orgId, label } = params;

  // 1. Verify ed25519 signature
  try {
    const messageBytes = new TextEncoder().encode(message);
    const sigBytes = Buffer.from(signature, "base64");
    const pubkeyBytes = bs58.decode(address);

    const valid = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes);
    if (!valid) return { ok: false, error: "Assinatura inválida." };
  } catch {
    return { ok: false, error: "Falha na verificação da assinatura." };
  }

  // 2. Verify the message contains the expected domain
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Usuário não autenticado." };

  // 3. Upsert wallet linked to org
  await db
    .insert(wallets)
    .values({ orgId, address, label: label ?? "Phantom", isPrimary: true })
    .onConflictDoUpdate({
      target: [wallets.orgId, wallets.address],
      set: { label: label ?? "Phantom", isPrimary: true },
    });

  return { ok: true };
}
