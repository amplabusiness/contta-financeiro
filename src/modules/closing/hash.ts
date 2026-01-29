import crypto from "crypto";

export function stableJsonStringify(obj: unknown): string {
  const seen = new WeakSet();
  const stringify = (value: any): any => {
    if (value && typeof value === "object") {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);

      if (Array.isArray(value)) return value.map(stringify);

      return Object.keys(value)
        .sort()
        .reduce((acc: any, key: string) => {
          acc[key] = stringify(value[key]);
          return acc;
        }, {});
    }
    return value;
  };

  return JSON.stringify(stringify(obj));
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hashClosingInput(input: object): string {
  return sha256(stableJsonStringify(input));
}
