import { router } from "../trpc";
import { intentRouter } from "./intent";
import { orgRouter } from "./org";
import { snapshotRouter } from "./snapshot";
import { bucketRouter } from "./bucket";
import { obligationRouter } from "./obligation";
import { policyRouter } from "./policy";
import { recommendationRouter } from "./recommendation";
import { equityRouter } from "./equity";

export const appRouter = router({
  intent: intentRouter,
  org: orgRouter,
  snapshot: snapshotRouter,
  bucket: bucketRouter,
  obligation: obligationRouter,
  policy: policyRouter,
  recommendation: recommendationRouter,
  equity: equityRouter,
});

export type AppRouter = typeof appRouter;
