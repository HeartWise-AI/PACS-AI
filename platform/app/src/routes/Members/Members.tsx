import React, { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button, Input, Typography } from '@ohif/ui';
import Table from '../../components/Table';
import HeaderPanel from '../../components/HeaderPanel';
import SidebarAdmin from '../../components/SidebarAdmin';
import userRepository from '../../api/userRepository';
import { UserRole } from '../../api/userDTO';
import { Error } from '../../api/dto';
import Modal from '../../components/Modal';
import { AlertContext } from '../../AlertProvider';
import { logoutUser } from '../../service/userService';
import chevronDown from './../../assets/pacs/icons/chevron-down.png';
import dotsVertical from './../../assets/pacs/icons/dots-vertical-inactive.png';

const MembersPage = () => {
  const { t } = useTranslation('Members');
  const ref = useRef(null);
  const navigate = useNavigate();
  const [filteredItems, setFilteredItems] = useState([]);
  const [listOfUsers, setListOfUsers] = useState([]);
  const [listOfDoctorSpecialities, setListOfDoctorSpecialities] = useState([]);
  const showAlert = useContext(AlertContext);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);
  const [isAddMember, setIsAddMember] = useState(true);
  const [isOpenAddEditMemberModal, setIsOpenAddEditMemberModal] = useState<boolean>(false);
  const [isOpenDeleteMemberModal, setIsOpenDeleteMemberModal] = useState<boolean>(false);
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
  const ActionButton = ({ row }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef();

    return (
      <div
        className="relative flex items-center justify-center"
        ref={ref}
      >
        <button
          onClick={() => {
            setIsOpen(!isOpen);
          }}
        >
          <img
            src={dotsVertical}
            alt="Dots vertical icon"
          />
        </button>
        {isOpen && (
          <div
            className="absolute z-50 w-28 divide-y divide-gray-100 rounded-lg bg-[#4C504B]"
            style={{ top: ref.current ? ref.current.offsetHeight : 0, right: 0 }}
          >
            <ul className="py-2 text-sm text-white">
              <li>
                <a
                  className="block cursor-pointer px-4 py-2 hover:bg-gray-700"
                  onClick={() => {
                    setSelectedUser(row);
                    setIsAddMember(false);
                    setIsOpenAddEditMemberModal(true);
                    setIsOpen(false);
                  }}
                >
                  {t('Edit')}
                </a>
              </li>
              <li>
                <a
                  className="block cursor-pointer px-4 py-2 hover:bg-gray-700"
                  onClick={() => {
                    setIsOpenDeleteMemberModal(true);
                    setSelectedUserToDelete({ id: row.id });
                    setIsOpen(false);
                  }}
                >
                  {t('Delete')}
                </a>
              </li>
            </ul>
          </div>
        )}
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
  const getAllTenantUsers = async () => {
    setListOfUsers([]);
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
      setFilteredItems(listOfUsers);
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
    if (searchValue === '') {
      setFilteredItems(listOfUsers);
    } else {
      const filteredData = listOfUsers.filter(item => {
        return Object.values(item).join(' ').toLowerCase().includes(searchValue.toLowerCase());
      });
      setFilteredItems(filteredData);
    }
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
              onChange={e => searchItems(e.target.value)}
            />
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
          {/* add and edit member modal */}
          {isOpenAddEditMemberModal && (
            <Modal
              isOpen={isOpenAddEditMemberModal}
              size="max-w-[520px]"
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
        </div>
      </div>
    </div>
  );
};

export default MembersPage;
