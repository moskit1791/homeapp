/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withNotificationExpenseImport(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const application = nextConfig.modResults.manifest.application?.[0]?.$;

    if (application) {
      application["android:allowBackup"] = "true";
      application["android:fullBackupContent"] =
        "@xml/notification_expense_backup_rules";
      application["android:dataExtractionRules"] =
        "@xml/notification_expense_data_extraction_rules";
    }

    return nextConfig;
  });
};
