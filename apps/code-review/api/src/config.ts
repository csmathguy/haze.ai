import * as path from "node:path";

export const CODE_REVIEW_API_HOST = "127.0.0.1";
export const CODE_REVIEW_API_PORT = 3142;
export const CODE_REVIEW_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
export const CODE_REVIEW_CACHE_ROOT = path.resolve("artifacts", "code-review-cache");
