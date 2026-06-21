/**
 * Stock photos for café menu items (Unsplash, 400×300 crop).
 * Used by menu import and db:apply-menu-images.
 */
import type { MenuCategoryName } from './cafe-menu';

const img = (photoId: string) =>
  `https://images.unsplash.com/photo-${photoId}?w=400&h=300&fit=crop`;

/** Per-item overrides — keyed by menu item code. */
export const MENU_ITEM_IMAGES: Record<string, string> = {
  // Hot drinks
  MATCHA_LATTE_HOT: img('1515823662972-ab608188455c'),
  HOT_CHOCOLATE: img('1542995449-a953f51a2e72'),
  SPANISH_LATTE_HOT: img('1572442388796-11668a67e53d'),
  COCONUT_LATTE_HOT: img('1470339510812-63ff10980306'),
  MOCHA_HOT: img('1572490122747-39626482af06'),
  CAPPUCCINO_HOT: img('1572442388796-11668a67e53d'),
  FLAT_WHITE: img('1511920170033-f8396884c10f'),
  CAFE_LATTE_HOT: img('1561882468-090d8622a088'),
  CORTADO: img('1510707577709-f6773b02177d'),
  DOUBLE_ESPRESSO: img('1514432324607-a09d9b4aefdd'),
  AMERICANO_HOT: img('1514432324607-a09d9b4aefdd'),
  MACCHIATO: img('1510707577709-f6773b02177d'),
  ESPRESSO: img('1514432324607-a09d9b4aefdd'),
  TURKISH_COFFEE: img('1511920170033-f8396884c10f'),

  // Iced drinks
  MATCHA_LATTE_ICED: img('1629207801457-102340158b61'),
  SPANISH_LATTE_ICED: img('1461023058943-07b127f78510'),
  COCONUT_LATTE_ICED: img('1461023058943-07b127f78510'),
  MOCHA_ICED: img('1517701603779-4ae6ab86d919'),
  CAPPUCCINO_ICED: img('1461023058943-07b127f78510'),
  CAFE_LATTE_ICED: img('1461023058943-07b127f78510'),
  AMERICANO_ICED: img('1517487881594-278ef2575478'),

  // Teas
  RED_TEA: img('1556679343-2192677f86f3'),
  GREEN_TEA: img('1556679343-2192677f86f3'),

  // Mocktails
  BLUE_LAGOON: img('1544145953-0772-7722ba7e066'),
  PASSION_FRUIT: img('1546173159-315724a31696'),
  STRAWBERRY: img('1551024501-0bccd828d307'),
  WATER_MELON: img('1622596073796-f177a731fd4a'),
  BLUEBERRY: img('1495474472287-4d71bcdd2085'),
  POMEGRANATE: img('1622596073796-f177a731fd4a'),
  PEACH: img('1546173159-315724a31696'),

  // Juices
  APPLE_JUICE: img('1568702846-9697f16886cb'),
  ORANGE_JUICE: img('1622485848029-455408996a5a'),

  // Soft drinks
  KINZA_COLA: img('1629204601097-20a4dd084553'),
  KINZA_LEMON: img('1622485574691-67de2a5b2fd8'),

  // Snacks
  CROISSANT: img('1555507036-ab1f4038808a'),
  MUFFIN: img('1607954436304-426d3a5a5b1e'),
  PROTEIN_BAR_GRANADE: img('1593095947821-059e8a34209b'),
  PROTEIN_BAR_QUEST: img('1593095947821-059e8a34209b'),
};

const CATEGORY_FALLBACKS: Record<MenuCategoryName, string> = {
  'Hot Drinks': img('1561882468-090d8622a088'),
  'Iced Drinks': img('1461023058943-07b127f78510'),
  Teas: img('1556679343-2192677f86f3'),
  Mocktails: img('1544145953-0772-7722ba7e066'),
  Juices: img('1622485848029-455408996a5a'),
  'Soft Drinks': img('1629204601097-20a4dd084553'),
  Snacks: img('1555507036-ab1f4038808a'),
};

export function resolveMenuImageUrl(
  code: string,
  category: MenuCategoryName,
): string {
  return MENU_ITEM_IMAGES[code] ?? CATEGORY_FALLBACKS[category];
}
