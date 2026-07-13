import React from 'react';

type OnboardingToggleProps = {
  checked: boolean;
  onToggle: (next: boolean) => void;
  id: string;
  disabled?: boolean;
};

const OnboardingToggle = ({
  checked,
  onToggle,
  id,
  disabled = false,
}: OnboardingToggleProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-busy={disabled}
    id={id}
    disabled={disabled}
    onClick={() => {
      if (!disabled) {
        onToggle(!checked);
      }
    }}
    className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6ED47C] disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? 'bg-gradient-to-r from-[#C8F469] to-[#05905E]' : 'bg-white bg-opacity-20'
    }`}
  >
    <span
      className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-0'
      }`}
    />
  </button>
);

export default OnboardingToggle;
