### What's New in v1.0.3

* **Reliable Payment Request Arrival:** Eliminated silent drops of new payment requests from existing payees. Added unique SMS ID tracking (`sms_id`), database indexing, and distinct received timestamps.
* **Android ContentProvider Debounce:** Added 400ms debounce to native SMS arrival listeners to prevent race conditions during multi-part database commits.
* **Instant Foreground Sync:** App state transitions to active now immediately trigger an inbox sync so missed messages appear the moment the app opens.
* **Custom Domain (txt.runs-on.dev):** The web companion PWA is now hosted directly at `https://txt.runs-on.dev` with root routing, offline service worker, and verified HTTPS.
* **Safety Guard Copy & Refinement:** Clarified the 100 SMS/day built-in safety cap that protects users from overages against carrier SIM limits.
* **Showcase UI Polish:** Cleaned up mobile demo phone framing and updated repository descriptions.

### Installation

1. Download **`txt-1.0.3.apk`** (or **`txt.apk`**).
2. Open the APK on your Android phone (Android 8.0+).
3. If prompted by Play Protect or Restricted Settings, refer to the [Installation Guide](https://txt.runs-on.dev/#guide).
