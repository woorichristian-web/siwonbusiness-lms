import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

// 로그인 후 진입점. 역할에 따라 분기.
export default async function DashboardPage() {
  const profile = await requireProfile();

  switch (profile.role) {
    case "admin":
      redirect("/admin");
    case "teacher":
      redirect("/teacher/schedule");
    case "student":
    default:
      redirect("/student/calendar");
  }
}
