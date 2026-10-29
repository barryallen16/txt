import { Database } from "bun:sqlite";
import { describe, expect, mock, test } from "bun:test";

// expo-sqlite cannot run in bun, but the synchronous API the app uses maps
// almost one-to-one onto bun:sqlite. An in-memory database keeps every test
// isolated without an Android device.
mock.module("react-native", () => ({
  Linking: { openSettings: async () => {} },
  PermissionsAndroid: {
    PERMISSIONS: {
      SEND_SMS: "SEND_SMS",
      READ_SMS: "READ_SMS",
      CAMERA: "CAMERA",
    },
    RESULTS: { GRANTED: "granted" },
    check: async (p) => true,
    requestMultiple: async () => ({}),
  },
  Platform: { OS: "android" },
}));

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
  listTransfers,
  savePart,
  saveTransfer,
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

describe("transfers history", () => {
  test("separates received and sent transfers", () => {
    saveTransfer({
      transferKey: "rx01",
      kind: "q",
      sender: "9876543210",
      payload: "upi://pay?pa=a@b",
      direction: "received",
    });

    saveTransfer({
      transferKey: "tx01",
      kind: "q",
      recipient: "Alice (9123456789)",
      payload: "upi://pay?pa=alice@upi",
      direction: "sent",
    });

    const received = listTransfers("received");
    const sent = listTransfers("sent");

    expect(received.some((r) => r.transfer_key === "rx01")).toBe(true);
    expect(received.some((r) => r.transfer_key === "tx01")).toBe(false);

    expect(sent.some((s) => s.transfer_key === "tx01")).toBe(true);
    expect(sent.some((s) => s.transfer_key === "rx01")).toBe(false);

    const sentItem = sent.find((s) => s.transfer_key === "tx01");
    expect(sentItem.recipient).toBe("Alice (9123456789)");
    expect(sentItem.direction).toBe("sent");
  });
});
