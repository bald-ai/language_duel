type TestRow = {
  _id: string;
  _creationTime?: number;
};

type IndexFilters = Record<string, unknown>;

type EqBuilder = {
  eq: (field: string, value: unknown) => EqBuilder;
  gte: (field: string, value: unknown) => EqBuilder;
  lt: (field: string, value: unknown) => EqBuilder;
};

type IndexFilter = {
  op: "eq" | "gte" | "lt";
  field: string;
  value: unknown;
};

export function createIndexedQuery<T extends TestRow>(rows: T[]) {
  const createResult = (resultRows: T[]) => ({
    take: async (count: number) => resultRows.slice(0, count),
    collect: async () => resultRows,
    first: async () => resultRows[0] ?? null,
    unique: async () => resultRows[0] ?? null,
  });

  return {
    ...createResult([...rows]),
    withIndex: (_indexName: string, builder: (q: EqBuilder) => unknown) => {
      const filters: IndexFilters = {};
      const rangeFilters: IndexFilter[] = [];
      const q: EqBuilder = {
        eq: (field: string, value: unknown) => {
          filters[field] = value;
          return q;
        },
        gte: (field: string, value: unknown) => {
          rangeFilters.push({ op: "gte", field, value });
          return q;
        },
        lt: (field: string, value: unknown) => {
          rangeFilters.push({ op: "lt", field, value });
          return q;
        },
      };

      builder(q);

      const filtered = rows.filter((row) => {
        const rowRecord = row as Record<string, unknown>;
        const matchesEqualities = Object.entries(filters).every(
          ([field, value]) => (row as Record<string, unknown>)[field] === value
        );
        const matchesRanges = rangeFilters.every(({ op, field, value }) => {
          const rowValue = rowRecord[field];
          if (typeof rowValue !== "number" || typeof value !== "number") return false;
          return op === "gte" ? rowValue >= value : rowValue < value;
        });
        return matchesEqualities && matchesRanges;
      });

      return createResult(filtered);
    },
  };
}

export function findRowById<T extends TestRow>(tables: Array<ReadonlyArray<T>>, id: string): T | null {
  for (const table of tables) {
    const match = table.find((row) => row._id === id);
    if (match) {
      return match;
    }
  }

  return null;
}

export function patchRow<T extends TestRow>(rows: T[], id: string, value: Record<string, unknown>): void {
  const index = rows.findIndex((row) => row._id === id);
  if (index < 0) {
    throw new Error(`Row not found: ${id}`);
  }

  rows[index] = {
    ...rows[index],
    ...value,
  } as T;
}

export function deleteRow<T extends TestRow>(rows: T[], id: string): void {
  const index = rows.findIndex((row) => row._id === id);
  if (index >= 0) {
    rows.splice(index, 1);
  }
}

export function insertRow<T extends TestRow>(
  rows: T[],
  prefix: string,
  counter: number,
  value: Record<string, unknown>
): { id: string; nextCounter: number } {
  const id = `${prefix}_${counter}`;
  rows.push({
    _id: id,
    _creationTime: Date.now(),
    ...value,
  } as unknown as T);

  return { id, nextCounter: counter + 1 };
}

export function createAuthCtx<TDb, TExtras extends object = Record<string, never>>(
  db: TDb,
  identitySubject: string | null,
  extras?: TExtras
) {
  return {
    db,
    auth: {
      getUserIdentity: async () =>
        identitySubject ? { subject: identitySubject } : null,
    },
    ...(extras ?? ({} as TExtras)),
  };
}

export function createIdentityCtx<TDb, TExtras extends object = Record<string, never>>(
  db: TDb,
  identity: { subject: string } | null,
  extras?: TExtras
) {
  return {
    db,
    auth: {
      getUserIdentity: async () => identity,
    },
    ...(extras ?? ({} as TExtras)),
  };
}
