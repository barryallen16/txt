const fs = require("fs");
const path = require("path");

const distDir = path.resolve("dist");

// Make root-relative URLs relative so they work from /txt/ subdirectory on GitHub Pages.
// e.g. "/_expo/static/js/..." → "./_expo/static/js/...", "/manifest.json" → "./manifest.json"
function relativizeUrls(html) {
  return html.replace(/(src|href)="\/(?!\/)([^"]*)"/g, (m, attr, url) => {
    return `${attr}="./${url}"`;
  });
}

// Inline script that strips the /txt GitHub Pages subdirectory prefix so Expo Router
// matches routes correctly. Runs before the Expo Router bundle loads, so it works on
// initial load AND survives refreshes.
// Only strips /txt when the path is actually under /txt/ (GitHub Pages subdirectory).
// When served at root (zrok, localhost), the path is used as-is.
const basenameScript = [
  '  <script>',
  '    (function () {',
  '      var base = "/txt";',
  '      var p = window.location.pathname;',
  '      if (p === base || p.indexOf(base + "/") === 0) {',
  '        var clean = p.slice(base.length) || "/";',
  '        window.history.replaceState(null, "", clean);',
  '      }',
  '    })();',
  "  </script>",
].join("\n") + "\n";

const manifestLink =
  '  <link rel="manifest" href="./manifest.json" />\n';
const iosMeta = [
  '  <meta name="apple-mobile-web-app-capable" content="yes" />',
  '  <meta name="mobile-web-app-capable" content="yes" />',
  '  <meta name="apple-mobile-web-app-status-bar-style" content="black" />',
  '  <meta name="apple-mobile-web-app-title" content="txt" />',
  '  <link rel="apple-touch-icon" href="./icons/icon-192.png" />',
  '  <link rel="apple-touch-icon-precomposed" href="./icons/icon-192.png" />',
].join("\n") + "\n";

const swRegister = [
  '  <script>',
  '    if ("serviceWorker" in navigator) {',
  '      window.addEventListener("load", () => {',
  '        navigator.serviceWorker.register("./sw.js").then(() => {',
  '          console.log("txt SW registered");',
  '        });',
  '      });',
  '    }',
  "  </script>",
].join("\n") + "\n";

let html = fs.readFileSync(path.join(distDir, "index.html"), "utf8");

// Relativize asset paths.
html = relativizeUrls(html);

// Inject manifest + iOS meta tags before </head>.
if (!html.includes('rel="manifest"')) {
  html = html.replace("</head>", manifestLink + iosMeta + "</head>");
}

// Inject basename script + service worker registration before </body>.
if (!html.includes('window.location.replace')) {
  html = html.replace("</body>", basenameScript + swRegister + "</body>");
}

fs.writeFileSync(path.join(distDir, "index.html"), html);

// 404.html fallback: GitHub Pages serves it for unknown routes (e.g. /txt/web).
// It is a full copy of index.html, so the basename script runs and Expo Router
// renders the correct route from the URL.
fs.copyFileSync(
  path.join(distDir, "index.html"),
  path.join(distDir, "404.html"),
);

// .nojekyll disables Jekyll processing on GitHub Pages.
fs.writeFileSync(path.join(distDir, ".nojekyll"), "");

console.log("PWA postbuild done: relativized assets + PWA tags + basename script + 404.html + .nojekyll");
