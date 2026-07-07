export {
  PLAN_LIMITS,
  PLAN_LABELS,
  PRODUCT_LABELS,
  MODEL_LABELS,
  countWords,
  initialTokensForPlan,
  normalizeProduct,
  type TezmakalePlan,
  type TezmakaleProduct,
} from "./config.js";
export {
  registerUser,
  loginUser,
  logoutSession,
  resolveSession,
  getAccountById,
  type TezmakaleUser,
} from "./auth.js";
export {
  enforceProductLimit,
  recordProductUsage,
  getUsageSnapshot,
  getAllUsageSnapshots,
  setAccountPlan,
} from "./limits.js";
export { ozdnaDeepDetect, ozdnaParaphrase, ozdnaHumanize } from "./ozdna-client.js";
export {
  verifyLemonSqueezySignature,
  handleLemonSqueezyWebhook,
  getCheckoutConfig,
} from "./lemon-squeezy.js";
export { createReportOrder, fulfillReportOrder, getReportOrder } from "./reports.js";
export { getDashboard, getSubscription } from "./dashboard.js";

export function parseSessionToken(header: string | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7).trim();
}
