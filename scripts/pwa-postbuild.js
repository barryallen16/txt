const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const distDir = path.resolve("dist");

const themeMeta = [
  '  <meta name="theme-color" content="#0b0c10" />',
  '  <meta name="color-scheme" content="dark" />',
].join("\n") + "\n";

const manifestLink = '  <link rel="manifest" href="/txt/manifest.json" />\n';
const iosMeta = [
  '  <meta name="apple-mobile-web-app-capable" content="yes" />',
  '  <meta name="mobile-web-app-capable" content="yes" />',
  '  <meta name="apple-mobile-web-app-status-bar-style" content="black" />',
  '  <meta name="apple-mobile-web-app-title" content="txt" />',
  '  <link rel="apple-touch-icon" href="/txt/icons/icon-192.png" />',
  '  <link rel="apple-touch-icon-precomposed" href="/txt/icons/icon-192.png" />',
].join("\n") + "\n";

const swRegister = [
  '  <script>',
  '    if ("serviceWorker" in navigator) {',
  '      window.addEventListener("load", () => {',
  '        navigator.serviceWorker.register("/txt/sw.js", { scope: "/txt/" })',
  '          .then((reg) => {',
  '            console.log("txt SW registered with scope:", reg.scope);',
  '          })',
  '          .catch((err) => {',
  '            console.error("txt SW registration failed:", err);',
  '          });',
  '      });',
  '    }',
  '  </script>',
].join("\n") + "\n";

let html = fs.readFileSync(path.join(distDir, "index.html"), "utf8");

// Ensure the root document canvas matches the app's dark theme so that overscroll
// bounce, dynamic browser address bar resize, and safe areas never flash white.
html = html.replace(
  /html,\s*body\s*\{[^}]*\}/,
  'html,\n      body {\n        height: 100%;\n        background-color: #0b0c10;\n        color-scheme: dark;\n      }\n      body {\n        overflow-x: hidden;\n        overscroll-behavior-y: none;\n      }'
);
html = html.replace(
  /#root\s*\{[^}]*\}/,
  '#root {\n        display: flex;\n        height: 100%;\n        flex: 1;\n        background-color: #0b0c10;\n      }'
);

// Inject manifest + iOS meta tags before </head>.
if (!html.includes('rel="manifest"')) {
  html = html.replace("</head>", themeMeta + manifestLink + iosMeta + "</head>");
  html = html.replace("shrink-to-fit=no", "shrink-to-fit=no, viewport-fit=cover");
}

// Inject service worker registration before </body>.
if (!html.includes('serviceWorker.register')) {
  html = html.replace("</body>", swRegister + "</body>");
}

fs.writeFileSync(path.join(distDir, "index.html"), html);

// Stamp the service worker cache with a hash of the built shell.
const swPath = path.join(distDir, "sw.js");
if (fs.existsSync(swPath)) {
  const digest = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(distDir, "index.html")))
    .digest("hex")
    .slice(0, 12);
  fs.writeFileSync(swPath, fs.readFileSync(swPath, "utf8").replace("%CACHE_NAME%", digest));
}

// 404.html fallback: GitHub Pages serves it for unknown routes (e.g. /txt/pay/xyz).
fs.copyFileSync(
  path.join(distDir, "index.html"),
  path.join(distDir, "404.html")
);

// Create dist/web/index.html so /txt/web directly serves 200 OK on GitHub Pages without 404!
fs.mkdirSync(path.join(distDir, "web"), { recursive: true });
fs.copyFileSync(
  path.join(distDir, "index.html"),
  path.join(distDir, "web", "index.html")
);

// Ensure icons from public/icons are present in dist/icons
fs.mkdirSync(path.join(distDir, "icons"), { recursive: true });
for (const icon of ["icon-192.png", "icon-512.png", "icon-maskable-512.png"]) {
  const src = path.join("public", "icons", icon);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distDir, "icons", icon));
  }
}

// Ensure manifest.json and favicon are in dist
for (const file of ["manifest.json", "favicon.ico"]) {
  const src = path.join("public", file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distDir, file));
  }
}

// .nojekyll disables Jekyll processing on GitHub Pages (required for _expo folder).
fs.writeFileSync(path.join(distDir, ".nojekyll"), "");

console.log("PWA postbuild done: base /txt PWA shell + sw.js + 404.html + /web/index.html + .nojekyll");
