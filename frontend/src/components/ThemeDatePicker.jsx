import React from "react";
import { format, parse } from "date-fns";
import { Calendar as CalIcon } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/**
 * Coffee-themed compact date picker.
 * value: "YYYY-MM-DD" string
 * onChange: (str) => void
 */
export default function ThemeDatePicker({ value, onChange, disabled, max, min, testid, className = "" }) {
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const maxDate = max ? parse(max, "yyyy-MM-dd", new Date()) : undefined;
  const minDate = min ? parse(min, "yyyy-MM-dd", new Date()) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled}
          className={`inline-flex items-center gap-2 rounded-xl border border-amber-900/20 bg-white px-3 py-2 text-sm text-[#2C241B] hover:border-[#8B5A2B] focus:outline-none focus:ring-2 focus:ring-[#8B5A2B]/20 transition-colors disabled:opacity-50 ${className}`}
          data-testid={testid}>
          <CalIcon size={14} className="text-[#8B5A2B]" />
          {parsed ? format(parsed, "d MMM yyyy") : "Pick a date"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-amber-900/15 rounded-xl shadow-xl" align="start">
        <Calendar mode="single" selected={parsed}
          onSelect={(d) => d && onChange(format(d, "yyyy-MM-dd"))}
          disabled={(d) => (maxDate && d > maxDate) || (minDate && d < minDate)}
          initialFocus />
      </PopoverContent>
    </Popover>
  );
}
