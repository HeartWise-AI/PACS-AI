import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import ReactDOM from 'react-dom';
import { Button, Typography } from '@ohif/ui';
import { Input } from '@ohif/ui-next';
import Table from '../../components/Table';
import HeaderPanel from '../../components/HeaderPanel';
import SidebarAdmin from '../../components/SidebarAdmin';
import userRepository from '../../api/userRepository';
import {
  GetTenantUserEmailInvitesResponse,
  UserAccessState,
  UserResponse,
  UserRole,
} from '../../api/userDTO';
import { Error } from '../../api/dto';
import Modal from '../../components/Modal';
import { AlertContext } from '../../AlertProvider';
import { logoutUser } from '../../service/userService';
import chevronDown from './../../assets/pacs/icons/chevron-down.png';
import dotsVertical from './../../assets/pacs/icons/dots-vertical-inactive.png';
import chevronLeft from './../../assets/pacs/icons/chevron-left.png';
import chevronRight from './../../assets/pacs/icons/chevron-right.png';
import { getMemberAccessStatusPresentation } from './memberAccessStatus';
import { getMemberAccessEligibility } from './memberAccessPolicy';
import MemberAccessConfirmationDialog, {
  type MemberAccessAction,
} from './MemberAccessConfirmationDialog';
import {
  ACCOUNT_ACCESS_TRANSITION_IN_PROGRESS,
  executeMemberAccessTransition,
  type MemberAccessTransitionError,
} from './memberAccessTransition';
import { filterMembers } from './memberSearch';

const userInvitesPerPage = 5;

type MemberRow = Omit<UserResponse, 'role' | 'licenseNo'> & {
  role: UserRole;
  licenseNo: string;
  firstName: string;
  lastName: string;
};

const MembersPage = () => {
  const { t } = useTranslation('Members');
  const navigate = useNavigate();
  const [filteredItems, setFilteredItems] = useState([]);
  const [listOfUsers, setListOfUsers] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [listOfDoctorSpecialities, setListOfDoctorSpecialities] = useState([]);
  const showAlert = useContext(AlertContext);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);
  const [isAddMember, setIsAddMember] = useState(true);
  const [isOpenAddEditMemberModal, setIsOpenAddEditMemberModal] = useState<boolean>(false);
  const [isOpenInviteModal, setIsOpenInviteModal] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteModalPage, setInviteModalPage] = useState(1);
  const [tenantEmailInvites, setTenantEmailInvites] = useState<GetTenantUserEmailInvitesResponse[]>(
    []
  );
  const [loadingTenantEmailInvites, setLoadingTenantEmailInvites] = useState(false);
  const [resendingTenantInviteId, setResendingTenantInviteId] = useState<string | null>(null);
  const [removingTenantInviteId, setRemovingTenantInviteId] = useState<string | null>(null);
  const [isOpenDeleteMemberModal, setIsOpenDeleteMemberModal] = useState<boolean>(false);
  const [memberAccessDialog, setMemberAccessDialog] = useState<{
    action: MemberAccessAction;
    target: MemberRow;
  } | null>(null);
  const [memberAccessReason, setMemberAccessReason] = useState('');
  const [isChangingMemberAccess, setIsChangingMemberAccess] = useState(false);
  const [selectedUser, setSelectedUser] = useState({
    id: '',
    tenantId: '',
    role: UserRole.USER,
    name: '',
    firstName: '',
    lastName: '',
    email: '',
    licenseNo: '',
    specialty: '',
    isEmailVerified: false,
    isAccountDisabled: false,
    createdAt: 0,
    updatedAt: 0,
  });
  const [selectedUserToDelete, setSelectedUserToDelete] = useState({
    id: '',
  });
  const headers = [
    { text: t('ID'), value: 'id', align: 'left' },
    { text: t('Name'), value: 'name', align: 'left' },
    { text: t('Role'), value: 'role', align: 'center' },
    { text: t('Email'), value: 'email', align: 'left' },
    { text: t('License No.'), value: 'licenseNo', align: 'left' },
    { text: t('Specialty'), value: 'specialty', align: 'left' },
    { text: t('Email Status'), value: 'isEmailVerified', align: 'center' },
    { text: t('Access Status'), value: 'accessState', align: 'center' },
    { text: t('Created At'), value: 'createdAt', align: 'left' },
    { text: t('Action'), value: 'action', align: 'center' },
  ];
  const tenantId = localStorage.getItem('tenantId') || '';

  // Set page title
  useEffect(() => {
    document.title = 'Admin Members - PACS AI';
  }, []);

  useEffect(() => {
    getAllTenantUsers();
    getCurrentUser();
    getDoctorSpecialties();
  }, [userRepository]);

  /**
   * Add tenant user
   */
  const addTenantUser = async () => {
    setIsAddingMember(true);
    try {
      const payload = {
        role: selectedUser.role,
        name: selectedUser.firstName + ' ' + selectedUser.lastName,
        email: selectedUser.email,
        licenseNo: selectedUser.licenseNo,
        specialty: selectedUser.specialty,
      };
      const response = await userRepository.AddTenantUser(payload);
      showAlert(response.message, 'success');
      clearSelectedUser();
      setIsOpenAddEditMemberModal(false);
      getAllTenantUsers();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }

      showAlert(error.message, 'error');
    }
    setIsAddingMember(false);
    setIsAddMember(true);
  };

  /**
   * Table action button
   *
   * @param param0 row
   * @returns
   */
  const ActionButton = ({ row }: { row: MemberRow }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const accessEligibility = getMemberAccessEligibility(currentUser, row);
    const memberAccessAction: MemberAccessAction | null =
      row.accessState === UserAccessState.ACTIVE
        ? 'suspend'
        : row.accessState === UserAccessState.SUSPENDED
          ? 'reactivate'
          : null;
    const showMemberAccessAction = accessEligibility.allowed && memberAccessAction !== null;

    useEffect(() => {
      if (isOpen && ref.current) {
        const rect = ref.current.getBoundingClientRect();
        // Calculate position for the dropdown menu
        // Adjust if near the bottom of the viewport
        const menuHeight = showMemberAccessAction ? 156 : 104;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom;
        setMenuPosition({
          top,
          left: rect.right - 176,
        });
      }
    }, [isOpen, showMemberAccessAction]);

    // Dropdown menu content
    const menu = (
      <div
        className="fixed z-50 w-44 divide-y divide-gray-100 rounded-lg bg-[#4C504B] shadow-lg"
        style={{ top: menuPosition.top, left: menuPosition.left }}
      >
        <ul className="py-2 text-sm text-white">
          <li>
            <button
              type="button"
              className="block w-full px-4 py-2 text-left hover:bg-gray-700"
              onClick={() => {
                setSelectedUser(row);
                setIsAddMember(false);
                setIsOpenAddEditMemberModal(true);
                setIsOpen(false);
              }}
            >
              {t('Edit')}
            </button>
          </li>
          <li>
            <button
              type="button"
              className="block w-full px-4 py-2 text-left hover:bg-gray-700"
              onClick={() => {
                setIsOpenDeleteMemberModal(true);
                setSelectedUserToDelete({ id: row.id });
                setIsOpen(false);
              }}
            >
              {t('Delete')}
            </button>
          </li>
          {showMemberAccessAction && (
            <li>
              <button
                type="button"
                className={`block w-full px-4 py-2 text-left hover:bg-gray-700 ${
                  memberAccessAction === 'suspend' ? 'text-[#FF9A9A]' : 'text-[#8BE397]'
                }`}
                onClick={() => {
                  setMemberAccessReason('');
                  setMemberAccessDialog({ action: memberAccessAction, target: row });
                  setIsOpen(false);
                }}
              >
                {t(memberAccessAction === 'suspend' ? 'Suspend access' : 'Reactivate access')}
              </button>
            </li>
          )}
        </ul>
      </div>
    );

    return (
      <div
        className="relative flex items-center justify-center"
        ref={ref}
      >
        <button
          type="button"
          aria-label={t('Actions for {{member}}', { member: row.name || row.email })}
          onClick={() => {
            setIsOpen(!isOpen);
          }}
        >
          <img
            src={dotsVertical}
            alt=""
          />
        </button>
        {isOpen && ReactDOM.createPortal(menu, document.body)}
      </div>
    );
  };

  const clearSelectedUser = () => {
    setSelectedUser({
      id: '',
      tenantId: '',
      role: UserRole.USER,
      name: '',
      firstName: '',
      lastName: '',
      email: '',
      licenseNo: '',
      specialty: '',
      isEmailVerified: false,
      isAccountDisabled: false,
      createdAt: 0,
      updatedAt: 0,
    });
  };
  /**
   * Delete tenant user
   */
  const deleteTenantUser = async () => {
    setIsDeletingMember(true);
    try {
      const response = await userRepository.DeleteTenantUser({ userId: selectedUserToDelete.id });
      showAlert(response.message, 'success');
      setIsOpenDeleteMemberModal(false);
      getAllTenantUsers();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }

      showAlert(error.message, 'error');
    }
    setIsDeletingMember(false);
  };
  /**
   * Get all tenant users
   */
  const getAllTenantUsers = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setListOfUsers([]);
    }
    try {
      const response = await userRepository.GetAllTenantUsers();
      const listOfUsers = response.data.map(user => {
        const fullNameParts = user.name.split(' ');
        const lastName = fullNameParts.pop();
        const firstName = fullNameParts.join(' ');
        return {
          ...user,
          firstName: firstName,
          lastName: lastName,
        };
      });
      setListOfUsers(listOfUsers);
      setFilteredItems(filterMembers(listOfUsers, searchValue));
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }

      showAlert(error.message, 'error');
    }
  };

  /**
   * Get the current actor used to fail closed on access-management permissions.
   */
  const getCurrentUser = async () => {
    try {
      const response = await userRepository.GetCurrentUser();
      setCurrentUser(response.data);
    } catch (error) {
      setCurrentUser(null);
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      showAlert(error.message, 'error');
    }
  };

  /**
   * Get doctors specialties
   */
  const getDoctorSpecialties = async () => {
    try {
      const response = await userRepository.GetDoctorSpecialties();
      setListOfDoctorSpecialities(response.data);
      setSelectedUser({ ...selectedUser, specialty: response.data[0].id });
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }

      showAlert(error.message, 'error');
    }
  };

  /**
   * Update tenant user
   */
  const udpateTenantUser = async () => {
    setIsUpdatingMember(true);
    try {
      const payload = {
        id: selectedUser.id,
        role: selectedUser.role,
        name: selectedUser.firstName + ' ' + selectedUser.lastName,
        licenseNo: selectedUser.licenseNo,
        specialty: selectedUser.specialty,
      };
      const response = await userRepository.UpdateTenantUser(payload);
      showAlert(response.message, 'success');
      clearSelectedUser();
      setIsOpenAddEditMemberModal(false);
      getAllTenantUsers();
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }

      showAlert(error.message, 'error');
    }
    setIsUpdatingMember(false);
    setIsAddMember(true);
  };

  /**
   * Table search
   *
   * @param searchValue
   */
  const searchItems = (searchValue: string) => {
    setSearchValue(searchValue);
    setFilteredItems(filterMembers(listOfUsers, searchValue));
  };

  /**
   * Confirm an eligible member access transition against the live backend.
   */
  const changeMemberAccess = async () => {
    if (!memberAccessDialog) {
      return;
    }

    const eligibility = getMemberAccessEligibility(currentUser, memberAccessDialog.target);
    if (!eligibility.allowed) {
      setMemberAccessDialog(null);
      setMemberAccessReason('');
      showAlert(t('Account access management is no longer available for this member.'), 'error');
      return;
    }

    setIsChangingMemberAccess(true);
    try {
      const response = await executeMemberAccessTransition({
        action: memberAccessDialog.action,
        userId: memberAccessDialog.target.id,
        reason: memberAccessReason,
        repository: userRepository,
        refreshMembers: () => getAllTenantUsers({ silent: true }),
      });
      showAlert(response.message, 'success');
      setMemberAccessDialog(null);
      setMemberAccessReason('');
    } catch (error) {
      const accessError = error as MemberAccessTransitionError;
      if (accessError.errorCode === ACCOUNT_ACCESS_TRANSITION_IN_PROGRESS) {
        setMemberAccessDialog(null);
        setMemberAccessReason('');
      }
      if (accessError.errorCode === Error.UNAUTHORIZED_ACCESS) {
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      showAlert(accessError.message || t('Unable to update account access.'), 'error');
    } finally {
      setIsChangingMemberAccess(false);
    }
  };

  /**
   * Fetch tenant email invites
   */
  const fetchTenantEmailInvites = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (!silent) {
        setLoadingTenantEmailInvites(true);
      }
      try {
        const response = await userRepository.GetTenantUserEmailInvites();
        const list = response.data;
        setTenantEmailInvites(Array.isArray(list) ? list : []);
      } catch (error) {
        if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
          showAlert(error.message, 'error');
          setTimeout(() => {
            logoutUser(navigate, tenantId);
          }, 3000);
        } else {
          showAlert(error.message, 'error');
        }
        setTenantEmailInvites([]);
      } finally {
        if (!silent) {
          setLoadingTenantEmailInvites(false);
        }
      }
    },
    [navigate, tenantId, showAlert]
  );

  /**
   * Sort tenant email invites
   */
  const sortedTenantEmailInvites = useMemo(
    () =>
      [...tenantEmailInvites]
        .filter(inv => !(inv.verifiedAt > 0))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [tenantEmailInvites]
  );

  /**
   * Calculate total pages for invite modal
   */
  const inviteModalTotalPages = Math.max(
    1,
    Math.ceil(sortedTenantEmailInvites.length / userInvitesPerPage)
  );

  /**
   * Calculate visible page numbers for invite modal
   */
  const inviteModalVisiblePageNumbers = useMemo(() => {
    const total = inviteModalTotalPages;
    const current = inviteModalPage;
    const windowSize = 5;
    if (total <= windowSize) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const start = Math.min(
      Math.max(1, current - Math.floor(windowSize / 2)),
      total - windowSize + 1
    );
    return Array.from({ length: windowSize }, (_, i) => start + i);
  }, [inviteModalTotalPages, inviteModalPage]);

  /**
   * Get paged tenant email invites
   */
  const pagedTenantEmailInvites = useMemo(
    () =>
      sortedTenantEmailInvites.slice(
        (inviteModalPage - 1) * userInvitesPerPage,
        inviteModalPage * userInvitesPerPage
      ),
    [sortedTenantEmailInvites, inviteModalPage]
  );

  useEffect(() => {
    setInviteModalPage(p => Math.min(Math.max(1, p), inviteModalTotalPages));
  }, [inviteModalTotalPages]);

  /**
   * Get invite modal row status
   *
   * @param invite
   * @returns
   */
  const getInviteModalRowStatus = (invite: GetTenantUserEmailInvitesResponse) => {
    const nowSec = Date.now() / 1000;
    if (invite.expiresAt > 0 && nowSec > invite.expiresAt) {
      return 'expired' as const;
    }
    return 'sent' as const;
  };

  /**
   * Handle resend tenant invite
   *
   * @param id
   * @returns
   */
  const handleResendTenantInvite = async (id: string) => {
    setResendingTenantInviteId(id);
    try {
      const response = await userRepository.ResendTenantInvitation({ id });
      showAlert(response.message, 'success');
      await fetchTenantEmailInvites({ silent: true });
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error resending tenant invite: ${error}`);
      showAlert(error.message, 'error');
    } finally {
      setResendingTenantInviteId(null);
    }
  };

  /**
   * Handle cancel tenant invite
   *
   * @param id
   * @returns
   */
  const handleCancelTenantInvite = async (id: string) => {
    setRemovingTenantInviteId(id);
    try {
      const response = await userRepository.RemoveTenantUserEmailInvite({ id });
      showAlert(response.message, 'success');
      await fetchTenantEmailInvites({ silent: true });
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error removing tenant invite: ${error}`);
      showAlert(error.message, 'error');
    } finally {
      setRemovingTenantInviteId(null);
    }
  };

  /**
   * Handle send invite
   *
   * @returns
   */
  const handleSendInvite = async () => {
    const emailTrim = inviteEmail.trim().toLowerCase();
    if (!emailTrim) {
      showAlert(t('Invite email is required'), 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      showAlert(t('Please enter a valid email address'), 'error');
      return;
    }
    setIsSendingInvite(true);
    try {
      const response = await userRepository.InviteTenantUser({ email: emailTrim });
      showAlert(response.message, 'success');
      setInviteEmail('');
      setInviteModalPage(1);
      await fetchTenantEmailInvites({ silent: true });
    } catch (error) {
      if (error.errorCode === Error.UNAUTHORIZED_ACCESS) {
        showAlert(error.message, 'error');
        setTimeout(() => {
          logoutUser(navigate, tenantId);
        }, 3000);
      }
      console.error(`Error sending invite: ${error}`);
      showAlert(error.message, 'error');
    }
    setIsSendingInvite(false);
  };

  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815]">
        <SidebarAdmin />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <HeaderPanel title="Members" />
          {/* filter container */}
          <div className="flex justify-between rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            <Input
              id="search"
              placeholder={t('Search member name, email, license no., etc.')}
              className="w-[70%] lg:w-[40%]"
              type="text"
              value={searchValue}
              onChange={e => searchItems(e.target.value)}
            />
            <div className="flex shrink-0 gap-2">
              <button
                disabled={false}
                className="min-w-28 border-primary text-primary h-[51px] rounded-lg border px-3 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  setInviteModalPage(1);
                  setIsOpenInviteModal(true);
                  fetchTenantEmailInvites();
                }}
              >
                {t('Invite')}
              </button>
              <Button
                disabled={false}
                className="min-w-36 h-[51px] rounded-lg !px-0"
                onClick={() => {
                  setIsOpenAddEditMemberModal(true);
                }}
              >
                {t('Add Member')}
              </Button>
            </div>
          </div>
          {/* table container */}
          <div className="mt-5 mb-5 rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            {listOfUsers.length === 0 ? null : filteredItems && filteredItems.length > 0 ? (
              <Table
                headers={headers}
                data={filteredItems}
                className={'max-w-[170px]'}
              >
                {(cell, header, row) => {
                  // id
                  if (header.value === 'id') {
                    return cell.slice(0, 4) + '...' + cell.slice(-4);
                  }

                  // role
                  if (header.value === 'role') {
                    let roleColorClass = '';
                    if (cell === UserRole.USER) {
                      roleColorClass = 'bg-[#3DA2FF] bg-opacity-20 text-[#3DA2FF]';
                    }
                    if (cell === UserRole.ADMIN) {
                      roleColorClass = 'bg-[#33C9B7] bg-opacity-20 text-[#33C9B7]';
                    }
                    if (cell === UserRole.OWNER) {
                      roleColorClass = 'bg-[#6ED47C] bg-opacity-20 text-[#6ED47C]';
                    }
                    return (
                      <div className={`rounded-full p-1 ${roleColorClass}`}>
                        <span className="!capitalize">{cell}</span>
                      </div>
                    );
                  }
                  // speicalty
                  if (header.value === 'specialty') {
                    const foundSpecialty = listOfDoctorSpecialities.find(
                      specialty => specialty.id.toLowerCase() === cell.toLowerCase()
                    );
                    return foundSpecialty ? foundSpecialty.name : '';
                  }
                  // email status
                  if (header.value === 'isEmailVerified') {
                    return (
                      <div
                        className={`rounded-full py-1 px-2 ${
                          cell
                            ? 'bg-[#6ED47C] bg-opacity-20 text-[#6ED47C]'
                            : 'bg-gray-300 bg-opacity-10 text-gray-500'
                        }`}
                      >
                        {cell ? 'Verified' : 'Unverified'}
                      </div>
                    );
                  }

                  // account access status
                  if (header.value === 'accessState') {
                    const { labelKey, className } = getMemberAccessStatusPresentation(cell);
                    const label = t(labelKey);
                    return (
                      <span
                        className={`inline-block rounded-full py-1 px-2 ${className}`}
                        aria-label={`${t('Access Status')}: ${label}`}
                      >
                        {label}
                      </span>
                    );
                  }

                  // created at
                  if (header.value === 'createdAt') {
                    const date = new Date(cell * 1000);
                    return date.toLocaleString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                  }

                  // action
                  if (header.value === 'action') {
                    return <ActionButton row={row} />;
                  }
                  return cell;
                }}
              </Table>
            ) : (
              <p className="text-center text-white opacity-60">{t('No Data Found')}</p>
            )}
            {listOfUsers.length === 0 && (
              <div
                role="status"
                className={`grid max-w-full animate-pulse grid-cols-7 gap-4`}
              >
                {Array.from({ length: 7 }, (_, c) => (
                  <div key={c}>
                    {Array.from({ length: 3 }, (_, r) => (
                      <div key={r}>
                        <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                        <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
                        <div className='className="mb-2 mb-2 h-2 max-w-full rounded-full bg-gray-200 bg-opacity-30'></div>
                        <div className='className="mb-2 mb-2 h-1 max-w-[70%] rounded-full bg-gray-200 bg-opacity-30'></div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* invite modal */}
          {isOpenInviteModal && (
            <Modal
              isOpen={isOpenInviteModal}
              size="w-full max-w-[640px]"
              isCloseable={true}
              onClose={() => {
                setIsOpenInviteModal(false);
                setInviteEmail('');
                setLoadingTenantEmailInvites(false);
              }}
            >
              <div className="relative">
                <Typography
                  variant="h6"
                  className="font-light text-white"
                >
                  {t('Invite')}
                </Typography>
                <Typography
                  variant="body"
                  className="mt-2 font-light text-white text-opacity-50"
                >
                  {t('Enter email then hit send')}
                </Typography>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder={t('Email')}
                    className="h-[51px] w-full flex-1 sm:min-w-0"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={isSendingInvite}
                    className="h-[51px] shrink-0 rounded-lg bg-gradient-to-r from-[#d4f87a] to-[#c8f469] px-8 text-base font-medium text-[#151815] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      void handleSendInvite();
                    }}
                  >
                    {isSendingInvite ? '...' : t('Send')}
                  </button>
                </div>
                <div className="mt-8 overflow-x-auto border-none">
                  <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-none text-white text-opacity-50">
                        <th className="px-4 py-3 font-normal">{t('Name')}</th>
                        <th className="px-4 py-3 text-center font-normal">{t('Status')}</th>
                        <th className="px-4 py-3 text-center font-normal">{t('Action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingTenantEmailInvites ? (
                        Array.from({ length: userInvitesPerPage }, (_, i) => (
                          <tr
                            key={`sk-${i}`}
                            className="border-none"
                          >
                            <td
                              colSpan={3}
                              className="px-4 py-3"
                            >
                              <div className="h-3 max-w-full animate-pulse rounded-full bg-white/10" />
                            </td>
                          </tr>
                        ))
                      ) : sortedTenantEmailInvites.length === 0 ? (
                        <tr className="border-none">
                          <td
                            colSpan={3}
                            className="px-4 py-6 text-center text-white text-opacity-50"
                          >
                            {t('No invitations yet')}
                          </td>
                        </tr>
                      ) : (
                        pagedTenantEmailInvites.map(invite => {
                          const rowStatus = getInviteModalRowStatus(invite);
                          return (
                            <tr
                              key={invite.id}
                              className="border-none"
                            >
                              <td className="px-4 py-1 text-[13px]">
                                <div className="flex min-w-0 items-center gap-3">
                                  <span
                                    className="truncate text-white"
                                    title={invite.email}
                                  >
                                    {invite.email}
                                  </span>
                                </div>
                              </td>
                              <td className="flex justify-center px-4 py-1 text-[13px]">
                                {rowStatus === 'expired' ? (
                                  <span className="bg-[#FF3D3D]/15 inline-block rounded-full px-3 py-1 font-medium text-[#FF3D3D]">
                                    {t('Expired')}
                                  </span>
                                ) : (
                                  <span className="bg-[#6ED47C]/15 inline-block rounded-full px-3 py-1 font-medium text-[#6ED47C]">
                                    {t('Invite Sent')}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-1 text-[13px]">
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    disabled={
                                      resendingTenantInviteId === invite.id ||
                                      removingTenantInviteId === invite.id
                                    }
                                    className="bg-primary-main/10 text-primary-main hover:bg-primary-main/20 min-w-[71px] rounded-lg px-3 py-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => {
                                      void handleResendTenantInvite(invite.id);
                                    }}
                                  >
                                    {resendingTenantInviteId === invite.id ? '...' : t('Resend')}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      removingTenantInviteId === invite.id ||
                                      resendingTenantInviteId === invite.id
                                    }
                                    className="min-w-[71px] rounded-lg bg-[#FF3D3D]/10 px-3 py-1.5 font-medium text-[#FF3D3D] transition-colors hover:bg-[#FF3D3D]/20 disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => {
                                      void handleCancelTenantInvite(invite.id);
                                    }}
                                  >
                                    {removingTenantInviteId === invite.id ? '...' : t('Cancel')}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {!loadingTenantEmailInvites && sortedTenantEmailInvites.length > 0 && (
                  <div className="mt-6 flex items-center justify-center gap-1">
                    <button
                      type="button"
                      disabled={inviteModalPage <= 1}
                      className="mr-1 flex h-5 w-5 items-center justify-center rounded-md text-white text-opacity-50 hover:text-opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={t('Previous')}
                      onClick={() => setInviteModalPage(p => Math.max(1, p - 1))}
                    >
                      <img
                        src={chevronLeft}
                        alt="Chevron left icon"
                        className="w-5"
                      />
                    </button>
                    {inviteModalVisiblePageNumbers.map(page => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setInviteModalPage(page)}
                        className={`flex h-5 w-5 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                          inviteModalPage === page
                            ? 'bg-[#c8f469] text-[#151815]'
                            : 'text-white text-opacity-50 hover:text-opacity-80'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={inviteModalPage >= inviteModalTotalPages}
                      className="ml-1 flex h-5 w-5 items-center justify-center rounded-md text-white text-opacity-50 hover:text-opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={t('Next')}
                      onClick={() =>
                        setInviteModalPage(p => Math.min(inviteModalTotalPages, p + 1))
                      }
                    >
                      <img
                        src={chevronRight}
                        alt="Chevron right icon"
                        className="w-5"
                      />
                    </button>
                  </div>
                )}
              </div>
            </Modal>
          )}

          {/* add and edit member modal */}
          {isOpenAddEditMemberModal && (
            <Modal
              isOpen={isOpenAddEditMemberModal}
              size="max-w-[520px]"
              isCloseable={true}
              onClose={() => {
                setIsAddMember(true);
                setIsOpenAddEditMemberModal(false);
                clearSelectedUser();
              }}
            >
              <div className="relative">
                <Typography
                  variant="h6"
                  className="font-light text-white"
                >
                  {t(isAddMember ? 'Add Member' : 'Edit Member')}
                </Typography>
                <Typography
                  variant="body"
                  className="mt-2 font-light text-white text-opacity-70"
                >
                  {t(isAddMember ? 'Add a new member.' : 'Update member information.')}
                </Typography>
                <Typography
                  variant="body"
                  className="mt-5 font-light text-white"
                >
                  {t('Personal Information')}
                </Typography>
                <div className="mt-4">
                  <div className="flex gap-4">
                    <Input
                      id="firstname"
                      placeholder={t('First Name')}
                      className="mb-4 w-full"
                      type="text"
                      autoFocus
                      value={selectedUser.firstName}
                      onChange={e => {
                        setSelectedUser({ ...selectedUser, firstName: e.target.value });
                      }}
                    />
                    <Input
                      id="lastname"
                      placeholder={t('Last Name')}
                      className="mb-4 w-full"
                      type="text"
                      value={selectedUser.lastName}
                      onChange={e => {
                        setSelectedUser({ ...selectedUser, lastName: e.target.value });
                      }}
                    />
                  </div>
                  <div className="relative">
                    <select
                      id="user-role"
                      value={selectedUser.role}
                      onChange={e =>
                        setSelectedUser({ ...selectedUser, role: e.target.value as UserRole })
                      }
                      className="mb-4 block h-[51px] w-full cursor-pointer appearance-none rounded-lg border-2 border-none bg-white bg-opacity-10 py-3 px-3 pr-8 text-lg leading-tight text-white focus:outline-none"
                    >
                      {Object.values(UserRole)
                        .filter(role => role !== UserRole.OWNER)
                        .map(role => (
                          <option
                            key={role}
                            value={role}
                            className="!cursor-pointer !bg-[#323631] !py-2"
                          >
                            {role}
                          </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <img
                        src={chevronDown}
                        alt="Chevron down icon"
                        className="w-5"
                      />
                    </div>
                  </div>

                  <Input
                    id="email"
                    disabled={!isAddMember}
                    placeholder={t('Email')}
                    className="mb-4 w-full"
                    type="text"
                    value={selectedUser.email}
                    onChange={e => {
                      setSelectedUser({ ...selectedUser, email: e.target.value.toLowerCase() });
                    }}
                    onKeyPress={e => e.key === ' ' && e.preventDefault()}
                  />
                  <Input
                    id="licenseNo"
                    placeholder={t('License No.')}
                    className="mb-4 w-full"
                    type="text"
                    value={selectedUser.licenseNo}
                    onChange={e => {
                      setSelectedUser({ ...selectedUser, licenseNo: e.target.value });
                    }}
                  />
                  <div className="relative">
                    <select
                      id="user-specialty"
                      value={selectedUser.specialty}
                      onChange={e =>
                        setSelectedUser({ ...selectedUser, specialty: e.target.value as string })
                      }
                      className="mb-4 block h-[51px] w-full cursor-pointer appearance-none rounded-lg border-2 border-none bg-white bg-opacity-10 py-3 px-3 pr-8 text-lg leading-tight text-white focus:outline-none"
                    >
                      {Object.values(listOfDoctorSpecialities).map(specialty => (
                        <option
                          key={specialty.id}
                          value={specialty.id}
                          className="!cursor-pointer !bg-[#323631] !py-2"
                        >
                          {specialty.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <img
                        src={chevronDown}
                        alt="Chevron down icon"
                        className="w-5"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex w-full justify-end">
                  <Button
                    disabled={isAddingMember || isUpdatingMember}
                    className="h-[41px] w-[111px] rounded-lg"
                    onClick={isAddMember ? addTenantUser : udpateTenantUser}
                  >
                    {isAddingMember || isUpdatingMember ? '...' : t('Save')}
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* delete member modal */}
          {isOpenDeleteMemberModal && (
            <Modal
              isOpen={isOpenDeleteMemberModal}
              size="min-w-[400px]"
              isCloseable={true}
              onClose={() => {
                setIsOpenDeleteMemberModal(false);
              }}
            >
              <div className="relative">
                <Typography
                  variant="h6"
                  className="font-light text-white"
                >
                  {t('Delete Member')}
                </Typography>
                <Typography
                  variant="body"
                  className="mt-2 font-light text-white text-opacity-70"
                >
                  {t('Are you sure you want to delete this user?')}
                </Typography>

                <div className="mt-4 flex w-full justify-end">
                  <button
                    disabled={isDeletingMember}
                    className="h-[41px] w-[111px] rounded-lg bg-transparent text-gray-400"
                    onClick={() => setIsOpenDeleteMemberModal(false)}
                  >
                    {isDeletingMember ? '...' : t('Cancel')}
                  </button>
                  <button
                    disabled={isDeletingMember}
                    className="h-[41px] w-[111px] rounded-lg bg-red-700 text-white"
                    onClick={deleteTenantUser}
                  >
                    {isDeletingMember ? '...' : t('Delete')}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {memberAccessDialog && (
            <MemberAccessConfirmationDialog
              action={memberAccessDialog.action}
              target={memberAccessDialog.target}
              reason={memberAccessReason}
              busy={isChangingMemberAccess}
              onReasonChange={setMemberAccessReason}
              onCancel={() => {
                if (!isChangingMemberAccess) {
                  setMemberAccessDialog(null);
                  setMemberAccessReason('');
                }
              }}
              onConfirm={() => {
                void changeMemberAccess();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MembersPage;
