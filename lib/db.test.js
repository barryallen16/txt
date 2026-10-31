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
  listHistoryRequests,
  listPendingTransfers,
  listRequests,
  listTransfers,
  savePart,
  saveRequest,
  saveTransfer,
  setRequestStatus,
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

describe("payment requests duplicate prevention & history", () => {
  test("saveRequest inserts a new request and prevents duplicate open rows", () => {
    const res1 = saveRequest({
      text: ":txt Pay Rs 100 upi://pay?pa=alice@upi&cu=INR",
      link: "upi://pay?pa=alice@upi&cu=INR",
      payeeVpa: "alice@upi",
      amount: "100",
      sender: "9876543210",
      sourceApp: "sms",
    });
    expect(res1.inserted).toBe(true);
    expect(typeof res1.id).toBe("number");

    // Second sync of the same message or link
    const res2 = saveRequest({
      text: ":txt Pay Rs 100 upi://pay?pa=alice@upi&cu=INR",
      link: "upi://pay?pa=alice@upi&cu=INR",
      payeeVpa: "alice@upi",
      amount: "100",
      sender: "9876543210",
      sourceApp: "sms",
    });
    expect(res2.inserted).toBe(false);
    expect(res2.id).toBe(res1.id);

    const openList = listRequests("open");
    expect(openList.filter((r) => r.upi_link === "upi://pay?pa=alice@upi&cu=INR")).toHaveLength(1);
  });

  test("marking done or dismissed moves request to history and never resurrects as open on resync", () => {
    const res = saveRequest({
      text: ":txt Pay Rs 500 upi://pay?pa=bob@upi&cu=INR",
      link: "upi://pay?pa=bob@upi&cu=INR",
      payeeVpa: "bob@upi",
      amount: "500",
      sender: "9123456789",
      sourceApp: "sms",
    });
    expect(res.inserted).toBe(true);

    // User marks it done
    setRequestStatus(res.id, "done");

    // Verify it is in history and not open
    expect(listRequests("open").some((r) => r.id === res.id)).toBe(false);
    expect(listHistoryRequests().some((r) => r.id === res.id)).toBe(true);

    // Inbox sync runs again later (e.g. user sends a new request or pulls to refresh)
    const resync = saveRequest({
      text: ":txt Pay Rs 500 upi://pay?pa=bob@upi&cu=INR",
      link: "upi://pay?pa=bob@upi&cu=INR",
      payeeVpa: "bob@upi",
      amount: "500",
      sender: "9123456789",
      sourceApp: "sms",
    });
    expect(resync.inserted).toBe(false);

    // MUST NOT resurrect into open requests
    expect(listRequests("open").some((r) => r.upi_link === "upi://pay?pa=bob@upi&cu=INR")).toBe(false);
    expect(listHistoryRequests().some((r) => r.upi_link === "upi://pay?pa=bob@upi&cu=INR")).toBe(true);
  });

  test("a new payment request with a new message for a previously handled UPI link IS accepted", () => {
    const resNew = saveRequest({
      text: ":txt Pay Rs 750 upi://pay?pa=bob@upi&cu=INR",
      link: "upi://pay?pa=bob@upi&cu=INR",
      payeeVpa: "bob@upi",
      amount: "750",
      sender: "9123456789",
      sourceApp: "sms",
    });
    expect(resNew.inserted).toBe(true);
    expect(listRequests("open").some((r) => r.id === resNew.id)).toBe(true);
  });

  test("a new payment request while a previous request for the SAME link is STILL OPEN is accepted", () => {
    // resNew for bob@upi is still open
    const resAnother = saveRequest({
      text: ":txt Pay Rs 900 upi://pay?pa=bob@upi&cu=INR",
      link: "upi://pay?pa=bob@upi&cu=INR",
      payeeVpa: "bob@upi",
      amount: "900",
      sender: "9123456789",
      sourceApp: "sms",
      smsId: 1001,
    });
    expect(resAnother.inserted).toBe(true);
    expect(listRequests("open").some((r) => r.id === resAnother.id)).toBe(true);

    // Both should be in open requests
    const openRows = listRequests("open").filter((r) => r.upi_link === "upi://pay?pa=bob@upi&cu=INR");
    expect(openRows.length).toBeGreaterThanOrEqual(2);
  });

  test("an identical text message with a new distinct smsId (e.g. reminder) is accepted as a new SMS", () => {
    const reminder = saveRequest({
      text: ":txt Pay Rs 900 upi://pay?pa=bob@upi&cu=INR",
      link: "upi://pay?pa=bob@upi&cu=INR",
      payeeVpa: "bob@upi",
      amount: "900",
      sender: "9123456789",
      sourceApp: "sms",
      smsId: 1002, // distinct SMS ID from the carrier
    });
    expect(reminder.inserted).toBe(true);

    // Resyncing that same SMS ID does not duplicate
    const resync = saveRequest({
      text: ":txt Pay Rs 900 upi://pay?pa=bob@upi&cu=INR",
      link: "upi://pay?pa=bob@upi&cu=INR",
      payeeVpa: "bob@upi",
      amount: "900",
      sender: "9123456789",
      sourceApp: "sms",
      smsId: 1002,
    });
    expect(resync.inserted).toBe(false);
  });

  test("notification listener request links cleanly to SMS ID on subsequent inbox sync", () => {
    // Step 1: notification listener saves with no sms_id
    const notif = saveRequest({
      text: ":txt Pay Rs 350 upi://pay?pa=charlie@upi&cu=INR",
      link: "upi://pay?pa=charlie@upi&cu=INR",
      payeeVpa: "charlie@upi",
      amount: "350",
      sender: "9555555555",
      sourceApp: "com.google.android.apps.messaging",
    });
    expect(notif.inserted).toBe(true);

    // Step 2: inbox sync runs moments later with smsId 2001
    const sync = saveRequest({
      text: ":txt Pay Rs 350 upi://pay?pa=charlie@upi&cu=INR",
      link: "upi://pay?pa=charlie@upi&cu=INR",
      payeeVpa: "charlie@upi",
      amount: "350",
      sender: "9555555555",
      sourceApp: "sms",
      smsId: 2001,
    });
    expect(sync.inserted).toBe(false);
    expect(sync.id).toBe(notif.id);
  });
});
