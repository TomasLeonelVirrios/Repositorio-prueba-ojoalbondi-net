/**
 * Identificador único (UUID v4) generado en el celular.
 * El reclamo lo lleva desde que se crea, así reenviar un borrador no lo duplica en la base.
 */
export function nuevoId(): string {
  const cripto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cripto?.randomUUID) return cripto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
