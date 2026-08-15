import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import userRepository from '../../api/userRepository';
import tenantRepository from '../../api/tenantRepository';
import repository from '../../api/repository';
import type { UserResponse } from '../../api/userDTO';
import type { GetTenantInfoResponse } from '../../api/tenantDTO';
import type { GetAPIInfoResponse } from '../../api/dto';
import { FrontendVersionContext } from '../../App';
import { logoutUser } from '../../service/userService';
import logoIcon from '../../assets/pacs/logo/pacs-ai-icon-logo.png';
import InferenceNotificationsBell from '../inference/InferenceNotificationsBell';
import {
  getStudiesDestination,
  getTopNavigationItems,
  isTopNavigationItemActive,
  type TopNavigationItem,
} from './navigationModel';

export interface TopNavigationProps {
  title: string;
  accessory?: React.ReactNode;
}

interface MenuState {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  menuRef: React.RefObject<HTMLDivElement>;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

const getEnabledMenuItems = (menu: HTMLDivElement | null): HTMLElement[] =>
  Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []).filter(
    item => item.getAttribute('aria-disabled') !== 'true'
  );

const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
  const items = getEnabledMenuItems(event.currentTarget);
  if (!items.length) {
    return;
  }

  const currentIndex = items.indexOf(document.activeElement as HTMLElement);
  let nextIndex: number | null = null;

  if (event.key === 'ArrowDown') {
    nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
  } else if (event.key === 'ArrowUp') {
    nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = items.length - 1;
  }

  if (nextIndex != null) {
    event.preventDefault();
    items[nextIndex].focus();
  }
};

const useNavigationMenu = (): MenuState => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    getEnabledMenuItems(menuRef.current)[0]?.focus();

    const closeOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('pointerdown', closeOnPointerDown, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnPointerDown, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return { open, setOpen, menuRef, triggerRef };
};

const navigationLinkClassName = (active: boolean): string =>
  `inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b1f1a] ${
    active ? 'bg-primary-main text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'
  }`;

const menuItemClassName =
  'block w-full rounded-md px-3 py-2 text-left text-sm text-white/80 outline-none hover:bg-white/10 focus:bg-white/10 focus:text-white focus-visible:ring-2 focus-visible:ring-primary-main';

const DesktopNavigationItem = ({
  item,
  pathname,
  destination,
  label,
  comingSoonLabel,
  opensInNewTabLabel,
}: {
  item: TopNavigationItem;
  pathname: string;
  destination?: string;
  label: string;
  comingSoonLabel: string;
  opensInNewTabLabel: string;
}) => {
  if (item.disabled) {
    return (
      <span
        className="min-h-10 text-white/35 inline-flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
        aria-disabled="true"
        title={comingSoonLabel}
      >
        {label}
        <span className="border-white/15 rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
          {comingSoonLabel}
        </span>
      </span>
    );
  }

  const active = isTopNavigationItemActive(item, pathname);
  return (
    <Link
      to={destination ?? item.to ?? '/'}
      className={navigationLinkClassName(active)}
      aria-current={active ? 'page' : undefined}
      target={item.opensInNewTab ? '_blank' : undefined}
      rel={item.opensInNewTab ? 'noreferrer' : undefined}
      data-tour-id={item.key === 'ai-models' ? 'nav-ai-models' : undefined}
    >
      {label}
      {item.opensInNewTab && <span className="sr-only"> ({opensInNewTabLabel})</span>}
    </Link>
  );
};

export function TopNavigation({ title, accessory }: TopNavigationProps) {
  const { t } = useTranslation('TopNavigation');
  const navigate = useNavigate();
  const location = useLocation();
  const frontendVersion = useContext(FrontendVersionContext);
  const accountMenu = useNavigationMenu();
  const mobileMenu = useNavigationMenu();
  const { setOpen: setAccountMenuOpen } = accountMenu;
  const { setOpen: setMobileMenuOpen } = mobileMenu;
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});
  const [apiInfo, setAPIInfo] = useState<Partial<GetAPIInfoResponse>>({});
  const tenantId = localStorage.getItem('tenantId') || '';

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      userRepository.GetCurrentUser(),
      tenantRepository.GetTenantInfo().catch(() => null),
      repository.GetAPIInfo().catch(() => null),
    ])
      .then(([userResponse, tenantResponse, apiResponse]) => {
        if (cancelled) {
          return;
        }

        const user = userResponse.data;
        setCurrentUser(user);
        if (tenantResponse) {
          setTenantInfo(tenantResponse.data);
        }
        if (apiResponse) {
          setAPIInfo(apiResponse.data);
        }

        if (
          !user.isConsentSigned &&
          tenantResponse?.data.onboardingEnableConsent !== false &&
          !location.pathname.includes('/user/consent')
        ) {
          navigate('/user/consent', { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          logoutUser(navigate, tenantId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate, tenantId]);

  useEffect(() => {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname, location.search, setAccountMenuOpen, setMobileMenuOpen]);

  const navigationItems = useMemo(
    () => getTopNavigationItems(location.pathname, currentUser?.role),
    [currentUser?.role, location.pathname]
  );
  const studiesDestination = getStudiesDestination(location.pathname, location.search);
  const userName = currentUser?.name?.trim() || t('User');
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
  const tenantLabel = tenantInfo.name || tenantId;

  const getDestination = (item: TopNavigationItem): string | undefined =>
    item.key === 'studies' ? studiesDestination : item.to;

  const renderMobileNavigationItem = (item: TopNavigationItem) => {
    const label = t(item.label);
    if (item.disabled) {
      return (
        <span
          key={item.key}
          role="menuitem"
          aria-disabled="true"
          className="text-white/35 flex w-full cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm"
        >
          {label}
          <span className="text-[10px] uppercase tracking-wide">{t('Coming soon')}</span>
        </span>
      );
    }

    const active = isTopNavigationItemActive(item, location.pathname);
    return (
      <Link
        key={item.key}
        role="menuitem"
        to={getDestination(item) ?? '/'}
        target={item.opensInNewTab ? '_blank' : undefined}
        rel={item.opensInNewTab ? 'noreferrer' : undefined}
        aria-current={active ? 'page' : undefined}
        className={`${menuItemClassName} ${active ? 'bg-primary-main text-black' : ''}`}
        onClick={() => mobileMenu.setOpen(false)}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full shrink-0 border-b border-white/10 bg-[#1b1f1a] shadow-lg shadow-black/20">
      <div className="flex h-16 w-full items-center gap-3 px-4 sm:px-5 lg:px-7">
        <Link
          to={studiesDestination}
          className="focus-visible:ring-primary-main flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2"
          aria-label={t('PACS-AI studies')}
        >
          <img
            src={logoIcon}
            alt=""
            className="h-8 w-8"
          />
          <span className="hidden text-base font-bold tracking-wide text-white sm:block">
            PACS-AI
          </span>
        </Link>

        <div className="bg-white/15 hidden h-7 w-px shrink-0 sm:block" />

        <div className="sm:max-w-44 lg:max-w-56 min-w-0">
          <h1 className="truncate text-sm font-semibold text-white sm:text-base">{t(title)}</h1>
          <p className="hidden truncate text-xs text-white/50 sm:block xl:hidden">{tenantLabel}</p>
        </div>

        <div className="hidden min-w-0 xl:block">
          <p className="truncate text-xs font-medium text-white/80">{tenantInfo.name}</p>
          <p className="text-white/45 truncate text-[10px]">{tenantInfo.id || tenantId}</p>
        </div>

        <nav
          className="ml-1 hidden min-w-0 items-center gap-1 lg:flex"
          aria-label={t('Primary navigation')}
          data-testid="desktop-navigation"
        >
          {navigationItems.map(item => (
            <DesktopNavigationItem
              key={item.key}
              item={item}
              pathname={location.pathname}
              destination={getDestination(item)}
              label={t(item.label)}
              comingSoonLabel={t('Coming soon')}
              opensInNewTabLabel={t('Opens in new tab')}
            />
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {accessory}
          <InferenceNotificationsBell />

          <div className="relative hidden lg:block">
            <button
              ref={accountMenu.triggerRef}
              type="button"
              className="min-h-10 focus-visible:ring-primary-main flex items-center gap-2 rounded-lg px-2 text-left text-white outline-none hover:bg-white/10 focus-visible:ring-2"
              onClick={() => {
                mobileMenu.setOpen(false);
                accountMenu.setOpen(open => !open);
              }}
              aria-label={t('Account menu')}
              aria-haspopup="menu"
              aria-expanded={accountMenu.open}
            >
              <span className="text-primary-main flex h-8 w-8 items-center justify-center rounded-full bg-[#39413a] text-xs font-bold">
                {initials || 'U'}
              </span>
              <span className="max-w-32 hidden lg:block">
                <span className="block truncate text-xs font-semibold text-white/90">
                  {userName}
                </span>
                <span className="text-white/45 block truncate text-[10px]">{tenantLabel}</span>
              </span>
            </button>

            {accountMenu.open && (
              <div
                ref={accountMenu.menuRef}
                role="menu"
                aria-label={t('Account menu')}
                className="absolute right-0 top-full mt-2 w-60 rounded-lg border border-white/10 bg-[#2a2e2a] p-2 shadow-2xl"
                onKeyDown={handleMenuKeyDown}
                data-testid="account-menu"
              >
                <div className="border-b border-white/10 px-3 pb-2 pt-1">
                  <p className="truncate text-sm font-semibold text-white">{userName}</p>
                  <p className="truncate text-xs text-white/50">{tenantLabel}</p>
                </div>
                <Link
                  role="menuitem"
                  to="/settings"
                  className={`${menuItemClassName} mt-1`}
                  onClick={() => accountMenu.setOpen(false)}
                >
                  {t('Settings')}
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  className={menuItemClassName}
                  onClick={() => logoutUser(navigate, tenantId, false)}
                >
                  {t('Logout')}
                </button>
                <div className="mt-1 border-t border-white/10 px-3 pt-2 text-[10px] text-white/40">
                  <span>
                    {t('Backend')}: {apiInfo.version || '—'}
                  </span>
                  <span
                    className="mx-2"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                  <span>
                    {t('Frontend')}: {frontendVersion || '—'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="relative lg:hidden">
            <button
              ref={mobileMenu.triggerRef}
              type="button"
              className="focus-visible:ring-primary-main flex h-10 w-10 items-center justify-center rounded-lg text-white outline-none hover:bg-white/10 focus-visible:ring-2"
              onClick={() => {
                accountMenu.setOpen(false);
                mobileMenu.setOpen(open => !open);
              }}
              aria-label={mobileMenu.open ? t('Close navigation menu') : t('Open navigation menu')}
              aria-haspopup="menu"
              aria-expanded={mobileMenu.open}
            >
              <span
                aria-hidden="true"
                className="text-xl leading-none"
              >
                {mobileMenu.open ? '×' : '☰'}
              </span>
            </button>

            {mobileMenu.open && (
              <div
                ref={mobileMenu.menuRef}
                role="menu"
                aria-label={t('Navigation menu')}
                className="absolute right-0 top-full mt-2 max-h-[calc(100vh-5rem)] w-72 overflow-y-auto rounded-lg border border-white/10 bg-[#2a2e2a] p-2 shadow-2xl"
                onKeyDown={handleMenuKeyDown}
                data-testid="mobile-navigation-menu"
              >
                <div className="border-b border-white/10 px-3 pb-2 pt-1">
                  <p className="truncate text-sm font-semibold text-white">{userName}</p>
                  <p className="truncate text-xs text-white/50">{tenantInfo.name || tenantId}</p>
                  {tenantInfo.id && tenantInfo.id !== tenantInfo.name && (
                    <p className="text-white/35 truncate text-[10px]">{tenantInfo.id}</p>
                  )}
                </div>
                <div className="py-1">{navigationItems.map(renderMobileNavigationItem)}</div>
                <div className="border-t border-white/10 pt-1">
                  <Link
                    role="menuitem"
                    to="/settings"
                    className={menuItemClassName}
                    onClick={() => mobileMenu.setOpen(false)}
                  >
                    {t('Settings')}
                  </Link>
                  <button
                    role="menuitem"
                    type="button"
                    className={menuItemClassName}
                    onClick={() => logoutUser(navigate, tenantId, false)}
                  >
                    {t('Logout')}
                  </button>
                </div>
                <div className="mt-1 border-t border-white/10 px-3 pt-2 text-[10px] text-white/40">
                  {t('Backend')}: {apiInfo.version || '—'} · {t('Frontend')}:{' '}
                  {frontendVersion || '—'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopNavigation;
