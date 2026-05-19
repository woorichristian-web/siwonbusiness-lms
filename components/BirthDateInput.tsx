"use client";

import { useEffect, useState } from "react";

/**
 * 생년월일 입력 — 한 개의 입력칸에 8자리를 연속으로 타이핑.
 * 슬래시(/)는 자동 삽입.
 *
 *   사용자가 타이핑: 1 9 8 0 0 9 1 5
 *   화면 표시:        1 → 19 → 198 → 1980 → 1980/0 → 1980/09 → 1980/09/1 → 1980/09/15
 *   부모 onChange:    "" (미완성)  ...  "1980-09-15" (8자리 완성)
 */
export default function BirthDateInput({
  value,
  onChange,
  required,
  className,
}: {
  value: string;                 // ISO 'YYYY-MM-DD' or ''
  onChange: (iso: string) => void;
  required?: boolean;
  className?: string;
}) {
  const [digits, setDigits] = useState(() => isoToDigits(value));

  // 부모가 value 를 외부에서 바꾸면 내부 상태 동기화
  useEffect(() => {
    setDigits(isoToDigits(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8); // 숫자만, 최대 8자리
    setDigits(raw);
    onChange(digitsToIso(raw));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="bday"
      placeholder="YYYY/MM/DD"
      maxLength={10}                 // 8자리 + 슬래시 2개
      required={required}
      className={"input tracking-widest " + (className ?? "")}
      value={formatDisplay(digits)}
      onChange={handleChange}
    />
  );
}

function isoToDigits(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return m[1] + m[2] + m[3];
}

function digitsToIso(d: string): string {
  if (d.length !== 8) return "";
  const y = d.slice(0, 4);
  const mo = d.slice(4, 6);
  const da = d.slice(6, 8);
  // 단순 범위 검증 — 잘못된 월/일이면 빈 문자열 반환
  const moN = Number(mo);
  const daN = Number(da);
  if (moN < 1 || moN > 12) return "";
  if (daN < 1 || daN > 31) return "";
  return `${y}-${mo}-${da}`;
}

function formatDisplay(d: string): string {
  let out = d.slice(0, 4);
  if (d.length > 4) out += "/" + d.slice(4, 6);
  if (d.length > 6) out += "/" + d.slice(6, 8);
  return out;
}
