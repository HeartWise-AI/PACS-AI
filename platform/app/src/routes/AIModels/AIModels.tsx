import React from 'react';
import { AdminHeader, ButtonSecondary, Sidebar, Typography } from '@ohif/ui';
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
                <ButtonSecondary
                  onClick={() => {}}
                  className="mt-5 h-[40px] w-full"
                >
                  {'View More'}
                </ButtonSecondary>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIModelsPage;
