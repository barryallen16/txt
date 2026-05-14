// A native probe can hang forever while Android is still attaching the
// activity. Every caller needs a value, not a promise that never settles.

/**
 * @template T
 * @param {Promise<T> | (() => Promise<T>)} work
 * @param {number} ms
 * @param {T} fallback
 * @returns {Promise<T>}
 */
export function withTimeout(work, ms = 1500, fallback = null) {
  let timer = null;

  const started = Promise.resolve()
    .then(() => (typeof work === "function" ? work() : work))
    .catch(() => fallback);

  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), Math.max(0, ms));
  });

  return Promise.race([started, timeout]).finally(() => {
    if (timer != null) clearTimeout(timer);
  });
}
