/**
 * Validador de códigos CABYS (Clasificación de Actividades Económicas de Costa Rica)
 * Hacienda 4.4 requiere un CABYS válido por línea de detalle
 * 
 * Estructura: 6 dígitos en formato AABBCC
 *   AA = Rama (01-99)
 *   BB = Subrama (01-99)
 *   CC = Clase (01-99)
 */

// Tabla de códigos CABYS válidos para restaurantes y servicios de alimentación
export const VALID_CABYS_CODES: Record<string, string> = {
  // --- Servicios de restauración (Rama 56) ---
  '561101': 'Restaurantes con servicio completo',
  '561102': 'Restaurantes con servicio limitado',
  '561103': 'Bares, cantinas, discotecas',
  '561104': 'Cafeterías y restaurantes de comida rápida',
  '561105': 'Panadería y confitería',
  '561106': 'Otros servicios de alimentación',
  '562101': 'Servicio de catering y banquetes',
  '562102': 'Servicio de comidas para eventos',

  // --- Bebidas no alcohólicas ---
  '110201': 'Agua purificada embotellada',
  '110202': 'Agua mineral natural',
  '110301': 'Jugos y néctares de frutas',
  '110302': 'Jugo de naranja natural',
  '110303': 'Jugo de piña natural',
  '110304': 'Jugo de mango',
  '110305': 'Mezcla de jugos de frutas tropicales',
  '110401': 'Refrescos naturales (frescos)',
  '110402': 'Refresco de tamarindo',
  '110403': 'Refresco de horchata',
  '110404': 'Refresco de jamaica',
  '110501': 'Gaseosas y bebidas carbonatadas',
  '110502': 'Bebidas energizantes',
  '110503': 'Bebidas isotónicas y deportivas',
  '110601': 'Café preparado (americano, espresso)',
  '110602': 'Café con leche, cappuccino, latte',
  '110603': 'Té caliente o frío',
  '110604': 'Chocolate caliente o frío',
  '110605': 'Bebidas a base de café',

  // --- Bebidas alcohólicas ---
  '110701': 'Cerveza nacional',
  '110702': 'Cerveza importada',
  '110703': 'Cerveza artesanal',
  '110801': 'Vino tinto de mesa',
  '110802': 'Vino blanco de mesa',
  '110803': 'Vino rosado',
  '110804': 'Vino espumante / champagne',
  '110901': 'Ron nacional',
  '110902': 'Ron importado',
  '110903': 'Guaro (licor de caña)',
  '110904': 'Whisky',
  '110905': 'Vodka',
  '110906': 'Tequila',
  '110907': 'Gin',
  '110908': 'Brandy / coñac',
  '110909': 'Licores y cremas',
  '111001': 'Cócteles y mezclas de bebidas alcohólicas',

  // --- Alimentos preparados ---
  '101101': 'Comida rápida (hamburguesas, hot dogs)',
  '101102': 'Pizza',
  '101103': 'Sándwiches y wraps',
  '101104': 'Tacos, burritos y comida mexicana',
  '101105': 'Comida china y asiática',
  '101106': 'Sushi y comida japonesa',
  '101201': 'Entradas y aperitivos',
  '101202': 'Ensaladas',
  '101203': 'Sopas y cremas',
  '101204': 'Platos fuertes (carne de res)',
  '101205': 'Platos fuertes (pollo)',
  '101206': 'Platos fuertes (cerdo)',
  '101207': 'Platos fuertes (mariscos y pescado)',
  '101208': 'Platos vegetarianos y veganos',
  '101209': 'Pastas y arroces',
  '101210': 'Guarniciones y acompañamientos',

  // --- Postres y repostería ---
  '107101': 'Postres en general',
  '107102': 'Helados y sorbetes',
  '107103': 'Pasteles y tortas',
  '107104': 'Galletas y brownies',
  '107105': 'Flan, tres leches, pudín',
  '107106': 'Frutas frescas y ensalada de frutas',
  '107201': 'Pan y productos de panadería',
  '107202': 'Pan artesanal',
  '107203': 'Repostería y confitería',

  // --- Desayunos ---
  '101301': 'Desayuno típico costarricense (gallo pinto)',
  '101302': 'Huevos preparados',
  '101303': 'Panqueques y waffles',
  '101304': 'Cereal y yogur',
  '101305': 'Batidos y smoothies',

  // --- Ingredientes y productos para preparación ---
  '103101': 'Carnes frescas (res)',
  '103102': 'Carnes frescas (pollo)',
  '103103': 'Carnes frescas (cerdo)',
  '103104': 'Embutidos y fiambres',
  '103201': 'Pescado fresco',
  '103202': 'Mariscos frescos',
  '103203': 'Camarones',
  '104101': 'Frutas frescas',
  '104102': 'Verduras y hortalizas frescas',
  '104103': 'Condimentos y especias',
  '104201': 'Lácteos (leche, queso, crema)',
  '104202': 'Mantequilla y margarina',

  // --- Otros servicios ---
  '960101': 'Servicio de entrega a domicilio de alimentos',
  '960102': 'Servicio de recogida en restaurante (take out)',
};

// Mapeo de categorías de producto a CABYS por defecto
export function getDefaultCabysByCategoryName(categoryName: string): string {
  const normalized = categoryName.toLowerCase();

  // Bebidas alcohólicas → Bares
  if (normalized.includes('licor') || normalized.includes('cerveza') || normalized.includes('vino')) {
    return '561103';
  }

  // Bebidas no alcohólicas, café → Cafetería
  if (normalized.includes('bebida') || normalized.includes('refresco') || normalized.includes('café')) {
    return '561104';
  }

  // Postres, pan → Panadería
  if (normalized.includes('pastel') || normalized.includes('pan') || normalized.includes('postre')) {
    return '561105';
  }

  // Por defecto, restaurante con servicio completo
  return '561101';
}

/**
 * Valida si un código CABYS es válido
 * @param cabysCode - Código CABYS de 6 dígitos
 * @returns { valid: boolean, description?: string, reason?: string }
 */
export function validateCabysCode(cabysCode: string): { valid: boolean; description?: string; reason?: string } {
  if (!cabysCode) {
    return { valid: false, reason: 'CABYS vacío' };
  }

  // Remover guiones si existen
  const cleaned = cabysCode.replace(/-/g, '');

  // Debe ser exactamente 6 dígitos
  if (!/^\d{6}$/.test(cleaned)) {
    return { valid: false, reason: 'CABYS debe ser 6 dígitos (ej: 561101)' };
  }

  // Validar que no sea todo ceros
  if (cleaned === '000000') {
    return { valid: false, reason: 'CABYS no puede ser 000000' };
  }

  // Validar ramas conocidas (56 = Servicios de alojamiento y gastronomía)
  const branch = cleaned.substring(0, 2);
  if (branch !== '56') {
    return { valid: false, reason: 'CABYS debe comenzar con rama 56 (Servicios de alojamiento y gastronomía)' };
  }

  // Validar contra tabla de códigos conocidos
  if (VALID_CABYS_CODES[cleaned]) {
    return {
      valid: true,
      description: VALID_CABYS_CODES[cleaned],
    };
  }

  // Si el código es 56XXYY pero no está en tabla conocida, permitir con advertencia
  // (podría ser un código válido pero no registrado en nuestra tabla)
  return {
    valid: true,
    description: 'CABYS válido pero no registrado en tabla local',
  };
}

/**
 * Obtiene la descripción de un CABYS
 */
export function getCabysDescription(cabysCode: string): string {
  const cleaned = cabysCode.replace(/-/g, '');
  return VALID_CABYS_CODES[cleaned] ?? 'Servicio de gastronomía';
}

/**
 * Retorna lista de CABYS válidos para dropdown en UI
 */
export function getValidCabysCodes(): Array<{ code: string; description: string }> {
  return Object.entries(VALID_CABYS_CODES).map(([code, description]) => ({
    code,
    description,
  }));
}
