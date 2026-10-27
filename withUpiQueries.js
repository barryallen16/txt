const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withUpiQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.queries) {
      manifest.queries = [];
    }

    if (manifest.queries.length === 0) {
      manifest.queries.push({});
    }

    const queriesObj = manifest.queries[0];
    if (!queriesObj.intent) {
      queriesObj.intent = [];
    }

    const hasUpi = queriesObj.intent.some((entry) =>
      entry.data?.some((d) => d.$?.["android:scheme"] === "upi")
    );

    if (!hasUpi) {
      queriesObj.intent.push({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        data: [{ $: { "android:scheme": "upi" } }],
      });
    }

    return config;
  });
};
