// Ризикові матеріали (обхід виявлення, купівля/фарм акаунтів, клоакінг) можуть не пройти модерацію App Store / Google Play
// і суперечать політикам Meta (див. GRINDSET_export/07_IMPROVEMENTS.md, 08_MVP_SPEC.md).
// За рішенням автора вони ВКЛЮЧЕНІ за замовчуванням. Для збірки в стори їх вимикають:
//   EXPO_PUBLIC_INCLUDE_RESTRICTED=false npx expo start -c   (або в EAS-профілі збірки)
// Тоді app-mvp/metro.config.js підміняє generated/ на generated-public/ та *.restricted на *.restricted.public,
// тож самих ризикових текстів у бандлі нема. Що саме позначене: content/restricted.json і docs/RESTRICTED_IDS.md.
export const INCLUDE_RESTRICTED = process.env.EXPO_PUBLIC_INCLUDE_RESTRICTED !== 'false';
