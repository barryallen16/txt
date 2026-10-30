### What's New in v1.0.2

* **Real-Time SMS ContentObserver:** Added native Android telephony `ContentObserver` for sub-100ms instant detection of incoming SMS transfers and payment requests while the app is active.
* **Recover Swiped / Dismissed Requests:** Pull-to-refresh and manual reloads now force re-inspect recent inbox messages, recovering payment requests even if the status bar notification was swiped away or marked read immediately.
* **Smart UPI Detection:** Inbox sync now detects valid `upi://pay?` links on manual refresh even if the sender or keyboard omitted the `:txt` trigger prefix.
* **Permission Setup Clarity:** Clearer separation between Background Notification Reader and SMS Inbox access, with one-tap recovery cards when permissions are missing.
* **Asset Optimization:** Comprehensive compression of all walkthrough screenshots and application icons for faster page loads.
* **Web Companion & Landing Page:** Full design refresh with high-contrast palette, SVG favicon, and step-by-step sideloading installation guide.

### Installation

1. Download **`txt-1.0.2.apk`** (or **`txt.apk`**).
2. Open the APK on your Android phone (Android 8.0+).
3. If prompted by Play Protect or Restricted Settings, refer to the [Installation Guide](https://barryallen16.github.io/txt/#guide).
