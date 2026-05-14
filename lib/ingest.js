// Takes an SMS body, stitches the parts together and stores the result.
// Both the killed-app notification listener and the foreground inbox sync call
// this, so a transfer survives either path.

import * as Notifications from "expo-notifications";
import { encodeBase64 } from "./base64";
import {
  dropParts,
  listParts,
  pruneParts,
  savePart,
  saveTransfer,
} from "./db";
import { decodeLocation } from "./geo";
import { normalizeSender } from "./sender";
import { KIND, assemble, parseParts } from "./transfer";

export const TRANSFER_CHANNEL = "transfers";
export const REQUEST_CHANNEL = "payment-requests";

export async function ensureTransferChannel() {
  await Notifications.setNotificationChannelAsync(TRANSFER_CHANNEL, {
    name: "Shared items",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function ensureRequestChannel() {
  await Notifications.setNotificationChannelAsync(REQUEST_CHANNEL, {
    name: "Payment requests",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/**
 * Posts the local notification for a stored payment request. Safe to call from
 * both the killed-app listener and the foreground inbox sync.
 * @param {{ id: number | null, name?: string | null, vpa?: string | null, amount?: string | null }} request
 */
export async function notifyPaymentRequest({ id, name, vpa, amount }) {
  try {
    await ensureRequestChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Payment request",
        body: `${name || vpa || "Someone"} asked for ₹${amount ?? "any amount"}`,
        data: id == null ? {} : { requestId: id },
      },
      trigger: { channelId: REQUEST_CHANNEL },
    });
  } catch {
    // The request is saved even when the user denied notifications.
  }
}

function summary(kind, sender) {
  const who = sender || "Someone";
  if (kind === KIND.LOCATION) return `${who} shared a location`;
  if (kind === KIND.QR) return `${who} sent a QR code`;
  if (kind === KIND.IMAGE) return `${who} sent a picture`;
  return `${who} sent something`;
}

async function notify(kind, sender, id, transferKey) {
  try {
    await ensureTransferChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "txt",
        body: summary(kind, sender),
        data: { transferId: id, transferKey },
      },
      trigger: { channelId: TRANSFER_CHANNEL },
    });
  } catch {
    // Notifications can be denied; the item is in the inbox either way.
  }
}

function receiving(kind, sender) {
  const who = sender || "someone";
  if (kind === KIND.LOCATION) return `a location from ${who}`;
  if (kind === KIND.QR) return `a QR code from ${who}`;
  if (kind === KIND.IMAGE) return `a picture from ${who}`;
  return `something from ${who}`;
}

function progressIdentifier(transferKey) {
  return `transfer-${transferKey}`;
}

/**
 * One notification when the first part of a transfer lands, so the receiver
 * knows something is on the way instead of waiting in silence.
 */
async function notifyProgress({ transferKey, kind, sender, total }) {
  try {
    await ensureTransferChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: progressIdentifier(transferKey),
      content: {
        title: "txt",
        body: `Receiving ${receiving(kind, sender)} (1/${total} parts)...`,
        data: { transferKey },
      },
      trigger: { channelId: TRANSFER_CHANNEL },
    });
  } catch {
    // Without notification access the inbox still shows the progress card.
  }
}

/** The completed notification replaces the "receiving" one. */
async function dismissProgress(transferKey) {
  try {
    await Notifications.dismissNotificationAsync(progressIdentifier(transferKey));
  } catch {
    // Nothing to dismiss, or the platform does not support it.
  }
}

/**
 * Send the notifications collected inside a database transaction. Keeping this
 * outside the transaction stops Android notification work from holding a
 * SQLite write lock.
 * @param {Array<object>} events
 */
export async function flushIngestNotifications(events) {
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type === "dismiss") {
      await dismissProgress(event.transferKey);
    } else if (event?.type === "transfer") {
      await notify(event.kind, event.sender, event.id, event.transferKey);
    } else if (event?.type === "progress") {
      await notifyProgress(event);
    } else if (event?.type === "request") {
      await notifyPaymentRequest(event);
    }
  }
}

function finishTransfer(part, sender, receivedAt, shouldNotify) {
  const transferKey = part.id;
  const result = assemble(listParts(transferKey));

  if (result.error || !result.complete) {
    // A truncated notification copy can leave a bad checksum. Keep every part:
    // the trusted inbox copy usually arrives seconds later and repairs it.
    return null;
  }

  const kind = result.kind;
  let payload = null;
  let payloadB64 = null;
  let session = null;

  if (kind === KIND.IMAGE) {
    payloadB64 = encodeBase64(result.bytes);
  } else {
    payload = result.text;
    if (kind === KIND.LOCATION) {
      session = decodeLocation(payload)?.session ?? null;
    }
  }

  const stored = saveTransfer({
    transferKey,
    kind,
    sender,
    payload,
    payloadB64,
    session,
    receivedAt,
  });

  dropParts(transferKey);
  pruneParts();

  return {
    transferKey,
    transfer: stored,
    notifications: [
      { type: "dismiss", transferKey },
      ...(stored.inserted && shouldNotify
        ? [{ type: "transfer", kind, sender, id: stored.id, transferKey }]
        : []),
    ],
  };
}

/**
 * The synchronous half of ingestion. Callers that already hold a transaction
 * use this so a batch of inbox rows causes one fsync instead of dozens.
 * @param {{ body: string, address?: string | null, receivedAt?: number, notify?: boolean, trusted?: boolean }} sms
 */
export function ingestSmsSync({
  body,
  address = null,
  receivedAt = Date.now(),
  notify: shouldNotify = true,
  trusted = false,
}) {
  const parts = parseParts(body);
  if (parts.length === 0) {
    return { status: "ignored", completed: 0, notifications: [] };
  }

  const sender = normalizeSender(address);
  const done = new Set();
  const waiting = new Set();
  const notifications = [];
  const progress = new Map();
  let savedParts = 0;
  let first = null;

  for (const part of parts) {
    if (done.has(part.id)) continue;

    const saved = savePart({
      transferKey: part.id,
      seq: part.seq,
      chunk: part.chunk,
      kind: part.kind,
      total: part.total,
      crc: part.crc,
      sender,
      receivedAt,
      trusted,
    });
    if (saved.inserted) savedParts += 1;

    if (saved.inserted && saved.count === 1 && part.total > 1 && shouldNotify) {
      progress.set(part.id, {
        type: "progress",
        transferKey: part.id,
        kind: part.kind,
        sender,
        total: part.total,
      });
    }

    if (saved.count < part.total) {
      waiting.add(part.id);
      continue;
    }

    const stored = finishTransfer(part, sender, receivedAt, shouldNotify);
    waiting.delete(part.id);
    // A whole transfer inside one body must not leave a stale "receiving" note.
    progress.delete(part.id);

    if (!stored) continue;

    done.add(part.id);
    notifications.push(...stored.notifications);
    if (!first) first = stored;
  }

  notifications.push(...progress.values());

  if (done.size > 0) {
    return {
      status: "complete",
      id: first?.transferKey,
      transfer: first?.transfer,
      completed: done.size,
      savedParts,
      notifications,
    };
  }

  if (waiting.size > 0) {
    return {
      status: "partial",
      id: [...waiting][0],
      completed: 0,
      savedParts,
      notifications,
    };
  }

  return {
    status: "error",
    id: parts[0].id,
    completed: 0,
    savedParts,
    notifications,
  };
}

/**
 * @param {{ body: string, address?: string | null, receivedAt?: number, notify?: boolean, trusted?: boolean }} sms
 * @returns {Promise<{ status: "ignored" | "partial" | "complete" | "error", id?: string, transfer?: object, completed?: number }>}
 */
export async function ingestSms(input) {
  const { notifications, ...result } = ingestSmsSync(input);
  await flushIngestNotifications(notifications);
  return result;
}

let lastPruneAt = 0;

/**
 * Orphaned halves only get cleaned when a transfer completes inside
 * finishTransfer, which may never happen. Run this from the periodic sync path
 * too, throttled so it does not delete on every notification.
 */
export function maybePruneParts(intervalMs = 60 * 60 * 1000) {
  const now = Date.now();
  if (now - lastPruneAt < intervalMs) return;
  lastPruneAt = now;
  pruneParts();
}
