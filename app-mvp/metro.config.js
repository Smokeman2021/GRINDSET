// Публічна збірка (EXPO_PUBLIC_INCLUDE_RESTRICTED=false): ризикові матеріали не лише ховаються у виконанні, а взагалі
// не потрапляють у бандл. Для цього Metro на етапі збірки підміняє файли:
//   ./generated/…           -> ./generated-public/…   (набір модулів без позначених фрагментів, див. scripts/import-modules.mjs)
//   ./<назва>.restricted    -> ./<назва>.restricted.public   (бібліотека, словник)
// Після зміни прапора кеш треба скидати: expo start -c / expo export --clear.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const publicBuild = process.env.EXPO_PUBLIC_INCLUDE_RESTRICTED === 'false';

if (publicBuild) {
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    let name = moduleName;
    if (/(^|\/)generated\/m\d\d(\.(en|ru))?\.json$/.test(name)) name = name.replace('/generated/', '/generated-public/');
    else if (/\.restricted$/.test(name)) name = `${name}.public`;
    if (upstream) return upstream(context, name, platform);
    return context.resolveRequest(context, name, platform);
  };
}

module.exports = config;
