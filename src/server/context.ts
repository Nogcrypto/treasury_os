import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isDemoUser, DEMO_ORG_ID } from "@/lib/demo";

export interface TRPCContext {
  db: typeof db;
  userId: string | null;
  orgId: string | null;
  isDemoUser: boolean;
  userEmail: string | null;
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
    return { db, userId: null, orgId: null, isDemoUser: false, userEmail: null };
  }

  const email = user.email ?? null;
  const demo = isDemoUser(email);

  if (demo) {
    return { db, userId: user.id, orgId: DEMO_ORG_ID, isDemoUser: true, userEmail: email };
  }

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });

  return {
    db,
    userId: user.id,
    orgId: membership?.orgId ?? null,
    isDemoUser: false,
    userEmail: email,
  };
}
