export type ParsedFormError = {
  global: string;
  fields: Record<string, string>;
};

const KNOWN_FIELDS = [
  'name', 'email', 'phone', 'password', 'role', 'number', 'capacity', 'location',
  'address', 'unit', 'currentStock', 'minimumStock', 'minStock', 'costPerUnit',
  'quantity', 'type', 'notes', 'description', 'price', 'sku', 'categoryId',
  'sortOrder', 'isActive', 'tableId', 'branchId', 'productId',
];

function toFriendlyLine(line: string): string {
  if (!line) return 'Dato invalido.';

  if (line.includes('must be an email')) return 'Debe ser un email valido.';
  if (line.includes('must be a UUID') || line.includes('uuid is expected')) return 'Formato invalido.';
  if (line.includes('must be a string')) return 'Debe ser texto.';
  if (line.includes('must be a number') || line.includes('must be a positive number')) return 'Debe ser numerico.';
  if (line.includes('must be an integer number')) return 'Debe ser un numero entero.';
  if (line.includes('should not be empty')) return 'Este campo es obligatorio.';
  if (line.includes('must be one of the following values')) return 'Valor no permitido.';
  if (line.includes('must be longer than')) return 'Es demasiado corto.';
  if (line.includes('must be shorter than') || line.includes('must be shorter or equal')) return 'Es demasiado largo.';
  if (line.includes('already exists') || line.includes('duplicate key value')) return 'Ya existe un registro con este dato.';

  return line;
}

function detectField(line: string): string | null {
  const found = KNOWN_FIELDS.find((f) => line.toLowerCase().includes(f.toLowerCase()));
  return found ?? null;
}

export function parseApiFormErrors(error: any): ParsedFormError {
  const payload = error?.response?.data;
  const raw = payload?.message;
  const fields: Record<string, string> = {};
  let global = '';

  const lines: string[] = Array.isArray(raw)
    ? raw.map((x) => String(x))
    : raw
      ? [String(raw)]
      : [String(error?.message ?? 'Ocurrio un error inesperado.')];

  for (const line of lines) {
    const field = detectField(line);
    const friendly = toFriendlyLine(line);

    if (field) {
      if (!fields[field]) fields[field] = friendly;
    } else if (!global) {
      global = friendly;
    }
  }

  if (!global && Object.keys(fields).length === 0) {
    global = 'Revisa los datos ingresados e intenta de nuevo.';
  }

  return { global, fields };
}
