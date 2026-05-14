const { withAndroidManifest } = require("@expo/config-plugins");

const SERVICE =
  "com.lesimoes.androidnotificationlistener.RNAndroidNotificationListener";

// The listener library ships its own manifest, but some build setups strip it.
// Declaring the service in the app manifest keeps notification access alive
// after a prebuild or a dependency upgrade.
module.exports = function withNotificationListener(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    const services = application.service ?? [];
    if (services.some((entry) => entry?.$?.["android:name"] === SERVICE)) {
      return config;
    }

    application.service = [
      ...services,
      {
        $: {
          "android:name": SERVICE,
          "android:label": "@string/app_name",
          "android:permission":
            "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name":
                    "android.service.notification.NotificationListenerService",
                },
              },
            ],
          },
        ],
      },
    ];

    return config;
  });
};
