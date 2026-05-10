"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const EmailSchema = z.email();

export async function sendMagicLink(formData: FormData): Promise<void> {
  const email = formData.get("email");

  const parsed = EmailSchema.safeParse(email);
  if (!parsed.success) {
    redirect("/login?error=invalid_email");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect("/login?error=send_failed");
  }

  redirect(`/login?sent=1&email=${encodeURIComponent(parsed.data)}`);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
