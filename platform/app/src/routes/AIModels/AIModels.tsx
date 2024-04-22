import React from 'react';
import { AdminHeader, Sidebar } from '@ohif/ui';
import { useTranslation } from 'react-i18next';

const AIModelsPage = () => {
  const { t } = useTranslation();

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

  return (
    <div className="h-screen w-screen overflow-x-hidden bg-[#151815]">
      <div className="flex w-full bg-[#151815]">
        <Sidebar />
        <div className="ohif-scrollbar mr-5 flex grow flex-col overflow-y-auto">
          <AdminHeader title="AI Models" />
          <div className="grid grid-cols-3 gap-5">
            {aiModelData.map(item => (
              <div className="rounded-xl border border-white border-opacity-10 bg-white bg-opacity-[5%] p-5">
                <h1 className="text-xl text-white">{item.title}</h1>
                <p className="my-2 text-sm font-light text-white text-opacity-70">{item.desc}</p>
                <div className="flex items-center justify-between pt-2">
                  <h2 className="text-sm font-light text-white text-opacity-70">{t('Name')}</h2>
                  <h2 className="text-sm font-light text-white">{item.name}</h2>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <h2 className="text-sm font-light text-white text-opacity-70">
                    {t('Approval Date')}
                  </h2>
                  <h2 className="text-sm font-light text-white">{item.approvalDate}</h2>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <h2 className="text-sm font-light text-white text-opacity-70">{t('Date')}</h2>
                  <h2 className="text-sm font-light text-white">{item.date}</h2>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <h2 className="text-sm font-light text-white text-opacity-70">
                    {t('Last Update')}
                  </h2>
                  <h2 className="text-sm font-light text-white">{item.lastUpdate}</h2>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <h2 className="text-sm font-light text-white text-opacity-70">
                    {t('Licensed to')}
                  </h2>
                  <h2 className="text-sm font-light text-white">{item.lastUpdate}</h2>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <h2 className="text-sm font-light text-white text-opacity-70">{t('Version')}</h2>
                  <h2 className="text-sm font-light text-white">{item.version}</h2>
                </div>
                <button className="relative mt-5 w-full overflow-hidden rounded-lg border-[1px] border-[rgba(62,241,209,.8)] py-2 px-4 text-white">
                  <span className="relative z-10 bg-gradient-to-r from-[rgba(108,105,244,1)] to-[rgba(62,241,209,1)] bg-clip-text text-lg font-bold text-transparent">
                    View More
                  </span>
                  <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-[rgba(108,105,244,0.1)] to-[rgba(62,241,209,0.1)]"></span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIModelsPage;
