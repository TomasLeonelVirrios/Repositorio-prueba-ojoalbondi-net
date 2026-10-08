import { useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';

/** Campo de texto con el estilo de la app y borde resaltado al enfocarlo. */
export function Campo(props: TextInputProps) {
  const { colores } = useTema();
  const [enfocado, setEnfocado] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colores.textoTenue}
      {...props}
      onFocus={(e) => { setEnfocado(true); props.onFocus?.(e); }}
      onBlur={(e) => { setEnfocado(false); props.onBlur?.(e); }}
      style={[
        {
          width: '100%', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10,
          borderWidth: enfocado ? 2 : 1.3, borderColor: enfocado ? colores.primario : colores.borde,
          backgroundColor: colores.superficie, color: colores.texto, fontSize: 14.5,
        },
        props.multiline && { minHeight: 70, textAlignVertical: 'top' },
        props.style,
      ]}
    />
  );
}
