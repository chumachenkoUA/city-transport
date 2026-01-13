const toCamelKey = (value: string): string =>
  value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  return Object.getPrototypeOf(value) === Object.prototype;
};

export function transformToCamelCase<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => transformToCamelCase(item)) as T;
  }

  if (data instanceof Date) {
    return data;
  }

  if (isPlainObject(data)) {
    const newObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      newObj[toCamelKey(key)] = transformToCamelCase(value);
    }
    return newObj as T;
  }

  return data;
}
