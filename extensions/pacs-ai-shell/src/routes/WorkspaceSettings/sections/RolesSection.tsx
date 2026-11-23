import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Typography } from '@pacs-ai/ui';
import { Error as ApiError } from '@pacs-ai/extension-core/src/api/dto';
import type { CustomRoleResponse } from '@pacs-ai/extension-core/src/api/userDTO';
import Modal from '../../../components/Modal';
import { AlertContext } from '../../../alerts';
import RoleEditorModal from '../roles/RoleEditorModal';
import {
  EMPTY_ROLE_FORM,
  BASELINE_PERMISSION_INFO,
  getPermissionInfo,
  roleToForm,
  serializeRoleForm,
  type PermissionInfo,
  type RoleFormState,
} from '../roles/rolesModel';
import type { ApiErrorLike, UseCustomRolesResult } from '../roles/useCustomRoles';

type RolesSectionProps = {
  roles: UseCustomRolesResult;
  availableModels: { modelId?: string; modelName?: string; version?: string }[];
};

type ShowAlert = (message: string, type: 'success' | 'error') => void;

const chipClass =
  'inline-block rounded-full bg-white bg-opacity-10 px-2 py-0.5 text-xs text-white text-opacity-80';

const RolesSection = ({ roles, availableModels }: RolesSectionProps) => {
  const { t } = useTranslation('Roles');
  const showAlert = useContext(AlertContext) as ShowAlert;
  const [editing, setEditing] = useState<RoleFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CustomRoleResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const modelName = (modelId: string) =>
    availableModels.find(model => model.modelId === modelId)?.modelName || modelId;

  const save = async (form: RoleFormState) => {
    setSaving(true);
    try {
      await roles.save(form.id, serializeRoleForm(form));
      showAlert(form.id ? t('Role updated.') : t('Role created.'), 'success');
      setEditing(null);
    } catch (error) {
      const apiError = (error ?? {}) as ApiErrorLike;
      showAlert(
        apiError.errorCode === ApiError.DUPLICATE_RECORD
          ? t('Another role already has this name.')
          : apiError.message || t('The role could not be saved.'),
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) {
      return;
    }
    setIsDeleting(true);
    try {
      await roles.remove(deleting.id);
      showAlert(t('Role deleted.'), 'success');
      setDeleting(null);
    } catch (error) {
      const apiError = (error ?? {}) as ApiErrorLike;
      showAlert(
        apiError.errorCode === ApiError.ROLE_IN_USE
          ? t('This role is still assigned to members. Give them another role first.')
          : apiError.message || t('The role could not be deleted.'),
        'error'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl text-white">{t('Roles')}</h1>
          <p className="mt-1 max-w-[760px] text-sm text-white text-opacity-60">
            {t(
              'Owners and admins can do everything. Users can use models and rate reports. A custom role adds permissions to a user and can limit which models they see.'
            )}
          </p>
        </div>
        <Button
          className="h-[35px] rounded-lg"
          onClick={() => setEditing(EMPTY_ROLE_FORM)}
        >
          {t('New role')}
        </Button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-white border-opacity-10 p-3">
          <p className="text-sm text-white">{t('Owner and Admin')}</p>
          <p className="mt-1 text-xs text-white text-opacity-60">
            {t('Every permission and every model. Only they manage roles.')}
          </p>
        </div>
        <div className="rounded-lg border border-white border-opacity-10 p-3 md:col-span-2">
          <p className="text-sm text-white">{t('User')}</p>
          <p className="mt-1 text-xs text-white text-opacity-60">
            {BASELINE_PERMISSION_INFO.map(permission => t(permission.label)).join(' · ')}
            {' · '}
            {t('all models unless a custom role limits them')}
          </p>
        </div>
      </div>

      <div className="py-5">
        {roles.loading && roles.roles.length === 0 ? (
          <p className="text-sm text-white text-opacity-60">{t('Loading roles…')}</p>
        ) : roles.loadError && roles.roles.length === 0 ? (
          <div className="flex items-center gap-3 text-sm text-red-400">
            {t('Roles could not be loaded.')}
            <button
              type="button"
              className="text-primary underline"
              onClick={() => void roles.refresh()}
            >
              {t('Try again')}
            </button>
          </div>
        ) : roles.roles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white border-opacity-20 p-6 text-center text-sm text-white text-opacity-60">
            {t(
              'No custom roles yet. Create one to give some users more permissions or fewer models.'
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm text-white">
              <thead className="text-xs uppercase tracking-wide text-white text-opacity-50">
                <tr>
                  <th className="py-2 pr-3 font-normal">{t('Role')}</th>
                  <th className="py-2 pr-3 font-normal">{t('Extra permissions')}</th>
                  <th className="py-2 pr-3 font-normal">{t('Models')}</th>
                  <th className="py-2 pr-3 text-right font-normal">{t('Members')}</th>
                  <th className="py-2 text-right font-normal">{t('Action')}</th>
                </tr>
              </thead>
              <tbody>
                {roles.roles.map(role => {
                  const extra = (role.permissions ?? [])
                    .map(id => getPermissionInfo(id))
                    .filter(
                      (info): info is PermissionInfo =>
                        Boolean(info) && !BASELINE_PERMISSION_INFO.includes(info as PermissionInfo)
                    );
                  return (
                    <tr
                      key={role.id}
                      className="border-t border-white border-opacity-10 align-top"
                    >
                      <td className="py-3 pr-3">
                        <div className="font-semibold">{role.name}</div>
                        {role.description && (
                          <div className="text-xs text-white text-opacity-60">
                            {role.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {extra.length === 0 ? (
                          <span className="text-white text-opacity-50">{t('None')}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {extra.map(info => (
                              <span
                                key={info.id}
                                className={chipClass}
                              >
                                {t(info.label)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {role.allModels ? (
                          <span className="text-white text-opacity-80">{t('All models')}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(role.modelIds ?? []).map(modelId => (
                              <span
                                key={modelId}
                                className={chipClass}
                              >
                                {modelName(modelId)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">{role.memberCount ?? 0}</td>
                      <td className="whitespace-nowrap py-3 text-right">
                        <button
                          type="button"
                          className="text-primary mr-3 hover:underline"
                          onClick={() => setEditing(roleToForm(role))}
                        >
                          {t('Edit')}
                        </button>
                        <button
                          type="button"
                          className="text-red-400 hover:underline"
                          onClick={() => setDeleting(role)}
                        >
                          {t('Delete')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <RoleEditorModal
          key={editing.id ?? 'new'}
          isOpen
          initial={editing}
          existingRoles={roles.roles}
          availableModels={availableModels}
          saving={saving}
          onClose={() => !saving && setEditing(null)}
          onSave={save}
        />
      )}

      {deleting && (
        <Modal
          isOpen
          size="min-w-[400px] max-w-[520px]"
          isCloseable={!isDeleting}
          onClose={() => !isDeleting && setDeleting(null)}
        >
          <div className="relative">
            <Typography
              variant="h6"
              className="font-light text-white"
            >
              {t('Delete role')}
            </Typography>
            <Typography
              variant="body"
              className="mt-2 font-light text-white text-opacity-70"
            >
              {deleting.memberCount > 0
                ? t(
                    '{{name}} is assigned to {{count}} members. Give them another role before deleting it.',
                    {
                      name: deleting.name,
                      count: deleting.memberCount,
                    }
                  )
                : t('Delete {{name}}? This cannot be undone.', { name: deleting.name })}
            </Typography>
            <div className="mt-4 flex w-full justify-end">
              <button
                type="button"
                disabled={isDeleting}
                className="h-[41px] w-[111px] rounded-lg bg-transparent text-gray-400"
                onClick={() => setDeleting(null)}
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                disabled={isDeleting || deleting.memberCount > 0}
                className="h-[41px] w-[111px] rounded-lg bg-red-700 text-white disabled:opacity-50"
                onClick={confirmDelete}
              >
                {isDeleting ? '…' : t('Delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default RolesSection;
