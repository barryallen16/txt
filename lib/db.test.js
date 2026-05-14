import { Database } from "bun:sqlite";
import { describe, expect, mock, test } from "bun:test";

// expo-sqlite cannot run in bun, but the synchronous API the app uses maps
// almost one-to-one onto bun:sqlite. An in-memory database keeps every test
// isolated without an Android device.
const database = new Database(":memory:");

mock.module("expo-sqlite", () => ({
  openDatabaseSync: () => ({
    execSync: (sql) => database.exec(sql),
    getAllSync: (sql, params = []) => database.query(sql).all(...params),
    getFirstSync: (sql, params = []) => database.query(sql).get(...params) ?? null,
    runSync: (sql, params = []) => {
      const result = database.query(sql).run(...params);
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: result.changes,
      };
    },
    withTransactionSync: (task) => database.transaction(task)(),
  }),
}));

const {
  getMissingPartIndices,
  listPendingTransfers,
  savePart,
} = await import("./db");

const KEY = "ab12";

function addPart(seq, total = 15, transferKey = KEY) {
  return savePart({
    transferKey,
    seq,
    chunk: "QUJD",
    kind: "i",
    total,
    crc: "0000000",
    sender: "9876543210",
    receivedAt: Date.now() + seq,
  });
}

describe("pending transfers", () => {
  test("a half-received transfer reports its count and total", () => {
    for (let seq = 0; seq < 5; seq++) addPart(seq);

    const pending = listPendingTransfers();

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      transfer_key: KEY,
      kind: "i",
      sender: "9876543210",
      total: 15,
      received_count: 5,
    });
  });

  test("missing indices are the unseen zero-based sequence numbers", () => {
    expect(getMissingPartIndices(KEY)).toEqual([
      5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
  });

  test("savePart reports whether the part was new", () => {
    expect(addPart(0).inserted).toBe(false);

    const fresh = addPart(14, 15, "cd34");
    expect(fresh.inserted).toBe(true);
    expect(fresh.count).toBe(1);
  });

  test("a transfer with every part is not pending any more", () => {
    for (let seq = 0; seq < 15; seq++) addPart(seq, 15, "ef56");

    const keys = listPendingTransfers().map((row) => row.transfer_key);
    expect(keys).not.toContain("ef56");
  });

  test("missing indices are empty when every part is stored", () => {
    expect(getMissingPartIndices("ef56")).toEqual([]);
    expect(getMissingPartIndices("nope")).toEqual([]);
  });
});
