// ЗГЕНЕРОВАНО скриптом scripts/optimize-art.mjs (npm run art:build). Не редагувати вручну.
// Ключ = шлях у assets/art-v2 без розширення. Заміна файла з тим самим іменем + art:build не вимагає змін коду.
export type ArtKey =
  | 'cutout/archetypes/f_reg'
  | 'cutout/archetypes/f_slim'
  | 'cutout/archetypes/m_ath'
  | 'cutout/archetypes/m_avg'
  | 'cutout/archetypes/m_plump'
  | 'cutout/archetypes/m_slim'
  | 'cutout/grindik/grindik_portrait'
  | 'cutout/grindik/idle_base'
  | 'cutout/grindik/idle_coffee'
  | 'cutout/grindik/idle_night'
  | 'cutout/grindik/idle_phone'
  | 'cutout/grindik/idle_taxi'
  | 'cutout/grindik/idle_war'
  | 'cutout/grindik/mood_fire'
  | 'cutout/grindik/mood_happy'
  | 'cutout/grindik/mood_oops'
  | 'cutout/grindik/pose_arms'
  | 'cutout/grindik/pose_cheer'
  | 'cutout/grindik/pose_chest'
  | 'cutout/grindik/pose_laptop'
  | 'cutout/grindik/pose_phone'
  | 'cutout/grindik/pose_point'
  | 'cutout/grindik/pose_shrug'
  | 'cutout/grindik/pose_think'
  | 'cutout/grindik/pose_wave'
  | 'cutout/npc/barista'
  | 'cutout/npc/colleague'
  | 'cutout/npc/rival'
  | 'cutout/npc/teamlead'
  | 'cutout/presets/preset_1'
  | 'cutout/presets/preset_2'
  | 'cutout/presets/preset_3'
  | 'cutout/presets/preset_4'
  | 'cutout/wardrobe/look_hoodie'
  | 'cutout/wardrobe/look_lux'
  | 'cutout/wardrobe/look_smart'
  | 'cutout/wardrobe/look_street'
  | 'cutout/wardrobe/look_suit'
  | 'cutout/wardrobe/look_track'
  | 'fx/objects/chest_closed'
  | 'fx/objects/chest_open'
  | 'fx/objects/coin'
  | 'fx/objects/energy'
  | 'fx/objects/flame'
  | 'fx/objects/gem'
  | 'ui/nav/nav_lessons'
  | 'ui/nav/nav_profile'
  | 'ui/nav/nav_rating'
  | 'ui/nav/nav_shop'
  | 'worlds/acts/act1_door'
  | 'worlds/acts/act1_room'
  | 'worlds/acts/act1_room_b'
  | 'worlds/acts/act2_coworking'
  | 'worlds/acts/act3_apartment'
  | 'worlds/acts/act4_lux'
  | 'worlds/locations/bank'
  | 'worlds/locations/bar'
  | 'worlds/locations/cafe'
  | 'worlds/locations/car_dealer'
  | 'worlds/locations/embankment'
  | 'worlds/locations/grocery'
  | 'worlds/locations/gym'
  | 'worlds/locations/kiosk'
  | 'worlds/locations/lobby'
  | 'worlds/locations/mall'
  | 'worlds/locations/metro'
  | 'worlds/locations/nightclub'
  | 'worlds/locations/pharmacy'
  | 'worlds/locations/restaurant'
  | 'worlds/locations/rooftop'
  | 'worlds/locations/shelter'
  | 'worlds/locations/street_night'
  | 'worlds/locations/tck'
  | 'worlds/locations/yard'
  | 'worlds/posters/poster_cat'
  | 'worlds/posters/poster_cyberpunk'
  | 'worlds/posters/poster_hustle'
  | 'worlds/posters/poster_ua'
  | 'worlds/splashes/splash_cafe'
  | 'worlds/splashes/splash_coworking'
  | 'worlds/splashes/splash_metro'
  | 'worlds/splashes/splash_office'
  | 'worlds/transport/car_lux'
  | 'worlds/transport/car_mid'
  | 'worlds/transport/car_old'
  | 'worlds/transport/marshrutka'
  | 'worlds/weather/cafe_day'
  | 'worlds/weather/cafe_night'
  | 'worlds/weather/cafe_rain'
  | 'worlds/weather/cafe_snow'
  | 'cutout/transport/car_lux'
  | 'cutout/transport/car_mid'
  | 'cutout/transport/car_old'
  | 'cutout/transport/marshrutka';

export const ART_MANIFEST: Record<ArtKey, { src: number; w: number; h: number }> = {
  'cutout/archetypes/f_reg': { src: require('../../assets/art-v2-opt/cutout/archetypes/f_reg.webp'), w: 388, h: 1099 },
  'cutout/archetypes/f_slim': { src: require('../../assets/art-v2-opt/cutout/archetypes/f_slim.webp'), w: 313, h: 1121 },
  'cutout/archetypes/m_ath': { src: require('../../assets/art-v2-opt/cutout/archetypes/m_ath.webp'), w: 381, h: 1164 },
  'cutout/archetypes/m_avg': { src: require('../../assets/art-v2-opt/cutout/archetypes/m_avg.webp'), w: 569, h: 1146 },
  'cutout/archetypes/m_plump': { src: require('../../assets/art-v2-opt/cutout/archetypes/m_plump.webp'), w: 419, h: 1145 },
  'cutout/archetypes/m_slim': { src: require('../../assets/art-v2-opt/cutout/archetypes/m_slim.webp'), w: 603, h: 1160 },
  'cutout/grindik/grindik_portrait': { src: require('../../assets/art-v2-opt/cutout/grindik/grindik_portrait.webp'), w: 720, h: 836 },
  'cutout/grindik/idle_base': { src: require('../../assets/art-v2-opt/cutout/grindik/idle_base.webp'), w: 720, h: 630 },
  'cutout/grindik/idle_coffee': { src: require('../../assets/art-v2-opt/cutout/grindik/idle_coffee.webp'), w: 689, h: 783 },
  'cutout/grindik/idle_night': { src: require('../../assets/art-v2-opt/cutout/grindik/idle_night.webp'), w: 720, h: 631 },
  'cutout/grindik/idle_phone': { src: require('../../assets/art-v2-opt/cutout/grindik/idle_phone.webp'), w: 720, h: 687 },
  'cutout/grindik/idle_taxi': { src: require('../../assets/art-v2-opt/cutout/grindik/idle_taxi.webp'), w: 720, h: 599 },
  'cutout/grindik/idle_war': { src: require('../../assets/art-v2-opt/cutout/grindik/idle_war.webp'), w: 510, h: 718 },
  'cutout/grindik/mood_fire': { src: require('../../assets/art-v2-opt/cutout/grindik/mood_fire.webp'), w: 627, h: 1129 },
  'cutout/grindik/mood_happy': { src: require('../../assets/art-v2-opt/cutout/grindik/mood_happy.webp'), w: 389, h: 1123 },
  'cutout/grindik/mood_oops': { src: require('../../assets/art-v2-opt/cutout/grindik/mood_oops.webp'), w: 355, h: 1103 },
  'cutout/grindik/pose_arms': { src: require('../../assets/art-v2-opt/cutout/grindik/pose_arms.webp'), w: 370, h: 1125 },
  'cutout/grindik/pose_cheer': { src: require('../../assets/art-v2-opt/cutout/grindik/pose_cheer.webp'), w: 705, h: 1148 },
  'cutout/grindik/pose_chest': { src: require('../../assets/art-v2-opt/cutout/grindik/pose_chest.webp'), w: 430, h: 1134 },
  'cutout/grindik/pose_laptop': { src: require('../../assets/art-v2-opt/cutout/grindik/pose_laptop.webp'), w: 521, h: 1163 },
  'cutout/grindik/pose_phone': { src: require('../../assets/art-v2-opt/cutout/grindik/pose_phone.webp'), w: 432, h: 1126 },
  'cutout/grindik/pose_point': { src: require('../../assets/art-v2-opt/cutout/grindik/pose_point.webp'), w: 375, h: 1142 },
  'cutout/grindik/pose_shrug': { src: require('../../assets/art-v2-opt/cutout/grindik/pose_shrug.webp'), w: 690, h: 1096 },
  'cutout/grindik/pose_think': { src: require('../../assets/art-v2-opt/cutout/grindik/pose_think.webp'), w: 347, h: 1103 },
  'cutout/grindik/pose_wave': { src: require('../../assets/art-v2-opt/cutout/grindik/pose_wave.webp'), w: 428, h: 1081 },
  'cutout/npc/barista': { src: require('../../assets/art-v2-opt/cutout/npc/barista.webp'), w: 315, h: 1118 },
  'cutout/npc/colleague': { src: require('../../assets/art-v2-opt/cutout/npc/colleague.webp'), w: 529, h: 1081 },
  'cutout/npc/rival': { src: require('../../assets/art-v2-opt/cutout/npc/rival.webp'), w: 368, h: 1191 },
  'cutout/npc/teamlead': { src: require('../../assets/art-v2-opt/cutout/npc/teamlead.webp'), w: 366, h: 1141 },
  'cutout/presets/preset_1': { src: require('../../assets/art-v2-opt/cutout/presets/preset_1.webp'), w: 373, h: 1134 },
  'cutout/presets/preset_2': { src: require('../../assets/art-v2-opt/cutout/presets/preset_2.webp'), w: 292, h: 1107 },
  'cutout/presets/preset_3': { src: require('../../assets/art-v2-opt/cutout/presets/preset_3.webp'), w: 390, h: 1134 },
  'cutout/presets/preset_4': { src: require('../../assets/art-v2-opt/cutout/presets/preset_4.webp'), w: 417, h: 1129 },
  'cutout/wardrobe/look_hoodie': { src: require('../../assets/art-v2-opt/cutout/wardrobe/look_hoodie.webp'), w: 391, h: 1137 },
  'cutout/wardrobe/look_lux': { src: require('../../assets/art-v2-opt/cutout/wardrobe/look_lux.webp'), w: 622, h: 1121 },
  'cutout/wardrobe/look_smart': { src: require('../../assets/art-v2-opt/cutout/wardrobe/look_smart.webp'), w: 368, h: 1157 },
  'cutout/wardrobe/look_street': { src: require('../../assets/art-v2-opt/cutout/wardrobe/look_street.webp'), w: 406, h: 1123 },
  'cutout/wardrobe/look_suit': { src: require('../../assets/art-v2-opt/cutout/wardrobe/look_suit.webp'), w: 603, h: 1114 },
  'cutout/wardrobe/look_track': { src: require('../../assets/art-v2-opt/cutout/wardrobe/look_track.webp'), w: 372, h: 1119 },
  'fx/objects/chest_closed': { src: require('../../assets/art-v2-opt/fx/objects/chest_closed.webp'), w: 512, h: 512 },
  'fx/objects/chest_open': { src: require('../../assets/art-v2-opt/fx/objects/chest_open.webp'), w: 512, h: 512 },
  'fx/objects/coin': { src: require('../../assets/art-v2-opt/fx/objects/coin.webp'), w: 512, h: 512 },
  'fx/objects/energy': { src: require('../../assets/art-v2-opt/fx/objects/energy.webp'), w: 512, h: 512 },
  'fx/objects/flame': { src: require('../../assets/art-v2-opt/fx/objects/flame.webp'), w: 512, h: 512 },
  'fx/objects/gem': { src: require('../../assets/art-v2-opt/fx/objects/gem.webp'), w: 512, h: 512 },
  'ui/nav/nav_lessons': { src: require('../../assets/art-v2-opt/ui/nav/nav_lessons.webp'), w: 320, h: 320 },
  'ui/nav/nav_profile': { src: require('../../assets/art-v2-opt/ui/nav/nav_profile.webp'), w: 320, h: 320 },
  'ui/nav/nav_rating': { src: require('../../assets/art-v2-opt/ui/nav/nav_rating.webp'), w: 320, h: 320 },
  'ui/nav/nav_shop': { src: require('../../assets/art-v2-opt/ui/nav/nav_shop.webp'), w: 320, h: 320 },
  'worlds/acts/act1_door': { src: require('../../assets/art-v2-opt/worlds/acts/act1_door.webp'), w: 832, h: 1216 },
  'worlds/acts/act1_room': { src: require('../../assets/art-v2-opt/worlds/acts/act1_room.webp'), w: 832, h: 1216 },
  'worlds/acts/act1_room_b': { src: require('../../assets/art-v2-opt/worlds/acts/act1_room_b.webp'), w: 832, h: 569 },
  'worlds/acts/act2_coworking': { src: require('../../assets/art-v2-opt/worlds/acts/act2_coworking.webp'), w: 832, h: 569 },
  'worlds/acts/act3_apartment': { src: require('../../assets/art-v2-opt/worlds/acts/act3_apartment.webp'), w: 832, h: 569 },
  'worlds/acts/act4_lux': { src: require('../../assets/art-v2-opt/worlds/acts/act4_lux.webp'), w: 832, h: 569 },
  'worlds/locations/bank': { src: require('../../assets/art-v2-opt/worlds/locations/bank.webp'), w: 1216, h: 832 },
  'worlds/locations/bar': { src: require('../../assets/art-v2-opt/worlds/locations/bar.webp'), w: 1216, h: 832 },
  'worlds/locations/cafe': { src: require('../../assets/art-v2-opt/worlds/locations/cafe.webp'), w: 1216, h: 832 },
  'worlds/locations/car_dealer': { src: require('../../assets/art-v2-opt/worlds/locations/car_dealer.webp'), w: 1216, h: 832 },
  'worlds/locations/embankment': { src: require('../../assets/art-v2-opt/worlds/locations/embankment.webp'), w: 1216, h: 832 },
  'worlds/locations/grocery': { src: require('../../assets/art-v2-opt/worlds/locations/grocery.webp'), w: 1216, h: 832 },
  'worlds/locations/gym': { src: require('../../assets/art-v2-opt/worlds/locations/gym.webp'), w: 1216, h: 832 },
  'worlds/locations/kiosk': { src: require('../../assets/art-v2-opt/worlds/locations/kiosk.webp'), w: 1216, h: 832 },
  'worlds/locations/lobby': { src: require('../../assets/art-v2-opt/worlds/locations/lobby.webp'), w: 1216, h: 832 },
  'worlds/locations/mall': { src: require('../../assets/art-v2-opt/worlds/locations/mall.webp'), w: 1216, h: 832 },
  'worlds/locations/metro': { src: require('../../assets/art-v2-opt/worlds/locations/metro.webp'), w: 1216, h: 832 },
  'worlds/locations/nightclub': { src: require('../../assets/art-v2-opt/worlds/locations/nightclub.webp'), w: 1216, h: 832 },
  'worlds/locations/pharmacy': { src: require('../../assets/art-v2-opt/worlds/locations/pharmacy.webp'), w: 1216, h: 832 },
  'worlds/locations/restaurant': { src: require('../../assets/art-v2-opt/worlds/locations/restaurant.webp'), w: 1216, h: 832 },
  'worlds/locations/rooftop': { src: require('../../assets/art-v2-opt/worlds/locations/rooftop.webp'), w: 1216, h: 832 },
  'worlds/locations/shelter': { src: require('../../assets/art-v2-opt/worlds/locations/shelter.webp'), w: 1216, h: 832 },
  'worlds/locations/street_night': { src: require('../../assets/art-v2-opt/worlds/locations/street_night.webp'), w: 1216, h: 832 },
  'worlds/locations/tck': { src: require('../../assets/art-v2-opt/worlds/locations/tck.webp'), w: 1216, h: 832 },
  'worlds/locations/yard': { src: require('../../assets/art-v2-opt/worlds/locations/yard.webp'), w: 1216, h: 832 },
  'worlds/posters/poster_cat': { src: require('../../assets/art-v2-opt/worlds/posters/poster_cat.webp'), w: 640, h: 640 },
  'worlds/posters/poster_cyberpunk': { src: require('../../assets/art-v2-opt/worlds/posters/poster_cyberpunk.webp'), w: 640, h: 640 },
  'worlds/posters/poster_hustle': { src: require('../../assets/art-v2-opt/worlds/posters/poster_hustle.webp'), w: 640, h: 640 },
  'worlds/posters/poster_ua': { src: require('../../assets/art-v2-opt/worlds/posters/poster_ua.webp'), w: 640, h: 640 },
  'worlds/splashes/splash_cafe': { src: require('../../assets/art-v2-opt/worlds/splashes/splash_cafe.webp'), w: 832, h: 1216 },
  'worlds/splashes/splash_coworking': { src: require('../../assets/art-v2-opt/worlds/splashes/splash_coworking.webp'), w: 832, h: 1216 },
  'worlds/splashes/splash_metro': { src: require('../../assets/art-v2-opt/worlds/splashes/splash_metro.webp'), w: 832, h: 1216 },
  'worlds/splashes/splash_office': { src: require('../../assets/art-v2-opt/worlds/splashes/splash_office.webp'), w: 832, h: 1216 },
  'worlds/transport/car_lux': { src: require('../../assets/art-v2-opt/worlds/transport/car_lux.webp'), w: 1216, h: 832 },
  'worlds/transport/car_mid': { src: require('../../assets/art-v2-opt/worlds/transport/car_mid.webp'), w: 1216, h: 832 },
  'worlds/transport/car_old': { src: require('../../assets/art-v2-opt/worlds/transport/car_old.webp'), w: 1216, h: 832 },
  'worlds/transport/marshrutka': { src: require('../../assets/art-v2-opt/worlds/transport/marshrutka.webp'), w: 1216, h: 832 },
  'worlds/weather/cafe_day': { src: require('../../assets/art-v2-opt/worlds/weather/cafe_day.webp'), w: 1216, h: 832 },
  'worlds/weather/cafe_night': { src: require('../../assets/art-v2-opt/worlds/weather/cafe_night.webp'), w: 1216, h: 832 },
  'worlds/weather/cafe_rain': { src: require('../../assets/art-v2-opt/worlds/weather/cafe_rain.webp'), w: 1216, h: 832 },
  'worlds/weather/cafe_snow': { src: require('../../assets/art-v2-opt/worlds/weather/cafe_snow.webp'), w: 1216, h: 832 },
  'cutout/transport/car_lux': { src: require('../../assets/art-v2-opt/cutout/transport/car_lux.webp'), w: 900, h: 250 },
  'cutout/transport/car_mid': { src: require('../../assets/art-v2-opt/cutout/transport/car_mid.webp'), w: 900, h: 300 },
  'cutout/transport/car_old': { src: require('../../assets/art-v2-opt/cutout/transport/car_old.webp'), w: 900, h: 338 },
  'cutout/transport/marshrutka': { src: require('../../assets/art-v2-opt/cutout/transport/marshrutka.webp'), w: 900, h: 411 },
};

// Центр обличчя у прозорих фігур (частки зображення) для круглих портретів: x, y центр, span частка висоти, що видно в колі
export const ART_FACE: Partial<Record<ArtKey, { x: number; y: number; span: number }>> = {
  'cutout/archetypes/f_reg': { x: 0.56, y: 0.095, span: 0.168 },
  'cutout/archetypes/f_slim': { x: 0.485, y: 0.095, span: 0.168 },
  'cutout/archetypes/m_ath': { x: 0.406, y: 0.093, span: 0.169 },
  'cutout/archetypes/m_avg': { x: 0.69, y: 0.094, span: 0.168 },
  'cutout/archetypes/m_plump': { x: 0.473, y: 0.095, span: 0.168 },
  'cutout/archetypes/m_slim': { x: 0.704, y: 0.094, span: 0.168 },
  'cutout/grindik/grindik_portrait': { x: 0.46, y: 0.27, span: 0.62 },
  'cutout/grindik/mood_fire': { x: 0.64, y: 0.095, span: 0.168 },
  'cutout/grindik/mood_happy': { x: 0.515, y: 0.092, span: 0.169 },
  'cutout/grindik/mood_oops': { x: 0.451, y: 0.094, span: 0.168 },
  'cutout/grindik/pose_arms': { x: 0.528, y: 0.094, span: 0.168 },
  'cutout/grindik/pose_cheer': { x: 0.614, y: 0.095, span: 0.168 },
  'cutout/grindik/pose_chest': { x: 0.576, y: 0.095, span: 0.168 },
  'cutout/grindik/pose_laptop': { x: 0.624, y: 0.094, span: 0.168 },
  'cutout/grindik/pose_phone': { x: 0.523, y: 0.094, span: 0.168 },
  'cutout/grindik/pose_point': { x: 0.472, y: 0.095, span: 0.168 },
  'cutout/grindik/pose_shrug': { x: 0.494, y: 0.093, span: 0.169 },
  'cutout/grindik/pose_think': { x: 0.352, y: 0.095, span: 0.168 },
  'cutout/grindik/pose_wave': { x: 0.576, y: 0.095, span: 0.168 },
  'cutout/npc/barista': { x: 0.49, y: 0.095, span: 0.168 },
  'cutout/npc/colleague': { x: 0.633, y: 0.096, span: 0.168 },
  'cutout/npc/rival': { x: 0.493, y: 0.093, span: 0.168 },
  'cutout/npc/teamlead': { x: 0.459, y: 0.095, span: 0.168 },
  'cutout/presets/preset_1': { x: 0.485, y: 0.093, span: 0.169 },
  'cutout/presets/preset_2': { x: 0.477, y: 0.095, span: 0.168 },
  'cutout/presets/preset_3': { x: 0.478, y: 0.095, span: 0.168 },
  'cutout/presets/preset_4': { x: 0.483, y: 0.094, span: 0.168 },
  'cutout/wardrobe/look_hoodie': { x: 0.505, y: 0.095, span: 0.168 },
  'cutout/wardrobe/look_lux': { x: 0.684, y: 0.094, span: 0.168 },
  'cutout/wardrobe/look_smart': { x: 0.429, y: 0.093, span: 0.169 },
  'cutout/wardrobe/look_street': { x: 0.496, y: 0.095, span: 0.168 },
  'cutout/wardrobe/look_suit': { x: 0.637, y: 0.095, span: 0.168 },
  'cutout/wardrobe/look_track': { x: 0.501, y: 0.095, span: 0.168 },
};
