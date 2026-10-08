import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';
import { Boton, HojaModal } from '../ui';

const dos = (n: number) => String(n).padStart(2, '0');

/** Hora en formato reloj de 24 hs. Guarda el valor como 'HH:MM'. */
export function CampoHora({ valor, onCambiar }: { valor: string; onCambiar: (v: string) => void }) {
  const { colores, tema } = useTema();
  const [abierto, setAbierto] = useState(false);

  const fecha = new Date();
  if (valor) {
    const [h, m] = valor.split(':').map(Number);
    fecha.setHours(h, m, 0, 0);
  }

  const alCambiar = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setAbierto(false);
    if (e.type === 'set' && d) onCambiar(`${dos(d.getHours())}:${dos(d.getMinutes())}`);
  };

  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel="Horario del hecho"
        style={{ paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.3, borderColor: colores.borde, backgroundColor: colores.superficie }}
      >
        <Text style={{ fontSize: 14.5, color: valor ? colores.texto : colores.textoTenue }}>{valor ? `${valor} hs` : '--:-- hs'}</Text>
      </Pressable>

      {abierto && Platform.OS === 'android' && (
        <DateTimePicker value={fecha} mode="time" display="clock" is24Hour onChange={alCambiar} />
      )}

      {Platform.OS === 'ios' && (
        <HojaModal visible={abierto} onCerrar={() => setAbierto(false)}>
          <DateTimePicker
            value={fecha}
            mode="time"
            display="spinner"
            locale="es-AR"
            is24Hour
            themeVariant={tema === 'oscuro' ? 'dark' : 'light'}
            onChange={alCambiar}
            style={{ alignSelf: 'center' }}
          />
          <Boton
            titulo="Listo"
            onPress={() => {
              if (!valor) onCambiar(`${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`);
              setAbierto(false);
            }}
          />
        </HojaModal>
      )}
    </>
  );
}
