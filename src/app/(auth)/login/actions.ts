"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

const EmailSchema = z.string().email();

export async function sendMagicLink(formData: FormData): Promise<void> {
  const email = formData.get("email");

  const parsed = EmailSchema.safeParse(email);
  if (!parsed.success) {
    redirect("/login?error=invalid_email");
  }

  // Derive redirect URL from the actual request host so we never depend
  // on NEXT_PUBLIC_APP_URL being set correctly in each environment.
  const headersList = await headers();
  const host = headersList.get("host") ?? "treasury-os-black.vercel.app";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const emailRedirectTo = `${proto}://${host}/auth/callback`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error("signInWithOtp error:", error.message, "| redirectTo:", emailRedirectTo);
    redirect(`/login?error=send_failed&reason=${encodeURIComponent(error.message)}`);
  }

  redirect(`/login?sent=1&email=${encodeURIComponent(parsed.data)}`);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
