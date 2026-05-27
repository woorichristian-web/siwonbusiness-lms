"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/constants";

/**
 * Self-service password reset.
 * Verification: username + name + birth date must all match the user's profile.
 * If matched, the password is updated via service role.
 *
 * For higher security, integrate email/SMS OTP later.
 */
export async function resetPasswordBySelfVerify(input: {
  username: string;
  name: string;
  birth_date: string;       // YYYY-MM-DD
  new_password: string;
}) {
  const username = input.username.trim().toLowerCase();
  const name = input.name.trim();
  const birth = input.birth_date.trim();
  const newPassword = input.new_password;

  if (!username || !name || !birth) {
    return { ok: false, error: "아이디·이름·생년월일을 모두 입력해주세요." };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: "새 비밀번호는 8자 이상이어야 합니다." };
  }

  const admin = createAdminClient();

  // 1) Look up profile by username
  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("id, name, birth_date, username")
    .eq("username", username)
    .maybeSingle();
  if (pErr) return { ok: false, error: "조회 중 오류가 발생했습니다." };
  if (!profile) return { ok: false, error: "일치하는 회원을 찾을 수 없습니다." };

  // 2) Verify name + birth date
  // Compare name case-insensitively, trimmed
  const profileName = (profile.name || "").trim();
  if (profileName.toLowerCase() !== name.toLowerCase()) {
    return { ok: false, error: "정보가 일치하지 않습니다. (이름 확인)" };
  }
  if (!profile.birth_date) {
    return { ok: false, error: "이 계정은 생년월일이 등록되어 있지 않아 본인 확인을 할 수 없습니다. 관리자에게 문의하세요." };
  }
  if (profile.birth_date !== birth) {
    return { ok: false, error: "정보가 일치하지 않습니다. (생년월일 확인)" };
  }

  // 3) Update password via admin API
  const { error: uErr } = await admin.auth.admin.updateUserById(profile.id, {
    password: newPassword,
  });
  if (uErr) return { ok: false, error: "비밀번호 변경 실패: " + uErr.message };

  return { ok: true };
}
