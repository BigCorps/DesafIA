import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createNotificationHandler } from './delivery.js';

const client = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', {
  auth: { persistSession: false, autoRefreshToken: false }, db: { schema: 'desafia' }
});
Deno.serve(createNotificationHandler({
  env: (name: string) => Deno.env.get(name),
  rpc: async (name: string, args = {}) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error('notification_database_failed');
    return data;
  }
}));
