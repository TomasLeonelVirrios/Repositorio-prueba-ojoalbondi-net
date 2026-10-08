import { ReactNode } from 'react';
import { Modal, Pressable } from 'react-native';
import { useTema } from '../../contextos/TemaContexto';

/** Hoja que sube desde abajo; se cierra tocando afuera. */
export function HojaModal({ visible, onCerrar, children }: { visible: boolean; onCerrar: () => void; children: ReactNode }) {
  const { colores } = useTema();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' }} onPress={onCerrar}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colores.superficie, width: '100%', maxWidth: 460, alignSelf: 'center',
            borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, maxHeight: '80%',
          }}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
