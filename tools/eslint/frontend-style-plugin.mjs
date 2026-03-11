const COLOR_LITERAL_PATTERN = /#(?:[\da-f]{3,8})\b|(?:rgb|hsl)a?\(/iu;

function getAttributeName(node) {
  return node.name?.type === "JSXIdentifier" ? node.name.name : null;
}

function isColorLiteral(value) {
  return typeof value === "string" && COLOR_LITERAL_PATTERN.test(value);
}

function iterSxObjectProperties(expression) {
  if (expression?.type !== "JSXExpressionContainer") {
    return [];
  }

  if (expression.expression.type !== "ObjectExpression") {
    return [];
  }

  return expression.expression.properties.filter((property) => property.type === "Property");
}

const noInlineStylesRule = {
  create(context) {
    return {
      JSXAttribute(node) {
        if (getAttributeName(node) !== "style") {
          return;
        }

        context.report({
          message: "Inline style props are not allowed. Use MUI theme tokens, styled(), or CSS Modules instead.",
          node
        });
      }
    };
  },
  meta: {
    docs: {
      description: "Disallow inline style props in React components."
    },
    messages: {},
    schema: [],
    type: "problem"
  }
};

const noHardcodedColorLiteralsRule = {
  create(context) {
    return {
      Literal(node) {
        if (!isColorLiteral(node.value)) {
          return;
        }

        context.report({
          message: "Hard-coded color literals are not allowed here. Route colors through the MUI theme or CSS variables.",
          node
        });
      },
      TemplateElement(node) {
        if (!isColorLiteral(node.value.raw)) {
          return;
        }

        context.report({
          message: "Hard-coded color literals are not allowed here. Route colors through the MUI theme or CSS variables.",
          node
        });
      }
    };
  },
  meta: {
    docs: {
      description: "Disallow raw color literals outside approved theme files."
    },
    messages: {},
    schema: [],
    type: "problem"
  }
};

const maxSxPropsRule = {
  create(context) {
    const [{ maxProperties = 6 } = {}] = context.options;

    return {
      JSXAttribute(node) {
        if (getAttributeName(node) !== "sx") {
          return;
        }

        const propertyCount = iterSxObjectProperties(node.value).length;

        if (propertyCount <= maxProperties) {
          return;
        }

        context.report({
          data: {
            actual: propertyCount.toString(),
            max: maxProperties.toString()
          },
          message: "Large `sx` objects drift into hidden stylesheets. Limit `sx` to {{max}} top-level properties, found {{actual}}.",
          node
        });
      }
    };
  },
  meta: {
    docs: {
      description: "Limit top-level sx object size so reusable styling gets extracted."
    },
    messages: {},
    schema: [
      {
        additionalProperties: false,
        properties: {
          maxProperties: {
            minimum: 1,
            type: "integer"
          }
        },
        type: "object"
      }
    ],
    type: "suggestion"
  }
};

export default {
  rules: {
    "max-sx-props": maxSxPropsRule,
    "no-hardcoded-color-literals": noHardcodedColorLiteralsRule,
    "no-inline-styles": noInlineStylesRule
  }
};
