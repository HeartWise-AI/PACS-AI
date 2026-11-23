import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Typography } from '@pacs-ai/ui';
import Modal from '../../../components/Modal';
import type { CustomRoleResponse } from '@pacs-ai/extension-core/src/api/userDTO';
import {
  BASELINE_PERMISSION_INFO,
  PERMISSION_GROUPS,
  ROLE_DESCRIPTION_MAX,
  ROLE_FORM_ERROR_MESSAGES,
  ROLE_NAME_MAX,
  toggleModel,
  togglePermission,
  validateRoleForm,
  type RoleFormState,
} from './rolesModel';

export interface RoleModelOption {
  modelId: string;
  label: string;
  deployed: boolean;
}

/** Deployed models plus any id the role still lists that is no longer deployed. */
export function buildRoleModelOptions(
  availableModels: { modelId?: string; modelName?: string; version?: string }[],
  selectedIds: string[]
): RoleModelOption[] {
  const options = new Map<string, RoleModelOption>();
  availableModels.forEach(model => {
    const modelId = model.modelId?.trim();
    if (!modelId || options.has(modelId)) {
      return;
    }
    const name = model.modelName?.trim() || modelId;
    options.set(modelId, {
      modelId,
      label: model.version ? `${name} ${model.version}` : name,
      deployed: true,
    });
  });
  selectedIds.forEach(modelId => {
    if (!options.has(modelId)) {
      options.set(modelId, { modelId, label: modelId, deployed: false });
    }
  });
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
}

type RoleEditorModalProps = {
  isOpen: boolean;
  initial: RoleFormState;
  existingRoles: CustomRoleResponse[];
  availableModels: { modelId?: string; modelName?: string; version?: string }[];
  saving: boolean;
  onClose: () => void;
  onSave: (form: RoleFormState) => void;
};

const checkboxClass = 'mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#6ED47C]';

const RoleEditorModal = ({
  isOpen,
  initial,
  existingRoles,
  availableModels,
  saving,
  onClose,
  onSave,
}: RoleEditorModalProps) => {
  const { t } = useTranslation('Roles');
  const [form, setForm] = useState<RoleFormState>(initial);
  const [submitted, setSubmitted] = useState(false);
  const errors = validateRoleForm(form, existingRoles);
  const modelOptions = useMemo(
    () => buildRoleModelOptions(availableModels, form.modelIds),
    [availableModels, form.modelIds]
  );

  if (!isOpen) {
    return null;
  }

  const submit = () => {
    setSubmitted(true);
    if (errors.length === 0) {
      onSave(form);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      size="w-full max-w-[760px]"
      isCloseable={!saving}
      onClose={onClose}
    >
      <div className="relative max-h-[80vh] overflow-y-auto pr-1">
        <Typography
          variant="h6"
          className="font-light text-white"
        >
          {form.id ? t('Edit role') : t('New role')}
        </Typography>
        <p className="mt-1 text-sm text-white text-opacity-60">
          {t('Members with this role keep the basics and get the permissions you pick below.')}
        </p>

        <label
          htmlFor="custom-role-name"
          className="mt-4 block text-sm text-white text-opacity-80"
        >
          {t('Name')}
        </label>
        <Input
          id="custom-role-name"
          className="mt-1 w-full"
          type="text"
          maxLength={ROLE_NAME_MAX}
          value={form.name}
          placeholder={t('For example: Echo readers')}
          onChange={e => setForm({ ...form, name: e.target.value })}
        />
        <label
          htmlFor="custom-role-description"
          className="mt-3 block text-sm text-white text-opacity-80"
        >
          {t('Description (optional)')}
        </label>
        <textarea
          id="custom-role-description"
          className="mt-1 block w-full rounded-lg border-none bg-white bg-opacity-10 px-3 py-2 text-white focus:outline-none"
          rows={2}
          maxLength={ROLE_DESCRIPTION_MAX}
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />

        <h2 className="mt-5 text-base text-white">{t('Permissions')}</h2>
        <div className="mt-2 rounded-lg border border-white border-opacity-10 p-3">
          <p className="text-xs uppercase tracking-wide text-white text-opacity-50">
            {t('Always included')}
          </p>
          <ul className="mt-1 space-y-1">
            {BASELINE_PERMISSION_INFO.map(permission => (
              <li
                key={permission.id}
                className="flex items-start gap-2 text-sm text-white text-opacity-70"
              >
                <input
                  type="checkbox"
                  checked
                  disabled
                  className={checkboxClass}
                  aria-label={t(permission.label)}
                />
                <span>
                  <span className="text-white">{t(permission.label)}</span>
                  {' · '}
                  {t(permission.description)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {PERMISSION_GROUPS.map(group => (
            <fieldset
              key={group.id}
              className="rounded-lg border border-white border-opacity-10 p-3"
            >
              <legend className="px-1 text-xs uppercase tracking-wide text-white text-opacity-50">
                {t(group.label)}
              </legend>
              {group.permissions.map(permission => {
                const id = `custom-role-permission-${permission.id}`;
                return (
                  <label
                    key={permission.id}
                    htmlFor={id}
                    className="flex cursor-pointer items-start gap-2 py-1 text-sm"
                  >
                    <input
                      id={id}
                      type="checkbox"
                      className={checkboxClass}
                      checked={form.permissions.includes(permission.id)}
                      onChange={() => setForm(togglePermission(form, permission.id))}
                    />
                    <span>
                      <span className="block text-white">{t(permission.label)}</span>
                      <span className="block text-xs text-white text-opacity-60">
                        {t(permission.description)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>

        <h2 className="mt-5 text-base text-white">{t('Models')}</h2>
        <div
          className="mt-2 flex flex-wrap gap-4 text-sm text-white"
          role="radiogroup"
          aria-label={t('Models')}
        >
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="custom-role-models"
              className="accent-[#6ED47C]"
              checked={form.allModels}
              onChange={() => setForm({ ...form, allModels: true })}
            />
            {t('All models, including ones added later')}
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="custom-role-models"
              className="accent-[#6ED47C]"
              checked={!form.allModels}
              onChange={() => setForm({ ...form, allModels: false })}
            />
            {t('Only the models I pick')}
          </label>
        </div>
        {!form.allModels && (
          <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-white border-opacity-10 p-3 sm:grid-cols-2">
            {modelOptions.length === 0 && (
              <p className="text-sm text-white text-opacity-60">{t('No models are deployed.')}</p>
            )}
            {modelOptions.map(option => {
              const id = `custom-role-model-${option.modelId}`;
              return (
                <label
                  key={option.modelId}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-white"
                >
                  <input
                    id={id}
                    type="checkbox"
                    className={checkboxClass.replace('mt-1', '')}
                    checked={form.modelIds.includes(option.modelId)}
                    onChange={() => setForm(toggleModel(form, option.modelId))}
                  />
                  <span>
                    {option.label}
                    {!option.deployed && (
                      <span className="ml-1 text-xs text-white text-opacity-50">
                        ({t('not deployed')})
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {submitted && errors.length > 0 && (
          <ul
            className="mt-3 list-disc pl-5 text-sm text-red-400"
            role="alert"
          >
            {errors.map(error => (
              <li key={error}>{t(ROLE_FORM_ERROR_MESSAGES[error])}</li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex w-full justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            className="h-[41px] min-w-[111px] rounded-lg bg-transparent text-gray-400"
            onClick={onClose}
          >
            {t('Cancel')}
          </button>
          <Button
            disabled={saving}
            className="h-[41px] min-w-[111px] rounded-lg"
            onClick={submit}
          >
            {saving ? t('Saving…') : form.id ? t('Save changes') : t('Create role')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default RoleEditorModal;
