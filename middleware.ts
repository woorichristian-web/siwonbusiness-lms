import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 정적 자원, 이미지, 앱 아이콘 라우트(/icon, /icons/*, /apple-icon) 제외
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|apple-icon|icons|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
