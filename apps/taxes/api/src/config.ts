import * as path from "node:path";

export const API_HOST = "127.0.0.1";
export const API_PORT = 3040;
export const MAX_UPLOAD_FILE_BYTES = 25 * 1024 * 1024;
export const WORKSPACE_DATA_ROOT = path.resolve("data", "workspace");
export const DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/sqlite/taxes.db";
