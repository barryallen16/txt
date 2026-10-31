# txt

Send pictures, QR codes, live location, and UPI payment requests over standard SMS.
Neither phone needs cellular data or Wi-Fi to transmit or receive items.
A UPI payment still completes through the payer's installed UPI app.

[Live Web Companion](https://txt.runs-on.dev) · [Releases & APKs](https://github.com/barryallen16/txt/releases) · [Report Issue](https://github.com/barryallen16/txt/issues)

## What it does

- **UPI Payments:** Scan a UPI QR code or enter a 10-digit mobile number or VPA directly, specify an optional amount, and send the request via SMS. The recipient taps the link or copies the payee VPA into any installed UPI app (GPay, PhonePe, Paytm, BHIM). Signed merchant links preserve their exact parameters and base64 signatures byte-for-byte.
- **Images:** Pick any photo. The app downscales, posterizes, and compresses it into a grayscale payload split across numbered SMS chunks. Fast targets ~1.2 KB, Balanced ~1.8 KB, and High detail ~2.8 KB. The receiving device reassembles the image automatically.
- **QR Codes:** Scan or paste tickets, boarding passes, or payment codes. The raw text travels over SMS, and the recipient reconstructs the original QR code on their screen.
- **Live Location:** Send a one-time coordinate pin, or broadcast live updates every 30 seconds, 1 minute, or 5 minutes over SMS.
- **100 SMS/Day Safety Guard:** Sends run on your cellular SIM carrier allowance. To protect against accidental overages and comply with TRAI per-SIM daily anti-spam limits in India, the app tracks outgoing volume and stops transmission at 100 SMS/day. The counter resets at local midnight.

Transfers use a custom chunked protocol with CRC32 checksums and automatic out-of-order reassembly. A native Android module manages background telephony SMS detection and direct sends.

## Quick start

```bash
# Install dependencies
bun install

# Start Metro bundler
bun start

# Run on Android (requires a development build for the native SMS module)
bun android

# Run test suite
bun test

# Type check
bun run typecheck
```

## Requirements

- Android phone (Android 8.0+) with an active SIM card
- Node.js 18+ and Bun 1.4+
- Expo SDK 54 / React Native 0.81

The app requests SMS, notification, camera, contacts, and location permissions as needed. Background notification listener access is enabled via Android Settings.

The native SMS module lives in `modules/off-txt-sms` and links via Expo autolinking. Because it interacts directly with Android telephony hardware, it requires a native development build (Expo Go is not supported).

## Architecture

```
app/                 # Expo Router screens
  share/             # Image, QR, location, and manual pay flows
  transfers/         # Incoming transfers inbox and detail view
  pay/               # UPI request creation and manual entry
  sms-payments.jsx   # Payment requests inbox & history tabs
  permissions.jsx    # Permissions setup and diagnostic checks
  index.web.jsx      # Web companion & documentation landing page
components/          # Reusable UI (buttons, headers, pixel icons)
lib/                 # Pure application logic and SQLite persistence
  transfer.js        # Chunked SMS protocol (GSM-7 framing, CRC32)
  image.js           # Adaptive grayscale posterized JPEG compression
  syncInbox.js       # SMS inbox reader and ContentProvider sync
  db.js              # On-device SQLite database
  upi.js             # NPCI UPI URL parser, validator, and builder
  upiLauncher.js     # Native Android package launch intent dispatcher
modules/off-txt-sms/ # Native Android telephony Kotlin module
```

## Implementation details

- **GSM-7 Protocol:** Each part is formatted as `ot1.<id>.<kind>.<seq>.<total>.<crc>.<chunk>`. Every field is base36, and each part fits inside a single 153-character GSM-7 segment.
- **Image Compression:** Dynamic grayscale conversion and posterization steps down through resolutions until the payload meets the target byte budget.
- **Deduplication & Reassembly:** Parts and requests are indexed in SQLite with unique SMS identifiers. Corrupted packets fail CRC32 verification and trigger missing chunk indicators.
- **Inbox Sync & Telephony Observer:** A native Android `ContentObserver` detects incoming SMS in under 100ms when the app is active. Background headless listeners process incoming transfer notifications while the app is closed.
- **Daily Cap:** Every outgoing dispatch checks `lib/quota.js`. Once 100 messages are sent within a 24-hour cycle, outgoing transfers pause until midnight.

## Web Companion & PWA

A progressive web app is hosted at [`https://txt.runs-on.dev`](https://txt.runs-on.dev). It provides a full showcase, sideloading installation guide, and an offline utility tool for iOS users or desktop browsers:

- Paste a received `:txt` SMS to extract payee information, render a scannable QR code, and open UPI payment apps.
- Compose manual `:txt` payment request messages to send through any phone's messaging client.
- Functions offline via a service worker cache.

To export and test the web build locally:

```bash
bun run web:pwa
```

## Testing

```bash
bun test          # 93 passing unit tests
bun run typecheck # TypeScript strict mode verification
```

## License

MIT License. Copyright (c) 2026 barryallen16.
