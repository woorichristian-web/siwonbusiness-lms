// 서버 컴포넌트/액션에서 사용하는 공통 헬퍼.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "./types";

/**
 * 현재 로그인된 사용자의 profile 을 반환.
 * 로그인 안 됐으면 /login 으로, profile 없으면 /signup 으로 리다이렉트.
 */
export async function requireProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/signup");
  return profile;
}

/**
 * 특정 역할만 접근 허용.
 */
export async function requireRole(roles: Role[]) {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    redirect("/dashboard");
  }
  return profile;
}
