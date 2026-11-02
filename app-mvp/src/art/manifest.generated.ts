// ЗГЕНЕРОВАНО скриптом scripts/optimize-art.mjs (npm run art:build). Не редагувати вручну.
// Ключ = шлях у assets/art-v2 без розширення. Заміна файла з тим самим іменем + art:build не вимагає змін коду.
export type ArtKey =
  | 'character/archetypes/f_reg'
  | 'character/archetypes/f_slim'
  | 'character/archetypes/m_ath'
  | 'character/archetypes/m_avg'
  | 'character/archetypes/m_plump'
  | 'character/archetypes/m_slim'
  | 'character/grindik/grindik_portrait'
  | 'character/grindik/idle_base'
  | 'character/grindik/idle_coffee'
  | 'character/grindik/idle_night'
  | 'character/grindik/idle_phone'
  | 'character/grindik/idle_taxi'
  | 'character/grindik/idle_war'
  | 'character/grindik/mood_fire'
  | 'character/grindik/mood_happy'
  | 'character/grindik/mood_oops'
  | 'character/grindik/pose_arms'
  | 'character/grindik/pose_cheer'
  | 'character/grindik/pose_chest'
  | 'character/grindik/pose_laptop'
  | 'character/grindik/pose_phone'
  | 'character/grindik/pose_point'
  | 'character/grindik/pose_shrug'
  | 'character/grindik/pose_think'
  | 'character/grindik/pose_wave'
  | 'character/npc/barista'
  | 'character/npc/colleague'
  | 'character/npc/rival'
  | 'character/npc/teamlead'
  | 'character/presets/preset_1'
  | 'character/presets/preset_2'
  | 'character/presets/preset_3'
  | 'character/presets/preset_4'
  | 'character/wardrobe/color_denim'
  | 'character/wardrobe/color_leather'
  | 'character/wardrobe/color_red'
  | 'character/wardrobe/color_white'
  | 'character/wardrobe/look_hoodie'
  | 'character/wardrobe/look_lux'
  | 'character/wardrobe/look_smart'
  | 'character/wardrobe/look_street'
  | 'character/wardrobe/look_suit'
  | 'character/wardrobe/look_track'
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
  | 'worlds/weather/cafe_snow';

export const ART_MANIFEST: Record<ArtKey, { src: number; w: number; h: number }> = {
  'character/archetypes/f_reg': { src: require('../../assets/art-v2-opt/character/archetypes/f_reg.webp'), w: 700, h: 1023 },
  'character/archetypes/f_slim': { src: require('../../assets/art-v2-opt/character/archetypes/f_slim.webp'), w: 700, h: 1023 },
  'character/archetypes/m_ath': { src: require('../../assets/art-v2-opt/character/archetypes/m_ath.webp'), w: 700, h: 1023 },
  'character/archetypes/m_avg': { src: require('../../assets/art-v2-opt/character/archetypes/m_avg.webp'), w: 700, h: 1023 },
  'character/archetypes/m_plump': { src: require('../../assets/art-v2-opt/character/archetypes/m_plump.webp'), w: 700, h: 1023 },
  'character/archetypes/m_slim': { src: require('../../assets/art-v2-opt/character/archetypes/m_slim.webp'), w: 700, h: 1023 },
  'character/grindik/grindik_portrait': { src: require('../../assets/art-v2-opt/character/grindik/grindik_portrait.webp'), w: 700, h: 700 },
  'character/grindik/idle_base': { src: require('../../assets/art-v2-opt/character/grindik/idle_base.webp'), w: 700, h: 479 },
  'character/grindik/idle_coffee': { src: require('../../assets/art-v2-opt/character/grindik/idle_coffee.webp'), w: 700, h: 479 },
  'character/grindik/idle_night': { src: require('../../assets/art-v2-opt/character/grindik/idle_night.webp'), w: 700, h: 479 },
  'character/grindik/idle_phone': { src: require('../../assets/art-v2-opt/character/grindik/idle_phone.webp'), w: 700, h: 479 },
  'character/grindik/idle_taxi': { src: require('../../assets/art-v2-opt/character/grindik/idle_taxi.webp'), w: 700, h: 479 },
  'character/grindik/idle_war': { src: require('../../assets/art-v2-opt/character/grindik/idle_war.webp'), w: 700, h: 479 },
  'character/grindik/mood_fire': { src: require('../../assets/art-v2-opt/character/grindik/mood_fire.webp'), w: 700, h: 1023 },
  'character/grindik/mood_happy': { src: require('../../assets/art-v2-opt/character/grindik/mood_happy.webp'), w: 700, h: 1023 },
  'character/grindik/mood_oops': { src: require('../../assets/art-v2-opt/character/grindik/mood_oops.webp'), w: 700, h: 1023 },
  'character/grindik/pose_arms': { src: require('../../assets/art-v2-opt/character/grindik/pose_arms.webp'), w: 700, h: 1023 },
  'character/grindik/pose_cheer': { src: require('../../assets/art-v2-opt/character/grindik/pose_cheer.webp'), w: 700, h: 1023 },
  'character/grindik/pose_chest': { src: require('../../assets/art-v2-opt/character/grindik/pose_chest.webp'), w: 700, h: 1023 },
  'character/grindik/pose_laptop': { src: require('../../assets/art-v2-opt/character/grindik/pose_laptop.webp'), w: 700, h: 1023 },
  'character/grindik/pose_phone': { src: require('../../assets/art-v2-opt/character/grindik/pose_phone.webp'), w: 700, h: 1023 },
  'character/grindik/pose_point': { src: require('../../assets/art-v2-opt/character/grindik/pose_point.webp'), w: 700, h: 1023 },
  'character/grindik/pose_shrug': { src: require('../../assets/art-v2-opt/character/grindik/pose_shrug.webp'), w: 700, h: 1023 },
  'character/grindik/pose_think': { src: require('../../assets/art-v2-opt/character/grindik/pose_think.webp'), w: 700, h: 1023 },
  'character/grindik/pose_wave': { src: require('../../assets/art-v2-opt/character/grindik/pose_wave.webp'), w: 700, h: 1023 },
  'character/npc/barista': { src: require('../../assets/art-v2-opt/character/npc/barista.webp'), w: 700, h: 1023 },
  'character/npc/colleague': { src: require('../../assets/art-v2-opt/character/npc/colleague.webp'), w: 700, h: 1023 },
  'character/npc/rival': { src: require('../../assets/art-v2-opt/character/npc/rival.webp'), w: 700, h: 1023 },
  'character/npc/teamlead': { src: require('../../assets/art-v2-opt/character/npc/teamlead.webp'), w: 700, h: 1023 },
  'character/presets/preset_1': { src: require('../../assets/art-v2-opt/character/presets/preset_1.webp'), w: 700, h: 1023 },
  'character/presets/preset_2': { src: require('../../assets/art-v2-opt/character/presets/preset_2.webp'), w: 700, h: 1023 },
  'character/presets/preset_3': { src: require('../../assets/art-v2-opt/character/presets/preset_3.webp'), w: 700, h: 1023 },
  'character/presets/preset_4': { src: require('../../assets/art-v2-opt/character/presets/preset_4.webp'), w: 700, h: 1023 },
  'character/wardrobe/color_denim': { src: require('../../assets/art-v2-opt/character/wardrobe/color_denim.webp'), w: 700, h: 1023 },
  'character/wardrobe/color_leather': { src: require('../../assets/art-v2-opt/character/wardrobe/color_leather.webp'), w: 700, h: 1023 },
  'character/wardrobe/color_red': { src: require('../../assets/art-v2-opt/character/wardrobe/color_red.webp'), w: 700, h: 1023 },
  'character/wardrobe/color_white': { src: require('../../assets/art-v2-opt/character/wardrobe/color_white.webp'), w: 700, h: 1023 },
  'character/wardrobe/look_hoodie': { src: require('../../assets/art-v2-opt/character/wardrobe/look_hoodie.webp'), w: 700, h: 1023 },
  'character/wardrobe/look_lux': { src: require('../../assets/art-v2-opt/character/wardrobe/look_lux.webp'), w: 700, h: 1023 },
  'character/wardrobe/look_smart': { src: require('../../assets/art-v2-opt/character/wardrobe/look_smart.webp'), w: 700, h: 1023 },
  'character/wardrobe/look_street': { src: require('../../assets/art-v2-opt/character/wardrobe/look_street.webp'), w: 700, h: 1023 },
  'character/wardrobe/look_suit': { src: require('../../assets/art-v2-opt/character/wardrobe/look_suit.webp'), w: 700, h: 1023 },
  'character/wardrobe/look_track': { src: require('../../assets/art-v2-opt/character/wardrobe/look_track.webp'), w: 700, h: 1023 },
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
};
