/**
 * Custom ESLint plugin for VaniaBot command permission conventions.
 *
 * Rules:
 * - no-permission-typo: `permission = ...` is a dead property (the Command
 *   framework only reads `permissions.user`), silently leaving the command
 *   at the USER default. Bit us once: !update and !restart were public.
 * - owner-requires-owner-permission: a command declaring
 *   `category = CommandCategory.OWNER` must explicitly gate itself with
 *   `permissions = { user: [PermissionLevel.OWNER, ...] }`.
 */

const RULE_NO_TYPO = 'no-permission-typo';
const RULE_OWNER_GATE = 'owner-requires-owner-permission';

/** Finds the ClassBody node of `export class X extends Command {...}`. */
function findCommandClassBody(node) {
  if (node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportDefaultDeclaration') {
    return null;
  }
  const declaration = node.declaration;
  if (!declaration || declaration.type !== 'ClassDeclaration') return null;

  const superClass = declaration.superClass;
  if (!superClass) return null;
  const superName = superClass.name || (superClass.id && superClass.id.name);
  if (superName !== 'Command') return null;

  return declaration.body;
}

/** Returns the PropertyDefinition for `name` inside a ClassBody, if any. */
function findClassProperty(classBody, propertyName) {
  return classBody.body.find(
    member =>
      member.type === 'PropertyDefinition' &&
      !member.computed &&
      member.key.type === 'Identifier' &&
      member.key.name === propertyName,
  );
}

function isPermissionLevelOwner(node) {
  // Matches PermissionLevel.OWNER / owner enums ending in .OWNER
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'OWNER'
  );
}

/** True when the permissions value contains an explicit OWNER gate. */
function containsOwnerGate(node) {
  if (!node) return false;
  if (isPermissionLevelOwner(node)) return true;

  if (node.type === 'ObjectExpression') {
    return node.properties.some(
      prop =>
        prop.type === 'Property' &&
        !prop.computed &&
        prop.key.type === 'Identifier' &&
        prop.key.name === 'user' &&
        containsOwnerGate(prop.value),
    );
  }

  if (node.type === 'ArrayExpression') {
    return node.elements.some(element => containsOwnerGate(element));
  }

  return false;
}

export const rules = {
  [RULE_NO_TYPO]: {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Disallow the dead `permission =` property on Command subclasses; the framework only reads `permissions.user`',
      },
      schema: [],
      messages: {
        deadProperty:
          "'permission' es una propiedad muerta: el framework solo lee 'permissions.user'. El comando queda con el default USER y sin protección real.",
      },
    },
    create(context) {
      return {
        ExportNamedDeclaration(node) {
          const classBody = findCommandClassBody(node);
          if (!classBody) return;

          const typoProp = findClassProperty(classBody, 'permission');
          if (typoProp) {
            context.report({
              node: typoProp,
              messageId: 'deadProperty',
            });
          }
        },
      };
    },
  },

  [RULE_OWNER_GATE]: {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Commands with category = CommandCategory.OWNER must declare permissions.user containing PermissionLevel.OWNER',
      },
      schema: [],
      messages: {
        missingOwnerGate:
          "El comando es de categoría OWNER pero no declara 'permissions = { user: [PermissionLevel.OWNER] }': queda abierto al default USER.",
      },
    },
    create(context) {
      return {
        ExportNamedDeclaration(node) {
          const classBody = findCommandClassBody(node);
          if (!classBody) return;

          const categoryProp = findClassProperty(classBody, 'category');
          const isOwnerCategory =
            categoryProp &&
            categoryProp.value &&
            categoryProp.value.type === 'MemberExpression' &&
            !categoryProp.value.computed &&
            categoryProp.value.object.type === 'Identifier' &&
            categoryProp.value.object.name === 'CommandCategory' &&
            categoryProp.value.property.type === 'Identifier' &&
            categoryProp.value.property.name === 'OWNER';

          if (!isOwnerCategory) return;

          const permissionsProp = findClassProperty(classBody, 'permissions');
          if (!permissionsProp) {
            context.report({ node: categoryProp, messageId: 'missingOwnerGate' });
            return;
          }

          if (!containsOwnerGate(permissionsProp.value)) {
            context.report({ node: permissionsProp, messageId: 'missingOwnerGate' });
          }
        },
      };
    },
  },
};

export const plugin = {
  meta: { name: 'eslint-plugin-vania' },
  rules,
};

export default plugin;
