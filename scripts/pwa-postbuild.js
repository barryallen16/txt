const fs = require("fs");
const path = require("path");

const distDir = path.resolve("dist");
const indexPath = path.join(distDir, "index.html");

const manifestLink =
  '  <link rel="manifest" href="/manifest.json" />\n';
const iosMeta = [
  '  <meta name="apple-mobile-web-app-capable" content="yes" />',
  '  <meta name="apple-mobile-web-app-status-bar-style" content="black" />',
  '  <meta name="apple-mobile-web-app-title" content="txt" />',
  '  <link rel="apple-touch-icon" href="/icons/icon-192.png" />',
  '  <link rel="apple-touch-icon-precomposed" href="/icons/icon-192.png" />',
].join("\n") + "\n";

const swRegister = [
  '  <script>',
  '    if ("serviceWorker" in navigator) {',
  '      window.addEventListener("load", () => {',
  '        navigator.serviceWorker.register("/sw.js").then(() => {',
  '          console.log("txt SW registered");',
  '        });',
  '      });',
  '    }',
  "  </script>",
].join("\n") + "\n";

let html = fs.readFileSync(indexPath, "utf8");

// Inject manifest + iOS meta tags before </head>
if (!html.includes('rel="manifest"')) {
  html = html.replace("</head>", manifestLink + iosMeta + "</head>");
}

// Inject service worker registration before </body>
if (!html.includes('navigator.serviceWorker.register')) {
  html = html.replace("</body>", swRegister + "</body>");
}

fs.writeFileSync(indexPath, html);
console.log("PWA meta tags injected into dist/index.html");
