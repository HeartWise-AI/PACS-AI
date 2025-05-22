import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AIModelButton } from '@ohif/ui';
import { AvailableModelsContext } from '../ViewerLayout/index';
import { Button, Header, Icons, useModal } from '@ohif/ui-next';
import { useSystem } from '@ohif/core';
import { Toolbar } from '../Toolbar/Toolbar';
import HeaderPatientInfo from './HeaderPatientInfo';
import { PatientInfoVisibility } from './HeaderPatientInfo/HeaderPatientInfo';
import { preserveQueryParameters } from '@ohif/app';
import ChatButton from '@ohif/ui/src/components/ChatButton/ChatButton';

function ViewerHeader({ appConfig }: withAppTypes<{ appConfig: AppTypes.Config }>) {
  const { servicesManager, extensionManager, commandsManager } = useSystem();
  const { customizationService } = servicesManager.services;

  const navigate = useNavigate();
  const location = useLocation();
  const { inferenceAvailableModels, fetchingAvailableModels } =
    useContext(AvailableModelsContext) || {};

  const onClickReturnButton = () => {
    const { pathname } = location;
    const dataSourceIdx = pathname.indexOf('/', 1);

    const dataSourceName = pathname.substring(dataSourceIdx + 1);
    const existingDataSource = extensionManager.getDataSources(dataSourceName);

    const searchQuery = new URLSearchParams();
    if (dataSourceIdx !== -1 && existingDataSource) {
      searchQuery.append('datasources', pathname.substring(dataSourceIdx + 1));
    }
    preserveQueryParameters(searchQuery);

    navigate({
      pathname: '/',
      search: decodeURIComponent(searchQuery.toString()),
    });
  };

  const { t } = useTranslation();
  const { show } = useModal();

  const AboutModal = customizationService.getCustomization('ohif.aboutModal');
  const UserPreferencesModal = customizationService.getCustomization('ohif.userPreferencesModal');

  const menuOptions = [
    {
      title: t('Header:About'),
      icon: 'info',
      onClick: () =>
        show({
          content: AboutModal,
          title: t('AboutModal:About OHIF Viewer'),
          containerClassName: 'max-w-md',
        }),
    },
    {
      title: t('Header:Preferences'),
      icon: 'settings',
      onClick: () =>
        show({
          content: UserPreferencesModal,
          title: t('UserPreferencesModal:User preferences'),
          containerClassName: 'flex max-w-4xl p-6 flex-col',
        }),
    },
  ];

  if (appConfig.oidc) {
    menuOptions.push({
      title: t('Header:Logout'),
      icon: 'power-off',
      onClick: async () => {
        navigate(`/logout?redirect_uri=${encodeURIComponent(window.location.href)}`);
      },
    });
  }

  return (
    <Header
      menuOptions={menuOptions}
      isReturnEnabled={!!appConfig.showStudyList}
      onClickReturnButton={onClickReturnButton}
      WhiteLabeling={appConfig.whiteLabeling}
      Secondary={
        <Toolbar
          servicesManager={servicesManager}
          buttonSection="secondary"
        />
      }
      PatientInfo={
        appConfig.showPatientInfo !== PatientInfoVisibility.DISABLED && (
          <HeaderPatientInfo
            servicesManager={servicesManager}
            appConfig={appConfig}
          />
        )
      }
      UndoRedo={
        <div className="text-primary flex cursor-pointer items-center">
          <Button
            variant="ghost"
            className="hover:bg-primary-dark"
            onClick={() => {
              commandsManager.run('undo');
            }}
          >
            <Icons.Undo className="" />
          </Button>
          <Button
            variant="ghost"
            className="hover:bg-primary-dark"
            onClick={() => {
              commandsManager.run('redo');
            }}
          >
            <Icons.Redo className="" />
          </Button>
        </div>
      }
    >
      <div className="flex items-center">
        <Toolbar servicesManager={servicesManager} />
        {/* NOTE: Added AIModelButton component */}
        <AIModelButton
          isShowBG={true}
          servicesManager={servicesManager}
          inferenceAvailableModels={inferenceAvailableModels}
          loading={fetchingAvailableModels}
        />
        {/* Chat button */}
        <div className="ml-2">
          <ChatButton
            servicesManager={servicesManager}
          />
        </div>
      </div>
    </Header>
  );
}

export default ViewerHeader;
