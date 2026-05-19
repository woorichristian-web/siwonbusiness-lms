"use client";

import { useEffect, useState } from "react";

/**
 * 휴대폰 번호 입력 — 숫자만 타이핑하면 자동으로 하이픈(-) 삽입.
 *   사용자: 01012345678
 *   화면 :  010-1234-5678
 *   부모  :  "010-1234-5678" (하이픈 포함된 문자열)
 *
 * 9~11자리까지 허용 (모바일 010-xxxx-xxxx 기준).
 */
export default function PhoneInput({
  value,
  onChange,
  required,
  className,
  placeholder,
}: {
  value: string;
  onChange: (formatted: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [digits, setDigits] = useState(() => toDigits(value));

  useEffect(() => {
    setDigits(toDigits(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
    setDigits(raw);
    onChange(digitsToPhone(raw));
  }

  return (
    <input
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      placeholder={placeholder ?? "010-1234-5678"}
      maxLength={13}                 // 11자리 + 하이픈 2개
      required={required}
      className={"input tracking-wider " + (className ?? "")}
      value={digitsToPhone(digits)}
      onChange={handleChange}
    />
  );
}

function toDigits(s: string): string {
  return (s || "").replace(/\D/g, "").slice(0, 11);
}

function digitsToPhone(d: string): string {
  if (d.length === 0) return "";
  if (d.length <= 3) return d;
  if (d.length <= 7) return d.slice(0, 3) + "-" + d.slice(3);
  return d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7);
}
