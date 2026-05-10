"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const EmailSchema = z.string().email();

export async function sendPasswordReset(formData: FormData): Promise<void> {
  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    redirect("/forgot-password?error=invalid_email");
  }

  const headersList = await headers();
  const host = headersList.get("host") ?? "treasury-os-black.vercel.app";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const redirectTo = `${proto}://${host}/auth/callback?next=/reset-password`;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });

  redirect("/forgot-password?sent=1");
}
