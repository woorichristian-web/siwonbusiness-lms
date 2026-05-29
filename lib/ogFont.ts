// OG 이미지(아이콘/스플래시) 생성 시 satori 에 임베드할 Pretendard Bold 폰트 로더.
// satori 기본 폰트는 Inter 뿐이므로, 한글·영문 로고에 Pretendard 를 쓰려면
// 폰트 데이터를 직접 넘겨줘야 한다. 네트워크 실패 시 null 을 반환해 기본 폰트로 폴백한다.

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf";

let cache: ArrayBuffer | null = null;

export async function pretendardBold(): Promise<ArrayBuffer | null> {
  if (cache) return cache;
  try {
    const res = await fetch(FONT_URL, { cache: "force-cache" });
    if (!res.ok) return null;
    cache = await res.arrayBuffer();
    return cache;
  } catch {
    return null;
  }
}
