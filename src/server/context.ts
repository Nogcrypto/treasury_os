import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { memberships, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface TRPCContext {
  db: typeof db;
  userId: string | null;
  orgId: string | null;
}

export async function createContext(): Promise<TRPCContext> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { db, userId: null, orgId: null };
  }

  // Get the user's primary org
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });

  return {
    db,
    userId: user.id,
    orgId: membership?.orgId ?? null,
  };
}
