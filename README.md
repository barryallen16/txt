# txt

Send pictures, QR codes and live location over SMS.
It works offline, so neither phone needs a data plan.

## What it does

- Payments: scan a UPI QR code, enter an amount, and send the request by SMS.
  The recipient opens it in their UPI app.
  Amounts go into the link as UPI intent fields: `pa`, `pn`, `am`, `cu`, and `tr`/`tn` when present.
  A signed link that already carries an amount is kept byte for byte so its signature stays valid.
  Links that need an amount added follow the [NPCI UPI linking specification](https://www.labnol.org/files/linking.pdf) and are unsigned, so the payer's UPI app may ask them to verify the source.
- Images: pick a photo.
  The app compresses it to a grayscale, posterized JPEG of about 1.2 KB and sends it as a series of SMS parts.
  The other phone reassembles it.
- QR codes: scan or paste any QR code text.
  It goes over SMS, and the recipient rebuilds the same code: a metro ticket, a boarding pass or something else.
- Location: share your live location for a set interval.
  Each update arrives as an SMS.

Every transfer uses a custom chunked protocol with CRC32 checksums and automatic reassembly.
A native Android module handles silent `SEND_SMS` and inbox reading, so multipart messages arrive intact.

## Quick start

```bash
# Install dependencies
bun install

# Start development server
bun start

# Run on Android (requires native build for SMS module)
bun android

# Run tests
bun test

# Type check
bun run typecheck
```

## Requirements

- Android device with SMS permission (for sending/receiving)
- Expo SDK 54 / React Native 0.81
- Bun 1.4+

The native SMS module lives in `modules/off-txt-sms` and is linked via Expo autolinking.
It needs a development build, so Expo Go won't work.

## Architecture

```
app/                 # Expo Router screens
  share/             # Image, QR, location sending
  transfers/         # Received items inbox
  pay/               # UPI payment flow
components/          # Shared UI (buttons, icons, recipient picker)
lib/                 # Pure logic, no React dependencies
  base64.js          # URL-safe base64
  transfer.js        # Chunked SMS protocol (encode/decode/CRC32)
  geo.js             # Location encoding
  image.js           # Grayscale posterized JPEG compression
  ingest.js          # Reassemble incoming parts
  syncInbox.js       # Background inbox sync
  sms.js             # Native module wrapper
  db.js              # SQLite (payments + transfers)
modules/off-txt-sms/ # Native Android module (Kotlin)
```

## Implementation details

- SMS protocol: each part is `ot1.<id>.<kind>.<seq>.<total>.<crc>.<chunk>`.
  Every field is base36, and one part fits in a single GSM-7 segment (153 characters).
  The receiver reassembles the parts.
- Image compression: grayscale, posterization and resizing to about 1.2 KB, then the payload is split into parts.
- Background listener: a Headless JS task reads SMS notifications, stores the parts and triggers reassembly when the app opens.
- Fonts: Geist, loaded at runtime with expo-font.

## Testing

```bash
bun test          # all tests
bun run typecheck # TypeScript strict mode
```

## License

MIT
