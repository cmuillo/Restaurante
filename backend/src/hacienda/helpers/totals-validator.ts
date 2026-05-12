/**
 * Validador automático de totales e ítems
 * Hacienda 4.4 rechaza comprobantes con errores matemáticos
 * Esta función detecta discrepancias antes de enviar
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface LineValidation {
  lineNumber: number;
  productName: string;
  expectedSubtotal: number;
  actualSubtotal: number;
  expectedWithTax: number;
  actualWithTax: number;
  isValid: boolean;
}

/**
 * Valida totales de un comprobante
 * @param opts.lines - Líneas de detalle con cantidades y precios
 * @param opts.subtotal - Subtotal esperado
 * @param opts.discount - Descuento total aplicado
 * @param opts.taxAmount - Impuesto total esperado
 * @param opts.total - Total final esperado
 * @param opts.tolerance - Tolerancia en centavos (default 0.05)
 */
export function validateTotals(opts: {
  lines: Array<{
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxRate: number;
  }>;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  tolerance?: number;
}): ValidationResult {
  const tolerance = opts.tolerance ?? 0.05;
  const errors: string[] = [];
  const warnings: string[] = [];
  const lineValidations: LineValidation[] = [];

  // Calcular totales esperados línea por línea
  let calculatedSubtotal = 0;
  let calculatedTax = 0;
  let calculatedTotal = 0;

  opts.lines.forEach((line, idx) => {
    const lineNumber = idx + 1;
    const lineSubtotal = line.quantity * line.unitPrice;
    const lineDiscount = line.discount ?? 0;
    const lineAfterDiscount = lineSubtotal - lineDiscount;
    const lineTax = (lineAfterDiscount * line.taxRate) / 100;
    const lineTotal = lineAfterDiscount + lineTax;

    calculatedSubtotal += lineSubtotal;
    calculatedTax += lineTax;
    calculatedTotal += lineTotal;

    lineValidations.push({
      lineNumber,
      productName: `Línea ${lineNumber}`,
      expectedSubtotal: lineSubtotal,
      actualSubtotal: lineSubtotal,
      expectedWithTax: lineTotal,
      actualWithTax: lineTotal,
      isValid: true,
    });
  });

  // Aplicar descuento global
  calculatedSubtotal -= opts.discount;
  calculatedTotal = calculatedSubtotal + calculatedTax;

  // Validar subtotal
  if (Math.abs(calculatedSubtotal - opts.subtotal) > tolerance) {
    errors.push(
      `Subtotal incorrecto: esperado ${calculatedSubtotal.toFixed(2)}, ` +
      `recibido ${opts.subtotal.toFixed(2)}`,
    );
  }

  // Validar impuesto (con tolerancia por redondeo)
  if (Math.abs(calculatedTax - opts.taxAmount) > tolerance * 2) {
    warnings.push(
      `Impuesto aproximado: esperado ~${calculatedTax.toFixed(2)}, ` +
      `recibido ${opts.taxAmount.toFixed(2)} (puede ser por redondeo)`,
    );
  }

  // Validar total
  if (Math.abs(calculatedTotal - opts.total) > tolerance) {
    errors.push(
      `Total incorrecto: esperado ${calculatedTotal.toFixed(2)}, ` +
      `recibido ${opts.total.toFixed(2)}`,
    );
  }

  // Validar que descuento no sea negativo
  if (opts.discount < 0) {
    errors.push('Descuento no puede ser negativo');
  }

  // Validar que no hay negativos en líneas
  opts.lines.forEach((line, idx) => {
    if (line.quantity <= 0) {
      errors.push(`Línea ${idx + 1}: cantidad debe ser > 0`);
    }
    if (line.unitPrice < 0) {
      errors.push(`Línea ${idx + 1}: precio unitario no puede ser negativo`);
    }
    if ((line.discount ?? 0) < 0) {
      errors.push(`Línea ${idx + 1}: descuento no puede ser negativo`);
    }
  });

  // Validar que subtotal + impuesto = total (con tolerancia)
  const expectedTotal = opts.subtotal + opts.taxAmount;
  if (Math.abs(expectedTotal - opts.total) > tolerance) {
    errors.push(
      `Suma de componentes incorrecto: ${opts.subtotal.toFixed(2)} + ` +
      `${opts.taxAmount.toFixed(2)} = ${expectedTotal.toFixed(2)}, ` +
      `pero total es ${opts.total.toFixed(2)}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida que un número sea un decimal válido con máximo 2 decimales
 */
export function validateDecimal(value: number, fieldName: string): { valid: boolean; reason?: string } {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return { valid: false, reason: `${fieldName} no es un número válido` };
  }

  // Verificar que tiene máximo 2 decimales
  const decimals = String(value).split('.')[1]?.length ?? 0;
  if (decimals > 2) {
    return { valid: false, reason: `${fieldName} no puede tener más de 2 decimales` };
  }

  return { valid: true };
}
