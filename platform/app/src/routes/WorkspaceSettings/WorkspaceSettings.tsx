import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ButtonGradient, Typography } from '@ohif/ui';
import HeaderPanel from '../../components/HeaderPanel';
import SidebarAdmin from '../../components/SidebarAdmin';
import { AlertContext } from '../../AlertProvider';
import copyIcon from './../../assets/pacs/icons/copy-gradient.png';
import tenantRepository from '../../api/tenantRepository';
import { GetTenantInfoResponse } from '../../api/tenantDTO';

const WorkspaceSettingsPage = () => {
  const { t } = useTranslation();
  const showAlert = useContext(AlertContext);
  const [tenantInfo, setTenantInfo] = useState<Partial<GetTenantInfoResponse>>({});

  const aiModelData = [
    {
      title: 'X2D LVEF detection',
      desc: 'CathEF is a video-based deep neural network (DNN) designed to predict left ventricular ejection fraction (LVEF) from left coronary angiograms.',
      name: 'CathEF',
      approvalDate: '2023-04-17',
      date: '2023-03-01',
      lastUpdate: '2023-04-17',
      licensedTo: 'Montreal Heart Institute',
      version: '1.0',
    },
    {
      title: 'X2D LVEF detection',
      desc: 'CathEF is a video-based deep neural network (DNN) designed to predict left ventricular ejection fraction (LVEF) from left coronary angiograms.',
      name: 'CathEF',
      approvalDate: '2023-04-17',
      date: '2023-03-01',
      lastUpdate: '2023-04-17',
      licensedTo: 'Montreal Heart Institute',
      version: '1.0',
    },
    {
      title: 'X2D LVEF detection',
      desc: 'CathEF is a video-based deep neural network (DNN) designed to predict left ventricular ejection fraction (LVEF) from left coronary angiograms.',
      name: 'CathEF',
      approvalDate: '2023-04-17',
      date: '2023-03-01',
      lastUpdate: '2023-04-17',
      licensedTo: 'Montreal Heart Institute',
      version: '1.0',
    },
  ];

  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        const response = await tenantRepository.GetTenantInfo();
        setTenantInfo(response.data);
      } catch (error) {
        console.error(`Can't fetch tenant info: ${error}`);
      }
    };

    fetchTenantInfo();
  }, [tenantRepository]);
  const CopyToClipboardButton = ({ text }) => {
    const copyToClipboard = () => {
      navigator.clipboard.writeText(text).then(() => {
        showAlert('Copy to clipboard success', 'success');
      });
    };

    return (
      <button className="p-0 focus:ring-0">
        <img
          src={copyIcon}
          alt="Copy icon"
          className="ml-2 h-5 w-5 cursor-pointer"
          onClick={copyToClipboard}
        />
      </button>
    );
  };
  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815]">
        <SidebarAdmin />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <HeaderPanel title="Workspace Settings" />
          <div className="rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
            <div className="">
              <h1 className="text-2xl text-white">{tenantInfo.name}</h1>
            </div>
            <div className="flex flex-col text-sm font-light text-white text-opacity-70 sm:flex-row sm:items-center">
              <div className="flex items-center sm:ml-1">
                {tenantInfo.id}
                <CopyToClipboardButton text={tenantInfo.id} />
              </div>
            </div>
            <div className="mt-5 mb-3">
              <h1 className="text-2xl text-white">{t('Available AI Models')}</h1>
            </div>
            <div className="grid grid-cols-3 gap-5">
              {aiModelData.map(item => (
                <div className="rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
                  <Typography
                    variant="h6"
                    className="text-white"
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    variant="body"
                    className="my-2 text-sm font-light text-white text-opacity-70"
                  >
                    {item.desc}
                  </Typography>
                  <div className="flex items-center justify-between pt-2">
                    <Typography
                      variant="body"
                      className="font-light text-white text-opacity-70"
                    >
                      {t('Name')}
                    </Typography>
                    <Typography
                      variant="body"
                      className="font-light text-white"
                    >
                      {item.name}
                    </Typography>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Typography
                      variant="body"
                      className="font-light text-white text-opacity-70"
                    >
                      {t('Approval Date')}
                    </Typography>
                    <Typography
                      variant="body"
                      className="font-light text-white"
                    >
                      {item.approvalDate}
                    </Typography>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Typography
                      variant="body"
                      className="font-light text-white text-opacity-70"
                    >
                      {t('Date')}
                    </Typography>
                    <Typography
                      variant="body"
                      className="font-light text-white"
                    >
                      {item.date}
                    </Typography>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Typography
                      variant="body"
                      className="font-light text-white text-opacity-70"
                    >
                      {t('Last Update')}
                    </Typography>
                    <Typography
                      variant="body"
                      className="font-light text-white"
                    >
                      {item.lastUpdate}
                    </Typography>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Typography
                      variant="body"
                      className="font-light text-white text-opacity-70"
                    >
                      {t('Licensed to')}
                    </Typography>
                    <Typography
                      variant="body"
                      className="font-light text-white"
                    >
                      {item.licensedTo}
                    </Typography>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Typography
                      variant="body"
                      className="font-light text-white text-opacity-70"
                    >
                      {t('Version')}
                    </Typography>
                    <Typography
                      variant="body"
                      className="font-light text-white"
                    >
                      {item.version}
                    </Typography>
                  </div>
                  <ButtonGradient
                    onClick={() => {}}
                    className="mt-5 h-[40px] w-full"
                  >
                    {'View More'}
                  </ButtonGradient>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSettingsPage;
