const dosDigitos = (n: number) => String(n).padStart(2, '0');
const MS_POR_DIA = 86_400_000;

/** Fecha local como 'AAAA-MM-DD' (no UTC, así "hoy" no se corre de día a la noche). */
export function aFechaISO(d: Date): string {
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}

/** 'AAAA-MM-DD' → Date local. */
export function desdeFechaISO(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA'. */
export function fechaArgentina(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Hora local 'HH:MM' de una fecha. */
export function aHora(d: Date): string {
  return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
}

/** Fecha y hora para mostrar: '21/09/2026 14:30 hs'. */
export function fechaHoraArgentina(valor: string): string {
  const d = new Date(valor);
  return `${d.toLocaleDateString('es-AR')} ${aHora(d)} hs`;
}

export function diasDesde(valor: string): number {
  return Math.floor((Date.now() - new Date(valor).getTime()) / MS_POR_DIA);
}

/** 'hoy', 'hace 1 día', 'hace 9 días'. */
export function antiguedad(valor: string): string {
  const dias = diasDesde(valor);
  if (dias <= 0) return 'hoy';
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}
