import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent } from '@testing-library/react';
import { AlertContext } from '../../../alerts';
import RolesSection from './RolesSection';
import { useCustomRoles, type CustomRolesRepository } from '../roles/useCustomRoles';

/* eslint-disable react/prop-types -- minimal stand-ins for the UI kit */
jest.mock('@pacs-ai/ui', () => {
  const React = jest.requireActual('react');
  return {
    Button: ({ children, ...props }) => React.createElement('button', props, children),
    Input: props => React.createElement('input', props),
    Typography: ({ children, className }) => React.createElement('div', { className }, children),
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) =>
      key.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(options[name] ?? '')),
    i18n: { language: 'en-US' },
  }),
}));

const echoRole = {
  id: 'r1',
  name: 'Echo readers',
  description: 'Echo team',
  permissions: ['models.use', 'feedback.view'],
  allModels: false,
  modelIds: ['PanEcho'],
  memberCount: 0,
  createdAt: 1,
  updatedAt: 1,
};

function makeRepository(): jest.Mocked<CustomRolesRepository> {
  return {
    GetCustomRoles: jest.fn().mockResolvedValue({ data: { roles: [echoRole], permissions: [] } }),
    CreateCustomRole: jest.fn().mockResolvedValue({ data: echoRole }),
    UpdateCustomRole: jest.fn().mockResolvedValue({ data: echoRole }),
    DeleteCustomRole: jest.fn().mockResolvedValue({ data: undefined }),
  } as unknown as jest.Mocked<CustomRolesRepository>;
}

const models = [
  { modelId: 'PanEcho', modelName: 'PanEcho', version: '1.0.3' },
  { modelId: 'DeepRV_CLIP', modelName: 'DeepRV-CLIP', version: '1.0.1' },
];

function Harness({ repository }: { repository: CustomRolesRepository }) {
  const roles = useCustomRoles({ enabled: true, repository });
  return (
    <RolesSection
      roles={roles}
      availableModels={models}
    />
  );
}

describe('RolesSection', () => {
  let container: HTMLDivElement;
  let root: Root;
  let showAlert: jest.Mock;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    showAlert = jest.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(repository: CustomRolesRepository) {
    await act(async () => {
      root.render(
        <AlertContext.Provider value={showAlert}>
          <Harness repository={repository} />
        </AlertContext.Provider>
      );
    });
  }

  const button = (name: string) =>
    [...document.querySelectorAll('button')].find(item => item.textContent === name)!;

  it('lists roles with their extra permissions and models', async () => {
    await render(makeRepository());
    expect(container.textContent).toContain('Echo readers');
    expect(container.textContent).toContain('View model feedback');
    expect(container.textContent).toContain('PanEcho');
    expect(container.textContent).not.toContain('Use models · Run');
  });

  it('creates a role limited to picked models', async () => {
    const repository = makeRepository();
    await render(repository);
    await act(async () => fireEvent.click(button('New role')));

    const name = document.getElementById('custom-role-name') as HTMLInputElement;
    await act(async () => fireEvent.change(name, { target: { value: ' Leads ' } }));
    await act(async () =>
      fireEvent.click(document.getElementById('custom-role-permission-members.invite')!)
    );
    const onlyPicked = [...document.querySelectorAll('input[type=radio]')][1] as HTMLInputElement;
    await act(async () => fireEvent.click(onlyPicked));
    await act(async () => fireEvent.click(button('Create role')));
    expect(repository.CreateCustomRole).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Pick at least one model, or allow all models.');

    await act(async () =>
      fireEvent.click(document.getElementById('custom-role-model-DeepRV_CLIP')!)
    );
    await act(async () => fireEvent.click(button('Create role')));
    expect(repository.CreateCustomRole).toHaveBeenCalledWith({
      name: 'Leads',
      description: '',
      permissions: ['members.invite'],
      allModels: false,
      modelIds: ['DeepRV_CLIP'],
    });
    expect(showAlert).toHaveBeenCalledWith('Role created.', 'success');
    expect(repository.GetCustomRoles).toHaveBeenCalledTimes(2);
  });

  it('explains when a role cannot be deleted because members still have it', async () => {
    const repository = makeRepository();
    repository.DeleteCustomRole.mockRejectedValue({ errorCode: 'ROLE_IN_USE', message: 'in use' });
    await render(repository);
    await act(async () => fireEvent.click(button('Delete')));
    const confirm = [...document.querySelectorAll('button')]
      .filter(b => b.textContent === 'Delete')
      .pop()!;
    await act(async () => fireEvent.click(confirm));
    expect(showAlert).toHaveBeenCalledWith(
      'This role is still assigned to members. Give them another role first.',
      'error'
    );
  });
});
