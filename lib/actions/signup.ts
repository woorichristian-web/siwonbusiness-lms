"use server";

// 공개 회원가입 서버 액션 — admin client 로 auth.admin.createUser 호출하여
// 이메일 확인 단계를 자동으로 건너뛴다 (우리는 합성 이메일을 쓰므로 메일 발송 불가).
// 보안상 role 은 무조건 'student' 로 강제.

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/constants";

export interface PublicSignupInput {
  name: string;
  birth_date: string;
  username: string;
  password: string;
  company_name: string;
  phone?: string;
  residence_area?: string;
  industry?: string;
  job_role?: string;
  learning_purpose?: string;
  preferred_format: string[];
  preferred_time: string[];
}

export async function publicSignup(input: PublicSignupInput) {
  if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(input.username))
    return { ok: false, error: "아이디는 영문/숫자/._- 조합 3~20자입니다." };
  if (input.password.length < 8)
    return { ok: false, error: "비밀번호는 8자 이상이어야 합니다." };
  if (!input.name || !input.birth_date || !input.company_name)
    return { ok: false, error: "이름·생년월일·회사명은 필수입니다." };

  const admin = createAdminClient();
  const email = usernameToEmail(input.username);

  // 1) auth user 생성 + 자동 이메일 확인
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (authErr || !created.user) {
    if (authErr?.message?.toLowerCase().includes("already")) {
      return { ok: false, error: "이미 사용 중인 아이디입니다." };
    }
    return { ok: false, error: authErr?.message ?? "회원가입 실패" };
  }

  // 2) profile insert (role 은 무조건 student)
  const { error: pErr } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "student",
    username: input.username.trim().toLowerCase(),
    name: input.name.trim(),
    birth_date: input.birth_date,
    company_name: input.company_name.trim(),
    phone: input.phone?.trim() || null,
    residence_area: input.residence_area || null,
    industry: input.industry || null,
    job_role: input.job_role || null,
    learning_purpose: input.learning_purpose || null,
    preferred_format: input.preferred_format,
    preferred_time: input.preferred_time,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: "프로필 저장 중 오류: " + pErr.message };
  }

  // 3) 방금 만든 계정으로 자동 로그인 (사용자 세션 쿠키 설정)
  const supabase = createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (signInErr) {
    return { ok: true, autoLogin: false }; // 가입은 됐으니 로그인 화면으로 안내
  }

  return { ok: true, autoLogin: true };
}
