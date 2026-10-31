import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { fonts, radius, radiusLg, radiusSm, space, type } from "../lib/theme";
import PixelIcon from "../components/PixelIcon";

// Requested palette: #0593C6, #FCFFFF, #D83995 on #02070A
const siteColors = {
  bg: "#02070A",
  panel: "#07131D",
  panelAlt: "#0A1B28",
  line: "#0E2638",
  lineBright: "#163C57",
  text: "#FCFFFF",
  muted: "#7D98AB",
  cyan: "#0593C6",
  cyanHover: "#0480AC",
  cyanInk: "#02070A",
  coral: "#D83995",
  coralHover: "#BE2E82",
  coralInk: "#02070A",
  danger: "#FF5C5C",
};

// GitHub repository details
const REPO_URL = "https://github.com/barryallen16/txt";
const RELEASES_URL = "https://github.com/barryallen16/txt/releases/latest";
const APK_DOWNLOAD_URL = "https://github.com/barryallen16/txt/releases/latest/download/txt.apk";

// The official txt logo in SVG format
function TxtLogo({ size = 38, color = siteColors.text }) {
  return (
    <svg width={size} height={size * (262 / 342)} viewBox="0 0 342 262" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20.5116 80.1086H0.000571728V39.8606H20.5116V-0.000394821H81.6576V39.8606H108.361V80.1086H81.6576V200.853C81.6576 214.011 82.0446 220.977 96.3636 220.977H108.361V261.225H58.4376C27.8646 261.225 20.5116 244.197 20.5116 215.172V80.1086ZM165.21 167.184L143.925 261.225H89.7453L126.897 145.899L92.0673 39.8606H155.148L174.111 125.388H174.885L193.848 39.8606H248.415L212.424 145.899L251.511 261.225H187.269L165.984 167.184H165.21ZM253.362 80.1086H232.851V39.8606H253.362V-0.000394821H314.508V39.8606H341.211V80.1086H314.508V200.853C314.508 214.011 314.895 220.977 329.214 220.977H341.211V261.225H291.288C260.715 261.225 253.362 244.197 253.362 215.172V80.1086Z"
        fill={color}
      />
    </svg>
  );
}

// 14 Curated Installation Steps from images/ and images/sidenotes.md
const GUIDE_STEPS = [
  {
    step: "01",
    phase: "play-protect",
    phaseLabel: "PLAY PROTECT",
    title: "App blocked by Play Protect",
    note: "Android flags the APK because it declares silent SMS permissions outside Google Play. This is a generic policy block for sideloaded SMS utilities, not malware.",
    action: "You must temporarily pause Play Protect to proceed with installation.",
    image: "/images/guide/1.jpeg",
  },
  {
    step: "02",
    phase: "play-protect",
    phaseLabel: "PLAY PROTECT",
    title: "Open Google Play Store",
    note: "Exit the package installer and open the official Google Play Store app on your phone.",
    action: "Launch Google Play Store.",
    image: "/images/guide/2.jpeg",
  },
  {
    step: "03",
    phase: "play-protect",
    phaseLabel: "PLAY PROTECT",
    title: "Open Play Protect menu",
    note: "Tap your Google account profile icon located in the top-right corner of the Play Store.",
    action: "Select 'Play Protect' from the profile menu.",
    image: "/images/guide/3.jpeg",
  },
  {
    step: "04",
    phase: "play-protect",
    phaseLabel: "PLAY PROTECT",
    title: "Open Play Protect Settings",
    note: "On the Play Protect screen, find the gear icon in the top-right corner.",
    action: "Tap the gear icon to open Play Protect settings.",
    image: "/images/guide/4.jpeg",
  },
  {
    step: "05",
    phase: "play-protect",
    phaseLabel: "PLAY PROTECT",
    title: "Toggle off 'Scan apps with Play Protect'",
    note: "You will see 'Scan apps with Play Protect' enabled by default.",
    action: "Toggle the switch OFF.",
    image: "/images/guide/5.jpeg",
  },
  {
    step: "06",
    phase: "play-protect",
    phaseLabel: "PLAY PROTECT",
    title: "Confirm Pause",
    note: "A confirmation prompt appears warning that unverified apps may not be scanned.",
    action: "Tap 'Pause' (or 'Turn off') to confirm.",
    image: "/images/guide/6.jpeg",
  },
  {
    step: "07",
    phase: "play-protect",
    phaseLabel: "PLAY PROTECT",
    title: "Install APK unblocked",
    note: "Return to your browser or Files app and tap the downloaded txt.apk file again.",
    action: "The package installer prompt opens normally. Tap 'Install'.",
    image: "/images/guide/7.jpeg",
  },
  {
    step: "08",
    phase: "install",
    phaseLabel: "INITIAL LAUNCH",
    title: "Open txt and start onboarding",
    note: "Installation completes in a few seconds.",
    action: "Tap 'Open' to launch txt.",
    image: "/images/guide/8.jpeg",
  },
  {
    step: "09",
    phase: "restricted",
    phaseLabel: "RESTRICTED SETTINGS",
    title: "Allow 'Read incoming SMS'",
    note: "txt opens the setup permissions screen. The first crucial permission is 'Read incoming SMS' (Notification Listener), which allows reassembling multipart chunks in the background.",
    action: "Tap 'Open settings' next to 'Read incoming SMS'.",
    image: "/images/guide/9.jpeg",
  },
  {
    step: "10",
    phase: "restricted",
    phaseLabel: "RESTRICTED SETTINGS",
    title: "Select txt in Device Notifications",
    note: "Android opens the system 'Device & app notifications' (or 'Notification read, reply and control') list.",
    action: "Scroll to find 'txt' and tap it.",
    image: "/images/guide/10.jpeg",
  },
  {
    step: "11",
    phase: "restricted",
    phaseLabel: "RESTRICTED SETTINGS",
    title: "Restricted Setting Warning Dialog",
    note: "Android 13+ displays a security dialog: 'Restricted setting: For your security, this setting is currently unavailable.' This is an Android safeguard preventing sideloaded apps from reading notifications.",
    action: "Tap 'OK'. We will now unlock it in App Info.",
    image: "/images/guide/11.jpeg",
  },
  {
    step: "12-1",
    phase: "restricted",
    phaseLabel: "RESTRICTED SETTINGS",
    title: "Allow Restricted Settings in App Info",
    note: "Open phone Settings > Apps > txt (or long-press the txt icon on your home screen and tap 'App info'). Tap the 3 dots in the top-right corner, then tap 'Allow restricted settings'. Authenticate with your fingerprint or PIN.",
    action: "Tap the 3 dots > 'Allow restricted settings' > Authenticate.",
    image: "/images/guide/12-1.jpeg",
  },
  {
    step: "12-2",
    phase: "restricted",
    phaseLabel: "RESTRICTED SETTINGS",
    title: "Enable Notification Access",
    note: "Return to Settings > Device & app notifications > txt. The toggle is now active and unlocked.",
    action: "Switch the toggle ON.",
    image: "/images/guide/12-2.jpeg",
    extraImages: [
      "/images/guide/12-3.jpeg",
      "/images/guide/12-4.jpeg",
    ],
  },
  {
    step: "13",
    phase: "permissions",
    phaseLabel: "PERMISSIONS",
    title: "Allow remaining permissions",
    note: "Return to the txt app. Grant the standard runtime permissions: Send & read messages, Alerts, Contacts, Camera, and Location.",
    action: "Tap each permission row and tap 'Allow'.",
    image: "/images/guide/13.jpeg",
  },
  {
    step: "14",
    phase: "ready",
    phaseLabel: "READY",
    title: "Setup complete — ready for off-grid use",
    note: "All setup is complete! You can now scan UPI QR codes, transfer compressed photos, send tickets, and share GPS coordinates with zero data.",
    action: "Tap 'Start using txt' and you are ready.",
    image: "/images/guide/14.jpeg",
  },
];

const FEATURES = [
  {
    icon: "rupee",
    title: "UPI PAYMENTS OVER SMS",
    detail:
      "Scan any UPI QR code or enter a VPA with an amount. txt formats a standardized intent payload and transmits it as an SMS. The receiver taps the link and pays through Google Pay, PhonePe, or Paytm with zero sender internet.",
  },
  {
    icon: "image",
    title: "POSTERIZED PHOTO TRANSFER",
    detail:
      "Compresses pictures into custom grayscale posterized JPEGs (1.2 KB Fast, 1.8 KB Balanced, 2.8 KB High). Automatically split into sequential GSM-7 SMS chunks with CRC32 integrity hashes and reconstructed on the receiving phone.",
  },
  {
    icon: "qr",
    title: "OFFLINE QR RECONSTRUCTION",
    detail:
      "Transmit metro tickets, boarding passes, event badges, and URL payloads over SMS. The receiving phone decodes the chunks and re-renders the exact scannable 2D QR code on its screen.",
  },
  {
    icon: "location",
    title: "GPS BREADCRUMB PINGS",
    detail:
      "Send a single precise coordinate lock or initiate periodic breadcrumb SMS updates. Ideal for emergency check-ins, highway travel, and remote trekking where cellular data coverage is nonexistent.",
  },
  {
    icon: "shield",
    title: "100 SMS/DAY SAFETY GUARD",
    detail:
      "Most Indian mobile recharge plans (Jio, Airtel, Vi) include daily SMS quotas that typically go unused. txt taps into your existing SIM allowance so transfers require zero internet data. To prevent surprise carrier overages, the app automatically tracks outgoing segments and stops sends at 100 SMS/day (TRAI's daily per-SIM limit).",
  },
];

export default function LandingScreen() {
  const [activePhase, setActivePhase] = useState("all");
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [apkUrl, setApkUrl] = useState(APK_DOWNLOAD_URL);
  const [apkVersion, setApkVersion] = useState("v1.0.3");

  useEffect(() => {
    fetch("https://api.github.com/repos/barryallen16/txt/releases/latest")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (data.tag_name) setApkVersion(data.tag_name);
          const apk = data.assets?.find((a) => a.name && a.name.toLowerCase().endsWith(".apk"));
          if (apk?.browser_download_url) {
            setApkUrl(apk.browser_download_url);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Handle deep link anchors (e.g. #guide, #guide-restricted, #architecture)
  useEffect(() => {
    const handleHash = () => {
      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash;
        if (hash === "#guide-restricted") {
          setActivePhase("restricted");
        }
        setTimeout(() => {
          const el = document.querySelector(hash);
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 200);
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const filteredSteps = useMemo(() => {
    if (activePhase === "all") return GUIDE_STEPS;
    if (activePhase === "play-protect") {
      return GUIDE_STEPS.filter((s) => s.phase === "play-protect");
    }
    if (activePhase === "restricted") {
      return GUIDE_STEPS.filter((s) => s.phase === "restricted" || s.step === "09");
    }
    if (activePhase === "permissions") {
      return GUIDE_STEPS.filter((s) => s.phase === "permissions" || s.phase === "ready");
    }
    return GUIDE_STEPS;
  }, [activePhase]);

  const scrollTo = (id) => {
    if (typeof document !== "undefined") {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <View style={styles.page}>
      <style>{`
        @font-face {
          font-family: 'GeistPixel';
          src: url('/assets/fonts/GeistPixel-Square.ttf') format('truetype');
          font-weight: 400;
          font-style: normal;
        }
        html {
          scroll-behavior: smooth;
        }
        .txt-pixel-btn,
        .txt-pixel-btn * {
          font-family: 'GeistPixel', monospace !important;
          font-weight: 400 !important;
          letter-spacing: 1px !important;
        }
        @media (max-width: 768px) {
          .txt-nav-links {
            display: none !important;
          }
          .txt-header-inner {
            justify-content: space-between !important;
          }
        }
        @media (min-width: 769px) {
          .txt-mobile-nav {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Navigation */}
      <header style={rawStyles.header}>
        <div className="txt-header-inner" style={rawStyles.headerInner}>
          <div style={rawStyles.logoGroup}>
            <TxtLogo size={36} />
            <span style={rawStyles.brandBadge}>Offline SMS</span>
          </div>

          <nav className="txt-nav-links" style={rawStyles.navLinks}>
            <button onClick={() => scrollTo("demo")} style={rawStyles.navLink}>Demo</button>
            <button onClick={() => scrollTo("features")} style={rawStyles.navLink}>Features</button>
            <button onClick={() => scrollTo("architecture")} style={rawStyles.navLink}>Architecture</button>
            <button onClick={() => scrollTo("guide")} style={rawStyles.navLink}>Install guide</button>
            <button
              onClick={() => router.push("/web")}
              style={{ ...rawStyles.navLink, color: siteColors.cyan }}
            >
              WEB UTILITY →
            </button>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="txt-pixel-btn"
              style={rawStyles.starNavBtn}
            >
              <PixelIcon name="star" size={12} color={siteColors.cyan} />
              <span>Star on GitHub</span>
            </a>
          </nav>

          <a
            href={apkUrl}
            download
            className="txt-pixel-btn"
            style={rawStyles.downloadNavBtn}
          >
            Download APK
          </a>
        </div>
      </header>

      {/* Main Container */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* HERO SECTION */}
        <section style={rawStyles.hero}>

          <h1 style={rawStyles.heroTitle}>
            Send photos, QR codes, GPS, and UPI payments without internet.
          </h1>

          <p style={rawStyles.heroLead}>
            txt turns your phone into an off-grid transmission node. Data is compressed, split into
            standard 153-character GSM-7 SMS segments with CRC32 hashes, and reassembled on the other phone.
            Neither sender nor receiver needs mobile data or Wi-Fi.
          </p>

          <div style={rawStyles.heroActions}>
            <a
              href={apkUrl}
              download
              className="txt-pixel-btn"
              style={rawStyles.primaryCta}
            >
              <span style={rawStyles.primaryCtaText}>Download APK ({apkVersion})</span>
              <span style={rawStyles.primaryCtaSub}>Android 8.0+ · Sideload APK · Free & Open Source</span>
            </a>

            <button
              onClick={() => scrollTo("guide")}
              className="txt-pixel-btn"
              style={rawStyles.secondaryCta}
            >
              Install guide ↓
            </button>

            <button
              onClick={() => router.push("/web")}
              className="txt-pixel-btn"
              style={rawStyles.ghostCta}
            >
              Web companion (iOS) →
            </button>
          </div>

          {/* Quick Specifications Strip */}
          <div style={rawStyles.specGrid}>
            <div style={rawStyles.specCard}>
              <div style={rawStyles.specValue}>0 KB</div>
              <div style={rawStyles.specLabel}>Server footprint</div>
              <div style={rawStyles.specDesc}>No cloud database, AWS, Firebase, or external servers exist.</div>
            </div>

            <div style={rawStyles.specCard}>
              <div style={rawStyles.specValue}>100%</div>
              <div style={rawStyles.specLabel}>On-device SQLite</div>
              <div style={rawStyles.specDesc}>All transfers, requests, and contacts stay strictly on your phone.</div>
            </div>

            <div style={rawStyles.specCard}>
              <div style={rawStyles.specValue}>100/day</div>
              <div style={rawStyles.specLabel}>Built-in safety cap</div>
              <div style={rawStyles.specDesc}>Uses your SIM's existing SMS pack. Capped at 100/day to prevent carrier overages.</div>
            </div>

            <div style={rawStyles.specCard}>
              <div style={rawStyles.specValue}>MIT</div>
              <div style={rawStyles.specLabel}>Open source</div>
              <div style={rawStyles.specDesc}>Audit every line of Kotlin, React Native, and chunking logic on GitHub.</div>
            </div>
          </div>
        </section>

        {/* LIVE APP DEMO SHOWCASE */}
        <section id="demo" style={rawStyles.demoSection}>
          <div style={rawStyles.demoContainer}>
            <div style={rawStyles.demoPhoneWrapper}>
              <div style={rawStyles.demoPhoneFrame}>
                <video
                  src="/demo.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  style={rawStyles.demoVideo}
                />
              </div>
            </div>

            <div style={rawStyles.demoInfo}>
              <div style={rawStyles.sectionPre}>See txt in action</div>
              <h2 style={rawStyles.demoTitle}>Live transmission over plain SMS</h2>
              <p style={rawStyles.demoText}>
                Watch txt scan a UPI QR code, slice the payload into GSM-7 SMS chunks, and reassemble it on a receiving phone in airplane mode. No cellular data, no Wi-Fi, and no server in between.
              </p>
              <div style={rawStyles.demoTags}>
                <span style={rawStyles.demoTag}>
                  <PixelIcon name="check" size={13} color={siteColors.cyan} />
                  Zero data / Airplane mode
                </span>
                <span style={rawStyles.demoTag}>
                  <PixelIcon name="check" size={13} color={siteColors.cyan} />
                  GSM-7 SMS protocol
                </span>
                <span style={rawStyles.demoTag}>
                  <PixelIcon name="check" size={13} color={siteColors.cyan} />
                  On-device SQLite & reassembly
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ZERO-SERVER ARCHITECTURE & PRIVACY */}
        <section id="architecture" style={rawStyles.section}>
          <div style={rawStyles.sectionHeader}>
            <div style={rawStyles.sectionPre}>Security & privacy guarantee</div>
            <h2 style={rawStyles.sectionTitle}>Zero Servers. Zero Telemetry. 100% Standalone.</h2>
            <p style={rawStyles.sectionSubtitle}>
              Traditional chat apps route every keystroke through remote server farms.
              Here is how txt operates completely independently:
            </p>
          </div>

          <div style={rawStyles.archGrid}>
            <div style={rawStyles.archCard}>
              <div style={rawStyles.archBadge}>No remote backend</div>
              <h3 style={rawStyles.archHeading}>There is no server running anywhere</h3>
              <p style={rawStyles.archText}>
                txt does not have an API backend. There is no Node.js process, Python backend, Supabase cluster,
                or AWS Lambda. The application runs strictly as client code on your Android device using the cellular
                hardware radio directly.
              </p>
            </div>

            <div style={rawStyles.archCard}>
              <div style={rawStyles.archBadge}>Zero telemetry</div>
              <h3 style={rawStyles.archHeading}>We collect zero data of any sort</h3>
              <p style={rawStyles.archText}>
                No analytics SDKs. No Facebook SDK. No Google Analytics. No Sentry crash reporting. No telemetry.
                Your phone number, contacts, location, and transferred files never touch any third party.
              </p>
            </div>

            <div style={rawStyles.archCard}>
              <div style={rawStyles.archBadge}>Direct carrier radio</div>
              <h3 style={rawStyles.archHeading}>Direct phone-to-phone carrier SMS</h3>
              <p style={rawStyles.archText}>
                Every transmission uses standard carrier telecom infrastructure. It works even during internet
                blackouts, government data shutdowns, high altitude hiking, or with zero-data prepaid SIM packs.
              </p>
            </div>

            <div style={rawStyles.archCard}>
              <div style={rawStyles.archBadge}>No financial access</div>
              <h3 style={rawStyles.archHeading}>Never touches banking credentials</h3>
              <p style={rawStyles.archText}>
                Payment requests are encoded as official NPCI UPI intent strings. txt never requests your UPI PIN,
                bank password, or account balance. Authentication happens strictly within your official banking app.
              </p>
            </div>
          </div>
        </section>

        {/* CORE PROTOCOL FEATURES */}
        <section id="features" style={rawStyles.section}>
          <div style={rawStyles.sectionHeader}>
            <div style={rawStyles.sectionPre}>Capabilities</div>
            <h2 style={rawStyles.sectionTitle}>Engineered for zero-connectivity environments</h2>
          </div>

          <div style={rawStyles.featureGrid}>
            {FEATURES.map((item, idx) => (
              <div key={idx} style={rawStyles.featureCard}>
                <div style={rawStyles.featureTop}>
                  <PixelIcon name={item.icon} size={22} color={siteColors.cyan} />
                  <span style={rawStyles.featureTitle}>{item.title}</span>
                </div>
                <p style={rawStyles.featureDetail}>{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* INSTALLATION & SECURITY SETUP GUIDE */}
        <section id="guide" style={rawStyles.section}>
          <div style={rawStyles.sectionHeader}>
            <div style={rawStyles.sectionPre}>Installation manual</div>
            <h2 style={rawStyles.sectionTitle}>Step-by-step installation & permission setup</h2>
            <p style={rawStyles.sectionSubtitle}>
              Because txt communicates directly with cellular SMS hardware and reassembles incoming chunks in the
              background, Android and Google Play Protect require manual confirmation. Follow these 14 curated steps.
            </p>
          </div>

          {/* Sideloading Explainer Callouts */}
          <div style={rawStyles.explainerGrid}>
            <div style={rawStyles.explainerBox}>
              <div style={rawStyles.explainerBadge}>Why pause Play Protect? (Steps 1–7)</div>
              <p style={rawStyles.explainerText}>
                Google Play Protect automatically blocks sideloaded APKs requesting <code style={rawStyles.inlineCode}>SEND_SMS</code> and
                background listener permissions that have not gone through Google's commercial Play Store signing pipeline.
                Play Protect displays a generic warning: <em>"Play Protect doesn't recognise this app's developer"</em>.
                Temporarily pausing Play Protect lets Android's package manager install the APK.
              </p>
            </div>

            <div id="guide-restricted" style={{ ...rawStyles.explainerBox, borderColor: siteColors.cyan }}>
              <div style={{ ...rawStyles.explainerBadge, color: siteColors.cyan }}>Why allow Restricted Settings? (Steps 9–12)</div>
              <p style={rawStyles.explainerText}>
                Android 13 introduced "Restricted Settings" to block sideloaded apps from turning on Notification
                Listener access. Android shows: <em>"Restricted setting: For your security, this setting is currently unavailable."</em>
                txt requires this permission to reassemble incoming chunked SMS parts (photos, codes, payments) while the app
                is closed. Unlocking it in <strong>App Info &gt; 3 dots &gt; Allow restricted settings</strong> enables full functionality.
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div style={rawStyles.tabRow}>
            <button
              onClick={() => setActivePhase("all")}
              style={activePhase === "all" ? rawStyles.tabActive : rawStyles.tab}
            >
              All 14 steps
            </button>
            <button
              onClick={() => setActivePhase("play-protect")}
              style={activePhase === "play-protect" ? rawStyles.tabActive : rawStyles.tab}
            >
              1. Pause Play Protect (1–7)
            </button>
            <button
              onClick={() => setActivePhase("restricted")}
              style={activePhase === "restricted" ? rawStyles.tabActive : rawStyles.tab}
            >
              2. Restricted settings (9–12)
            </button>
            <button
              onClick={() => setActivePhase("permissions")}
              style={activePhase === "permissions" ? rawStyles.tabActive : rawStyles.tab}
            >
              3. Permissions & ready (13–14)
            </button>
          </div>

          {/* Steps List */}
          <div style={rawStyles.stepsContainer}>
            {filteredSteps.map((step, idx) => (
              <div key={idx} style={rawStyles.stepCard}>
                <div style={rawStyles.stepHeader}>
                  <div style={rawStyles.stepNumber}>{step.step}</div>
                  <div style={rawStyles.stepMeta}>
                    <div style={rawStyles.stepPhaseBadge}>{step.phaseLabel}</div>
                    <h3 style={rawStyles.stepTitle}>{step.title}</h3>
                  </div>
                </div>

                <div style={rawStyles.stepBody}>
                  <p style={rawStyles.stepNote}>{step.note}</p>
                  <div style={rawStyles.stepActionBox}>
                    <span style={rawStyles.stepActionLabel}>ACTION:</span> {step.action}
                  </div>
                </div>

                {/* Screenshot preview */}
                <div style={rawStyles.stepImageWrapper}>
                  <img
                    src={step.image}
                    alt={step.title}
                    style={rawStyles.stepImage}
                    onClick={() => setLightboxIndex(step.image)}
                    loading="lazy"
                  />
                  {step.extraImages && step.extraImages.length > 0 && (
                    <div style={rawStyles.extraImagesRow}>
                      {step.extraImages.map((extra, eIdx) => (
                        <img
                          key={eIdx}
                          src={extra}
                          alt={`${step.title} step ${eIdx + 2}`}
                          style={rawStyles.stepImageMini}
                          onClick={() => setLightboxIndex(extra)}
                          loading="lazy"
                        />
                      ))}
                    </div>
                  )}
                  <div style={rawStyles.stepImageHint}>Click screenshot to zoom</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* LIGHTBOX MODAL (PORTALED TO BODY TO FIX HERO POSITIONING) */}
        {typeof document !== "undefined" && lightboxIndex
          ? createPortal(
              <div
                style={rawStyles.lightboxOverlay}
                onClick={() => setLightboxIndex(null)}
              >
                <div
                  style={rawStyles.lightboxModal}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    style={rawStyles.lightboxClose}
                    className="txt-pixel-btn"
                    onClick={() => setLightboxIndex(null)}
                  >
                    ✕ CLOSE
                  </button>
                  <img
                    src={lightboxIndex}
                    alt="Enlarged setup step"
                    style={rawStyles.lightboxImg}
                  />
                </div>
              </div>,
              document.body
            )
          : null}

        {/* TECHNICAL FAQ */}
        <section style={rawStyles.section}>
          <div style={rawStyles.sectionHeader}>
            <div style={rawStyles.sectionPre}>Common questions</div>
            <h2 style={rawStyles.sectionTitle}>Frequently Asked Questions</h2>
          </div>

          <div style={rawStyles.faqGrid}>
            <div style={rawStyles.faqItem}>
              <h3 style={rawStyles.faqQ}>Can I turn Play Protect back on after installing?</h3>
              <p style={rawStyles.faqA}>
                Yes. Once txt is installed and initial permissions are granted, you can safely re-enable Play Protect
                scanning in the Play Store settings.
              </p>
            </div>

            <div style={rawStyles.faqItem}>
              <h3 style={rawStyles.faqQ}>Does txt provide free SMS, or how am I charged?</h3>
              <p style={rawStyles.faqA}>
                txt does not provide free SMS—it uses your phone's cellular SIM card. If your mobile recharge includes bundled daily SMS (common on standard Jio, Airtel, and Vi unlimited plans), transfers use your existing allowance at no extra cost. If your recharge plan charges per SMS, standard carrier SMS rates apply. txt enforces a strict 100 SMS/day ceiling to protect you from unexpected bill shocks.
              </p>
            </div>

            <div style={rawStyles.faqItem}>
              <h3 style={rawStyles.faqQ}>How are payments handled without internet?</h3>
              <p style={rawStyles.faqA}>
                txt formats an NPCI-compliant UPI payment intent link containing payee details and requested amount into an SMS.
                The recipient taps the SMS link to open their installed UPI app (GPay, PhonePe, Paytm). The payer's UPI app uses
                its own cellular connection to process the bank payment.
              </p>
            </div>

            <div style={rawStyles.faqItem}>
              <h3 style={rawStyles.faqQ}>What if the other person doesn't have an Android phone?</h3>
              <p style={rawStyles.faqA}>
                For payments, the recipient does not need the app; they can open the SMS link directly or use our
                lightweight Web Companion tool at <code style={rawStyles.inlineCode}>/web</code> on iOS or desktop.
                For reassembling chunked pictures and QR codes, both phones must have the txt app installed.
              </p>
            </div>
          </div>
        </section>

        {/* BOTTOM DOWNLOAD CTA BANNER */}
        <section style={rawStyles.bottomCtaSection}>
          <div style={rawStyles.bottomCtaBox}>
            <TxtLogo size={44} />
            <h2 style={rawStyles.bottomCtaTitle}>Ready to communicate off the grid?</h2>
            <p style={rawStyles.bottomCtaLead}>
              Download the latest APK release directly to your Android device. Always free, zero telemetry, zero servers.
            </p>

            <div style={rawStyles.bottomCtaButtons}>
              <a
                href={apkUrl}
                download
                className="txt-pixel-btn"
                style={rawStyles.primaryCta}
              >
                <span style={rawStyles.primaryCtaText}>Download APK ({apkVersion})</span>
                <span style={rawStyles.primaryCtaSub}>Direct APK Download · Zero Trackers</span>
              </a>

              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noreferrer"
                className="txt-pixel-btn"
                style={rawStyles.secondaryCta}
              >
                View GitHub releases
              </a>
            </div>

            <div style={rawStyles.bottomMeta}>
              <span>Latest Release APK Target: <code style={rawStyles.inlineCode}>txt.apk</code></span>
              <span>·</span>
              <span>Repo: <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ color: siteColors.cyan }}>barryallen16/txt</a></span>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={rawStyles.footer}>
          <div style={rawStyles.footerInner}>
            <div style={rawStyles.footerLeft}>
              <TxtLogo size={24} />
              <span style={rawStyles.footerBrand}>Offline SMS Protocol</span>
            </div>

            <div style={rawStyles.footerLinks}>
              <button onClick={() => scrollTo("guide")} style={rawStyles.footerLink}>
                Installation Guide
              </button>
              <button onClick={() => router.push("/web")} style={rawStyles.footerLink}>
                Web Companion
              </button>
              <a href={REPO_URL} target="_blank" rel="noreferrer" style={rawStyles.footerLink}>
                Source Code (GitHub)
              </a>
              <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" style={rawStyles.footerLink}>
                Issues
              </a>
            </div>

            <div style={rawStyles.footerCopy}>
              MIT License · No tracking, no servers, standalone offline utility.
            </div>
          </div>
        </footer>
      </ScrollView>
    </View>
  );
}

// React Native Container Styles
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: siteColors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 64,
  },
});

// Clean CSS / Raw Styles following Geist Pixel & Saira tokens
const rawStyles = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    backgroundColor: "rgba(2, 7, 10, 0.94)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: `1px solid ${siteColors.line}`,
    padding: "12px 20px",
  },
  headerInner: {
    maxWidth: "1140px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
  },
  logoGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  brandTitle: {
    fontFamily: fonts.pixel,
    fontSize: "18px",
    letterSpacing: "1px",
    color: siteColors.text,
  },
  brandBadge: {
    fontFamily: fonts.pixel,
    fontSize: "10px",
    letterSpacing: "1px",
    color: siteColors.cyan,
    backgroundColor: "rgba(2, 151, 222, 0.12)",
    border: `1px solid rgba(2, 151, 222, 0.35)`,
    padding: "2px 6px",
    borderRadius: "4px",
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },
  navLink: {
    background: "transparent",
    border: "none",
    color: siteColors.muted,
    fontFamily: fonts.pixel,
    fontSize: "12px",
    letterSpacing: "1px",
    cursor: "pointer",
    textDecoration: "none",
    padding: "6px 4px",
    transition: "color 0.15s ease",
  },
  starNavBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "rgba(252, 115, 77, 0.12)",
    border: `1px solid rgba(252, 115, 77, 0.35)`,
    color: siteColors.text,
    fontFamily: `${fonts.pixel}, monospace`,
    fontSize: "11px",
    letterSpacing: "1px",
    textDecoration: "none",
    padding: "6px 10px",
    borderRadius: `${radiusSm}px`,
    cursor: "pointer",
  },
  starHeroBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "rgba(252, 115, 77, 0.1)",
    border: `1px solid rgba(252, 115, 77, 0.35)`,
    color: siteColors.text,
    padding: "16px 20px",
    borderRadius: `${radius}px`,
    fontFamily: `${fonts.pixel}, monospace`,
    fontSize: "13px",
    letterSpacing: "1px",
    cursor: "pointer",
    textDecoration: "none",
  },
  downloadNavBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: siteColors.cyan,
    color: siteColors.cyanInk,
    fontFamily: `${fonts.pixel}, monospace`,
    fontSize: "12px",
    letterSpacing: "1px",
    fontWeight: "400",
    textDecoration: "none",
    padding: "8px 14px",
    borderRadius: `${radiusSm}px`,
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },

  // HERO
  hero: {
    maxWidth: "960px",
    margin: "0 auto",
    padding: "56px 20px 48px",
    textAlign: "center",
  },
  pillStatus: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: fonts.pixel,
    fontSize: "11px",
    letterSpacing: "1px",
    color: siteColors.muted,
    backgroundColor: siteColors.panel,
    border: `1px solid ${siteColors.line}`,
    padding: "6px 14px",
    borderRadius: "9999px",
    marginBottom: "24px",
  },
  pillDot: {
    color: siteColors.coral,
    fontSize: "10px",
  },
  heroTitle: {
    fontFamily: fonts.pixel,
    fontSize: "clamp(24px, 4.5vw, 42px)",
    lineHeight: "1.25",
    color: siteColors.text,
    letterSpacing: "1px",
    margin: "0 0 20px 0",
    fontWeight: "400",
  },
  heroLead: {
    fontFamily: fonts.regular,
    fontSize: "clamp(15px, 2vw, 17px)",
    lineHeight: "1.6",
    color: siteColors.muted,
    maxWidth: "760px",
    margin: "0 auto 36px",
  },
  heroActions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: "14px",
    marginBottom: "48px",
  },
  primaryCta: {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: siteColors.cyan,
    color: siteColors.cyanInk,
    padding: "14px 28px",
    borderRadius: `${radius}px`,
    textDecoration: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: `${fonts.pixel}, monospace`,
    fontWeight: "400",
    letterSpacing: "1px",
  },
  primaryCtaText: {
    fontFamily: `${fonts.pixel}, monospace`,
    fontSize: "14px",
    letterSpacing: "1px",
    fontWeight: "400",
    color: siteColors.cyanInk,
  },
  primaryCtaSub: {
    fontFamily: `${fonts.regular}, sans-serif`,
    fontSize: "11px",
    marginTop: "2px",
    color: siteColors.cyanInk,
    opacity: 0.85,
  },
  secondaryCta: {
    backgroundColor: siteColors.panel,
    color: siteColors.text,
    border: `1px solid ${siteColors.line}`,
    padding: "16px 24px",
    borderRadius: `${radius}px`,
    fontFamily: fonts.pixel,
    fontSize: "13px",
    letterSpacing: "1px",
    cursor: "pointer",
    textDecoration: "none",
  },
  ghostCta: {
    backgroundColor: "transparent",
    color: siteColors.cyan,
    border: `1px solid rgba(2, 151, 222, 0.45)`,
    padding: "16px 24px",
    borderRadius: `${radius}px`,
    fontFamily: fonts.pixel,
    fontSize: "13px",
    letterSpacing: "1px",
    cursor: "pointer",
  },

  // SPEC GRID
  specGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
    marginTop: "24px",
    textAlign: "left",
  },
  specCard: {
    backgroundColor: siteColors.panel,
    border: `1px solid ${siteColors.line}`,
    borderRadius: `${radius}px`,
    padding: "18px",
  },
  specValue: {
    fontFamily: fonts.pixel,
    fontSize: "20px",
    color: siteColors.cyan,
    letterSpacing: "1px",
    marginBottom: "4px",
  },
  specValueCoral: {
    fontFamily: fonts.pixel,
    fontSize: "20px",
    color: siteColors.coral,
    letterSpacing: "1px",
    marginBottom: "4px",
  },
  specLabel: {
    fontFamily: fonts.pixel,
    fontSize: "11px",
    letterSpacing: "1px",
    color: siteColors.text,
    marginBottom: "6px",
  },
  specDesc: {
    fontFamily: fonts.regular,
    fontSize: "12px",
    color: siteColors.muted,
    lineHeight: "1.4",
  },

  // LIVE DEMO SHOWCASE
  demoSection: {
    maxWidth: "1060px",
    margin: "12px auto 48px",
    padding: "0 20px",
  },
  demoContainer: {
    backgroundColor: siteColors.card,
    border: `1px solid ${siteColors.line}`,
    borderRadius: `${radiusLg}px`,
    padding: "40px 32px",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: "40px",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 12px 40px rgba(0, 0, 0, 0.45)",
  },
  demoPhoneWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
    flexShrink: 0,
  },
  demoPhoneFrame: {
    width: "260px",
    borderRadius: "28px",
    border: `2px solid ${siteColors.cyan}`,
    boxShadow: "0 16px 40px rgba(0, 0, 0, 0.75)",
    backgroundColor: "#02070A",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
  },
  demoVideo: {
    width: "100%",
    height: "auto",
    display: "block",
    aspectRatio: "480 / 1068",
    objectFit: "cover",
  },
  demoInfo: {
    flex: "1 1 320px",
    maxWidth: "480px",
  },
  demoTitle: {
    fontFamily: fonts.pixel,
    fontSize: "clamp(20px, 3.2vw, 30px)",
    color: siteColors.text,
    letterSpacing: "1px",
    lineHeight: "1.25",
    margin: "8px 0 16px",
  },
  demoText: {
    fontFamily: fonts.regular,
    fontSize: "15px",
    color: siteColors.muted,
    lineHeight: "1.6",
    margin: "0 0 22px",
  },
  demoTags: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  demoTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: fonts.pixel,
    fontSize: "11px",
    letterSpacing: "0.5px",
    color: siteColors.cyan,
    backgroundColor: "rgba(5, 147, 198, 0.1)",
    border: "1px solid rgba(5, 147, 198, 0.28)",
    padding: "8px 12px",
    borderRadius: `${radiusSm}px`,
    width: "fit-content",
  },

  // SECTIONS COMMON
  section: {
    maxWidth: "1060px",
    margin: "0 auto",
    padding: "48px 20px",
  },
  sectionHeader: {
    marginBottom: "32px",
  },
  sectionPre: {
    fontFamily: fonts.pixel,
    fontSize: "11px",
    letterSpacing: "1.5px",
    color: siteColors.cyan,
    marginBottom: "8px",
  },
  sectionTitle: {
    fontFamily: fonts.pixel,
    fontSize: "clamp(20px, 3vw, 28px)",
    color: siteColors.text,
    letterSpacing: "1px",
    fontWeight: "400",
    margin: "0 0 10px 0",
  },
  sectionSubtitle: {
    fontFamily: fonts.regular,
    fontSize: "15px",
    color: siteColors.muted,
    maxWidth: "720px",
    lineHeight: "1.5",
    margin: 0,
  },

  // ARCHITECTURE
  archGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  archCard: {
    backgroundColor: siteColors.panel,
    border: `1px solid ${siteColors.line}`,
    borderRadius: `${radius}px`,
    padding: "22px",
  },
  archBadge: {
    fontFamily: fonts.pixel,
    fontSize: "10px",
    letterSpacing: "1px",
    color: siteColors.cyan,
    marginBottom: "12px",
  },
  archHeading: {
    fontFamily: fonts.medium,
    fontSize: "16px",
    color: siteColors.text,
    margin: "0 0 8px 0",
  },
  archText: {
    fontFamily: fonts.regular,
    fontSize: "13px",
    color: siteColors.muted,
    lineHeight: "1.5",
    margin: 0,
  },

  // FEATURES
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },
  featureCard: {
    backgroundColor: siteColors.panel,
    border: `1px solid ${siteColors.line}`,
    borderRadius: `${radius}px`,
    padding: "20px",
  },
  featureTop: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
  },
  featureTitle: {
    fontFamily: fonts.pixel,
    fontSize: "13px",
    letterSpacing: "1px",
    color: siteColors.text,
  },
  featureDetail: {
    fontFamily: fonts.regular,
    fontSize: "13px",
    color: siteColors.muted,
    lineHeight: "1.5",
    margin: 0,
  },

  // GUIDE
  explainerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "16px",
    marginBottom: "28px",
  },
  explainerBox: {
    backgroundColor: "rgba(19, 20, 26, 0.8)",
    border: `1px solid ${siteColors.line}`,
    borderRadius: `${radius}px`,
    padding: "18px",
  },
  explainerBadge: {
    fontFamily: fonts.pixel,
    fontSize: "11px",
    letterSpacing: "1px",
    color: siteColors.coral,
    marginBottom: "8px",
  },
  explainerText: {
    fontFamily: fonts.regular,
    fontSize: "13px",
    color: siteColors.text,
    lineHeight: "1.55",
    margin: 0,
  },
  inlineCode: {
    fontFamily: "monospace",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "12px",
    color: siteColors.cyan,
  },

  // TABS
  tabRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "24px",
  },
  tab: {
    backgroundColor: siteColors.panel,
    border: `1px solid ${siteColors.line}`,
    color: siteColors.muted,
    fontFamily: fonts.pixel,
    fontSize: "11px",
    letterSpacing: "1px",
    padding: "8px 14px",
    borderRadius: `${radiusSm}px`,
    cursor: "pointer",
  },
  tabActive: {
    backgroundColor: siteColors.cyan,
    border: `1px solid ${siteColors.cyan}`,
    color: siteColors.cyanInk,
    fontFamily: fonts.pixel,
    fontSize: "11px",
    letterSpacing: "1px",
    fontWeight: "700",
    padding: "8px 14px",
    borderRadius: `${radiusSm}px`,
    cursor: "pointer",
  },

  // STEPS
  stepsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
    gap: "20px",
  },
  stepCard: {
    backgroundColor: siteColors.panel,
    border: `1px solid ${siteColors.line}`,
    borderRadius: `${radius}px`,
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  stepHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "12px",
  },
  stepNumber: {
    fontFamily: fonts.pixel,
    fontSize: "18px",
    color: siteColors.cyan,
    letterSpacing: "1px",
    backgroundColor: "rgba(2, 151, 222, 0.12)",
    border: `1px solid rgba(2, 151, 222, 0.3)`,
    padding: "4px 8px",
    borderRadius: `${radiusSm}px`,
  },
  stepMeta: {
    flex: 1,
  },
  stepPhaseBadge: {
    fontFamily: fonts.pixel,
    fontSize: "9px",
    letterSpacing: "1px",
    color: siteColors.muted,
    marginBottom: "2px",
  },
  stepTitle: {
    fontFamily: fonts.medium,
    fontSize: "15px",
    color: siteColors.text,
    margin: 0,
  },
  stepBody: {
    marginBottom: "14px",
  },
  stepNote: {
    fontFamily: fonts.regular,
    fontSize: "13px",
    color: siteColors.muted,
    lineHeight: "1.45",
    margin: "0 0 8px 0",
  },
  stepActionBox: {
    fontFamily: fonts.regular,
    fontSize: "12px",
    color: siteColors.text,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderLeft: `2px solid ${siteColors.coral}`,
    padding: "6px 10px",
    borderRadius: "0 4px 4px 0",
  },
  stepActionLabel: {
    fontFamily: fonts.pixel,
    fontSize: "10px",
    letterSpacing: "1px",
    color: siteColors.coral,
    marginRight: "4px",
  },
  stepImageWrapper: {
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: `${radiusSm}px`,
    padding: "10px",
    border: `1px solid ${siteColors.line}`,
  },
  stepImage: {
    width: "100%",
    maxHeight: "260px",
    objectFit: "contain",
    borderRadius: "4px",
    cursor: "zoom-in",
    transition: "transform 0.15s ease",
  },
  extraImagesRow: {
    display: "flex",
    gap: "6px",
    justifyContent: "center",
    marginTop: "8px",
  },
  stepImageMini: {
    width: "30%",
    maxHeight: "90px",
    objectFit: "contain",
    borderRadius: "4px",
    cursor: "zoom-in",
    border: `1px solid ${siteColors.line}`,
  },
  stepImageHint: {
    fontFamily: fonts.pixel,
    fontSize: "9px",
    letterSpacing: "1px",
    color: siteColors.muted,
    marginTop: "6px",
  },

  // LIGHTBOX
  lightboxOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.94)",
    zIndex: 999999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    boxSizing: "border-box",
  },
  lightboxModal: {
    position: "relative",
    maxWidth: "92vw",
    maxHeight: "92vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  lightboxClose: {
    alignSelf: "flex-end",
    backgroundColor: siteColors.panel,
    border: `1px solid ${siteColors.line}`,
    color: siteColors.text,
    fontFamily: fonts.pixel,
    fontSize: "12px",
    letterSpacing: "1px",
    padding: "6px 12px",
    borderRadius: `${radiusSm}px`,
    cursor: "pointer",
    marginBottom: "8px",
  },
  lightboxImg: {
    maxWidth: "100%",
    maxHeight: "82vh",
    objectFit: "contain",
    borderRadius: `${radius}px`,
    border: `1px solid ${siteColors.line}`,
  },

  // FAQ
  faqGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },
  faqItem: {
    backgroundColor: siteColors.panel,
    border: `1px solid ${siteColors.line}`,
    borderRadius: `${radius}px`,
    padding: "20px",
  },
  faqQ: {
    fontFamily: fonts.medium,
    fontSize: "15px",
    color: siteColors.text,
    margin: "0 0 8px 0",
  },
  faqA: {
    fontFamily: fonts.regular,
    fontSize: "13px",
    color: siteColors.muted,
    lineHeight: "1.5",
    margin: 0,
  },

  // BOTTOM CTA
  bottomCtaSection: {
    maxWidth: "960px",
    margin: "24px auto 0",
    padding: "0 20px",
  },
  bottomCtaBox: {
    backgroundColor: siteColors.panel,
    border: `1px solid ${siteColors.line}`,
    borderRadius: `${radiusLg}px`,
    padding: "48px 24px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
  },
  bottomCtaTitle: {
    fontFamily: fonts.pixel,
    fontSize: "clamp(20px, 3.5vw, 30px)",
    color: siteColors.text,
    letterSpacing: "1px",
    margin: 0,
    fontWeight: "400",
  },
  bottomCtaLead: {
    fontFamily: fonts.regular,
    fontSize: "15px",
    color: siteColors.muted,
    maxWidth: "600px",
    margin: 0,
    lineHeight: "1.5",
  },
  bottomCtaButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    justifyContent: "center",
    marginTop: "8px",
  },
  bottomMeta: {
    fontFamily: fonts.regular,
    fontSize: "12px",
    color: siteColors.muted,
    display: "flex",
    gap: "8px",
    marginTop: "8px",
    flexWrap: "wrap",
    justifyContent: "center",
  },

  // FOOTER
  footer: {
    borderTop: `1px solid ${siteColors.line}`,
    marginTop: "64px",
    padding: "36px 20px 24px",
    backgroundColor: siteColors.bg,
  },
  footerInner: {
    maxWidth: "1060px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    textAlign: "center",
  },
  footerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  footerBrand: {
    fontFamily: fonts.pixel,
    fontSize: "13px",
    letterSpacing: "1px",
    color: siteColors.text,
  },
  footerLinks: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "20px",
  },
  footerLink: {
    background: "transparent",
    border: "none",
    color: siteColors.muted,
    fontFamily: fonts.regular,
    fontSize: "13px",
    cursor: "pointer",
    textDecoration: "none",
  },
  footerCopy: {
    fontFamily: fonts.regular,
    fontSize: "12px",
    color: siteColors.muted,
    opacity: 0.7,
  },
};
