import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://hycfpahheivqrhlgkbwj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZuN9ZAQMy3RbqlatHzFfpw_4Hm9Zq2d';

const isWeb = Platform.OS === 'web';
const hasWindow = typeof window !== 'undefined';

const webStorage = {
  getItem: async (key: string) => (hasWindow ? window.localStorage.getItem(key) : null),
  setItem: async (key: string, value: string) => {
    if (hasWindow) window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (hasWindow) window.localStorage.removeItem(key);
  },
};

const authStorage = isWeb ? webStorage : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: !isWeb || hasWindow,
    persistSession: !isWeb || hasWindow,
    detectSessionInUrl: isWeb,
  },
});

