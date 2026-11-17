import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { UserAccessState } from '../../api/userDTO';
import dotsVertical from './../../assets/pacs/icons/dots-vertical-inactive.png';
import type { MemberAccessAction } from './MemberAccessConfirmationDialog';
import { getMemberAccessEligibility, type MemberAccessIdentity } from './memberAccessPolicy';

export interface MemberActionsTarget extends MemberAccessIdentity {
  name: string;
  email: string;
}

export interface MemberActionsMenuProps {
  actor: MemberAccessIdentity | null;
  target: MemberActionsTarget;
  onEdit: () => void;
  onDelete: () => void;
  onAccessChange: (action: MemberAccessAction) => void;
}

export default function MemberActionsMenu({
  actor,
  target,
  onEdit,
  onDelete,
  onAccessChange,
}: MemberActionsMenuProps) {
  const { t } = useTranslation('Members');
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const eligibility = getMemberAccessEligibility(actor, target);
  const accessAction: MemberAccessAction | null =
    target.accessState === UserAccessState.ACTIVE
      ? 'suspend'
      : target.accessState === UserAccessState.SUSPENDED
        ? 'reactivate'
        : null;
  const showAccessAction = eligibility.allowed && accessAction !== null;

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.getBoundingClientRect().height ?? 0;
    const spaceBelow = window.innerHeight - rect.bottom;
    setMenuPosition({
      top: spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom,
      left: Math.max(8, rect.right - 176),
    });
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [isOpen, showAccessAction]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const targetNode = event.target;
      if (
        targetNode instanceof Node &&
        !triggerRef.current?.contains(targetNode) &&
        !menuRef.current?.contains(targetNode)
      ) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('pointerdown', closeOnOutsidePointer, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const closeAndRun = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const menu = (
    <div
      id={menuId}
      ref={menuRef}
      role="menu"
      aria-label={t('Actions for {{member}}', { member: target.name || target.email })}
      className="fixed z-50 w-44 overflow-hidden rounded-lg bg-[#4C504B] text-sm text-white shadow-lg"
      style={{ top: menuPosition.top, left: menuPosition.left }}
      onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          return;
        }

        event.preventDefault();
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []
        );
        const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
        const nextIndex =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : event.key === 'ArrowDown'
                ? (currentIndex + 1) % items.length
                : (currentIndex - 1 + items.length) % items.length;
        items[nextIndex]?.focus();
      }}
    >
      <button
        type="button"
        role="menuitem"
        className="block w-full px-4 py-2 text-left hover:bg-gray-700 focus:bg-gray-700 focus:outline-none"
        onClick={() => closeAndRun(onEdit)}
      >
        {t('Edit')}
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full border-t border-white border-opacity-10 px-4 py-2 text-left hover:bg-gray-700 focus:bg-gray-700 focus:outline-none"
        onClick={() => closeAndRun(onDelete)}
      >
        {t('Delete')}
      </button>
      {showAccessAction && (
        <button
          type="button"
          role="menuitem"
          className={`block w-full border-t border-white border-opacity-10 px-4 py-2 text-left hover:bg-gray-700 focus:bg-gray-700 focus:outline-none ${
            accessAction === 'suspend' ? 'text-[#FF9A9A]' : 'text-[#8BE397]'
          }`}
          onClick={() => closeAndRun(() => onAccessChange(accessAction))}
        >
          {t(accessAction === 'suspend' ? 'Suspend access' : 'Reactivate access')}
        </button>
      )}
    </div>
  );

  return (
    <div className="relative flex items-center justify-center">
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('Actions for {{member}}', { member: target.name || target.email })}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen(open => !open)}
      >
        <img
          src={dotsVertical}
          alt=""
        />
      </button>
      {isOpen && ReactDOM.createPortal(menu, document.body)}
    </div>
  );
}
