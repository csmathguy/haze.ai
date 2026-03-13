type CompactAuditContext<T extends Record<string, string | undefined>> = {
  [Key in keyof T]?: Exclude<T[Key], undefined>;
};

export function compactAuditContextFields<T extends Record<string, string | undefined>>(value: T): CompactAuditContext<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as CompactAuditContext<T>;
}
