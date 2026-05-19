// 서비스 롤 키를 사용하는 Supabase 클라이언트. 절대 클라이언트로 노출 금지.
// 관리자가 다른 사용자를 생성하는 경우 등 권한 우회가 필요한 경우만 사용.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다. .env.local 을 확인하세요."
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
