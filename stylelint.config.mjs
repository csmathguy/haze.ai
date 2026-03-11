export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "declaration-no-important": true,
    "declaration-property-value-disallowed-list": {
      "/^(?:background(?:-color)?|border(?:-color)?|box-shadow|color|fill|outline(?:-color)?|stroke)$/u": [
        "/#(?:[0-9a-fA-F]{3,8})\\b/",
        "/(?:rgb|hsl)a?\\(/i"
      ]
    },
    "max-nesting-depth": 2,
    "selector-max-compound-selectors": 4
  }
};
