// 강사 화면 언어 (English / 한국어) — 쿠키 기반.
// 서버 컴포넌트에서 getTeacherLang() 으로 읽고, 클라이언트 토글이 쿠키를 바꾼 뒤 refresh 한다.
import { cookies } from "next/headers";

export type TeacherLang = "en" | "ko";

export function getTeacherLang(): TeacherLang {
  try {
    return cookies().get("teacher_lang")?.value === "ko" ? "ko" : "en";
  } catch {
    return "en";
  }
}
