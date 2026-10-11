import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTema } from '../../contextos/TemaContexto';

/** Contenedor estándar de pantalla: márgenes, área segura, teclado y desplazamiento. */
export function Pantalla({ children, desplazable = true, centrado = false }: {
  children: ReactNode;
  desplazable?: boolean;
  centrado?: boolean;
}) {
  const { colores } = useTema();
  const contenido: ViewStyle = {
    flexGrow: 1, padding: 20, paddingBottom: 40, width: '100%', maxWidth: 460, alignSelf: 'center',
    ...(centrado && { alignItems: 'center', justifyContent: 'center' }),
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colores.fondo }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {desplazable ? (
          <ScrollView contentContainerStyle={contenido} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        ) : (
          <View style={contenido}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
