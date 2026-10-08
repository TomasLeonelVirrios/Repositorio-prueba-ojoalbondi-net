import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';
import { aFechaISO, desdeFechaISO, fechaArgentina } from '../../utilidades/fechas';
import { Boton, HojaModal } from '../ui';

/** Equivale a <input type="date" max="hoy">. Guarda el valor como 'AAAA-MM-DD'. */
export function CampoFecha({ valor, onCambiar, placeholder = 'dd/mm/aaaa' }: { valor: string; onCambiar: (v: string) => void; placeholder?: string }) {
  const { colores, tema } = useTema();
  const [abierto, setAbierto] = useState(false);
  const hoy = new Date();
  const fecha = valor ? desdeFechaISO(valor) : hoy;

  const alCambiar = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setAbierto(false);
    if (e.type === 'set' && d) onCambiar(aFechaISO(d));
  };

  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        style={{ paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.3, borderColor: colores.borde, backgroundColor: colores.superficie }}
      >
        <Text style={{ fontSize: 14.5, color: valor ? colores.texto : colores.textoTenue }}>{valor ? fechaArgentina(valor) : placeholder}</Text>
      </Pressable>

      {abierto && Platform.OS === 'android' && (
        <DateTimePicker value={fecha} mode="date" maximumDate={hoy} onChange={alCambiar} />
      )}

      {Platform.OS === 'ios' && (
        <HojaModal visible={abierto} onCerrar={() => setAbierto(false)}>
          <DateTimePicker
            value={fecha}
            mode="date"
            display="inline"
            locale="es-AR"
            maximumDate={hoy}
            themeVariant={tema === 'oscuro' ? 'dark' : 'light'}
            onChange={alCambiar}
          />
          <Boton titulo="Listo" onPress={() => { if (!valor) onCambiar(aFechaISO(fecha)); setAbierto(false); }} />
        </HojaModal>
      )}
    </>
  );
}
