import * as path from "node:path";

export const CODE_REVIEW_API_HOST = "127.0.0.1";
export const CODE_REVIEW_API_PORT = 3142;
export const CODE_REVIEW_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
export const CODE_REVIEW_CACHE_ROOT = path.resolve("artifacts", "code-review-cache");
export const CODE_REVIEW_DEPENDENCY_TIMEOUT_MS = 2500;
export const PLAN_API_ORIGIN = process.env.PLAN_API_ORIGIN ?? "http://127.0.0.1:3140";
export const AUDIT_API_ORIGIN = process.env.AUDIT_API_ORIGIN ?? "http://127.0.0.1:3180";
