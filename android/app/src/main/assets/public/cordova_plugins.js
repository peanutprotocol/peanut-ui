
  cordova.define('cordova/plugin_list', function(require, exports, module) {
    module.exports = [
      {
          "id": "cordova-idensic-mobile-sdk-plugin.sumsub",
          "file": "plugins/cordova-idensic-mobile-sdk-plugin/dist/SNSMobileSDK.js",
          "pluginId": "cordova-idensic-mobile-sdk-plugin",
        "clobbers": [
          "SNSMobileSDK"
        ]
        }
    ];
    module.exports.metadata =
    // TOP OF METADATA
    {
      "cordova-idensic-mobile-sdk-plugin": "1.42.0"
    };
    // BOTTOM OF METADATA
    });
    