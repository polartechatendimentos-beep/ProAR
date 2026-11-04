"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (value: number) => void;
};

export function CurrencyInput({ value, onValueChange, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [display, setDisplay] = useState(() => formatMoneyInput(value));

  useEffect(() => {
    setDisplay(formatMoneyInput(value));
  }, [value]);

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={display}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const nextValue = parseMoneyInput(event.currentTarget.value);
        setDisplay(formatMoneyInput(nextValue));
        onValueChange(nextValue);
        requestAnimationFrame(() => {
          const input = inputRef.current;
          if (input) input.setSelectionRange(input.value.length, input.value.length);
        });
      }}
    />
  );
}
