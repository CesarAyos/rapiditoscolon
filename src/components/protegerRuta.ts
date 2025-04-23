import { supabase } from '../components/supabase';

export async function protegerRuta(): Promise<boolean> {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    window.location.href = '/auth';
    return false;
  }
  
  return true;
}