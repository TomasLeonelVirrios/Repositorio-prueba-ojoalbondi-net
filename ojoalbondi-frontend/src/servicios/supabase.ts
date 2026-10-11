import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// URL y clave pública del proyecto, desde el archivo .env (ver .env.example)
const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const clavePublica = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, clavePublica, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

/** Bucket privado donde se guardan las fotos de los reclamos. */
export const BUCKET_FOTOS = 'fotos-reclamos';

// Refrescar la sesión solo mientras la app está en primer plano (recomendación de Supabase para React Native)
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
