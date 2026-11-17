import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ModalityBadgesProps = {
  modalities: string[];
};

const ModalityBadges = ({ modalities }: ModalityBadgesProps) => {
  const visible = modalities.slice(0, 3);
  const overflow = modalities.slice(3);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const badgeRef = useRef<HTMLSpanElement>(null);

  const getTooltipPosition = () => {
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      return {
        top: `${rect.top - 8}px`,
        left: `${rect.left + rect.width / 2}px`,
        transform: 'translate(-50%, -100%)',
      };
    }
    return {};
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map(mod => (
        <span
          key={mod}
          className="rounded-full bg-white bg-opacity-10 px-2 py-0.5 text-xs text-white"
        >
          {mod}
        </span>
      ))}
      {overflow.length > 0 && (
        <>
          <span
            ref={badgeRef}
            className="cursor-default rounded-full bg-white bg-opacity-10 px-2 py-0.5 text-xs text-white"
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
          >
            {overflow.length + 3}+
          </span>
          {tooltipVisible &&
            createPortal(
              <div
                className="fixed z-[9999] rounded-lg border border-white border-opacity-10 bg-[#1e2320] p-2 shadow-lg"
                style={getTooltipPosition()}
              >
                <div className="flex flex-wrap gap-1">
                  {overflow.map(mod => (
                    <span
                      key={mod}
                      className="rounded-full bg-white bg-opacity-10 px-2 py-0.5 text-xs text-white"
                    >
                      {mod}
                    </span>
                  ))}
                </div>
              </div>,
              document.body
            )}
        </>
      )}
    </div>
  );
};

export default ModalityBadges;
