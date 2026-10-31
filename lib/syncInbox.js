// Reads the SMS inbox for parts the notification path could not see. Android
// joins multipart SMS segments into one body, so one row can hold a whole
// transfer. Requests are read from here too: if notification access is off or
// the listener missed a message, the link still lands in Requests.

import { DeviceEventEmitter } from "react-native";
import {
  getMeta,
  inTransaction,
  isSmsSeen,
  markSmsSeen,
  pruneParts,
  saveRequest,
  setMeta,
} from "./db";
import {
  flushIngestNotifications,
  ingestSmsSync,
} from "./ingest";
import { normalizeSender } from "./sender";
import { hasReadPermission, readRecent } from "./sms";
import { isTransferText } from "./transfer";
import {
  extractRequestAmount,
  extractUpiLinks,
  hasRequestTrigger,
  normalizeAmount,
  parseUpiLink,
} from "./upi";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const MAX_LOOKBACK = 30 * DAY;
const OVERLAP = 15 * MINUTE;
const RECENT = 15 * MINUTE;

export const INBOX_SYNCED_EVENT = "offtxt:inbox-synced";

let running = null;
let queued = false;
let queuedForce = false;

/**
 * @param {{ lookbackMs?: number, limit?: number, force?: boolean }} [options]
 * @returns {Promise<number>} how many transfers were completed
 */
export async function syncInbox({
  lookbackMs,
  limit = 1000,
  force = false,
} = {}) {
  if (running) {
    queued = true;
    if (force) queuedForce = true;
    return running;
  }
  if (!hasReadPermission()) return 0;

  running = (async () => {
    try {
      const now = Date.now();
      const last = Number(getMeta("inbox_synced_at")) || 0;
      const fullScanDone = getMeta("inbox_full_scan") === "1";

      let since;
      if (lookbackMs != null) {
        since = now - lookbackMs;
      } else if (last && fullScanDone) {
        // Re-read a small overlap so a message that landed while the last sync
        // was running is not skipped.
        since = Math.max(now - MAX_LOOKBACK, last - OVERLAP);
      } else {
        // First run, or an upgrade from the shorter lookback: read the whole
        // window once so old requests are not lost.
        since = now - MAX_LOOKBACK;
      }

      // A manual refresh scans the full window so any missed, swiped or delayed
      // requests are recovered from the SMS inbox.
      if (force) since = Math.max(0, now - MAX_LOOKBACK);

      const rows = await readRecent(since, limit);
      const notifications = [];
      let completed = 0;
      let changed = false;
      let failed = false;

      // One transaction for the whole batch. Without it every part and every
      // seen marker is a separate fsync on the JavaScript thread.
      inTransaction(() => {
        // Oldest first, so parts land in order.
        for (const row of [...rows].reverse()) {
          if (!row || typeof row.body !== "string") continue;
          if (!force && isSmsSeen(row.id)) continue;

          const hasTransfer = isTransferText(row.body);
          const links = (hasRequestTrigger(row.body) || force || /upi:\/\/pay\?/i.test(row.body))
            ? extractUpiLinks(row.body)
            : [];

          if (!hasTransfer && links.length === 0) continue;

          try {
            if (hasTransfer) {
              const result = ingestSmsSync({
                body: row.body,
                address: row.address || null,
                receivedAt: row.date || now,
                notify: (row.date || 0) > now - RECENT,
                trusted: true,
              });
              notifications.push(...result.notifications);
              const pieces =
                Number(result.completed) > 0
                  ? Number(result.completed)
                  : result.status === "complete"
                    ? 1
                    : 0;
              completed += pieces;
              if (pieces > 0 || Number(result.savedParts) > 0) changed = true;
            }

            for (const link of links) {
              const parsed = parseUpiLink(link);
              if (!parsed.valid) continue;
              const effectiveAmount =
                normalizeAmount(parsed.am) || extractRequestAmount(row.body);
              const saved = saveRequest({
                text: row.body,
                link,
                payeeName: parsed.pn,
                payeeVpa: parsed.pa,
                amount: effectiveAmount,
                sender: normalizeSender(row.address || null),
                sourceApp: "sms",
                smsId: row.id,
                receivedAt: row.date || now,
              });
              if (!saved.inserted) continue;

              changed = true;
              // Only announce what just arrived, not a month of old messages
              // uncovered by the first scan.
              if ((row.date || 0) > now - RECENT) {
                notifications.push({
                  type: "request",
                  id: saved.id,
                  name: parsed.pn,
                  vpa: parsed.pa,
                  amount: effectiveAmount,
                });
              }
            }

            markSmsSeen(row.id);
          } catch {
            // Leave it unseen so the next sync tries again.
            failed = true;
          }
        }

        // Runs whether or not a transfer happened to complete this time.
        pruneParts();

        setMeta("inbox_synced_at", now);
        if (!fullScanDone && !failed) setMeta("inbox_full_scan", "1");
      });

      await flushIngestNotifications(notifications);
      if (changed || force) DeviceEventEmitter.emit(INBOX_SYNCED_EVENT);
      return completed;
    } catch {
      return 0;
    }
  })();

  // Reset only after the promise has been assigned above, even when the body
  // finishes without ever awaiting. If another sync was requested while this
  // one was running, execute it immediately so incoming messages are never missed.
  running = running.finally(() => {
    running = null;
    if (queued) {
      const nextForce = queuedForce;
      queued = false;
      queuedForce = false;
      syncInbox({ force: nextForce }).catch(() => {});
    }
  });

  return running;
}
