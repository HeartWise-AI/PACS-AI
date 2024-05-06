import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '@ohif/ui';

// Route Components
import DataSourceWrapper from './DataSourceWrapper';
import WorkList from './WorkList';
import Login from './Login';
import ChangePassword from './ChangePassword';
import ResetPassword from './ResetPassword';
import Local from './Local';
import Debug from './Debug';
import NotFound from './NotFound';
import buildModeRoutes from './buildModeRoutes';
import PrivateRoute from './PrivateRoute';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Members from './Members';
import KibanaLogs from './KibanaLogs';
import AIModels from './AIModels';
import Settings from './Settings';
import TenantNotFound from './TenantNotFound';
import WorkspaceSettings from './WorkspaceSettings';

const NotFoundServer = ({
  message = 'Unable to query for studies at this time. Check your data source configuration or network connection',
}) => {
  return (
    <div className="absolute flex h-full w-full items-center justify-center text-white">
      <div>
        <h4>{message}</h4>
      </div>
    </div>
  );
};

NotFoundServer.propTypes = {
  message: PropTypes.string,
};

const NotFoundStudy = () => {
  return (
    <div className="absolute flex h-full w-full items-center justify-center text-white">
      <div>
        <h4>
          One or more of the requested studies are not available at this time. Return to the{' '}
          <Link
            className="text-primary-light"
            to={`/`}
          >
            study list
          </Link>{' '}
          to select a different study to view.
        </h4>
      </div>
    </div>
  );
};

NotFoundStudy.propTypes = {
  message: PropTypes.string,
};

// TODO: Include "routes" debug route if dev build
const bakedInRoutes = [
  {
    path: '/notfoundserver',
    children: NotFoundServer,
  },
  {
    path: '/notfoundstudy',
    children: NotFoundStudy,
  },
  {
    path: '/debug',
    children: Debug,
  },
  {
    path: '/tenantnotfound',
    children: TenantNotFound,
  },
  {
    path: '/local',
    children: Local.bind(null, { modePath: '' }), // navigate to the worklist
  },
  {
    path: '/localbasic',
    children: Local.bind(null, { modePath: 'viewer/dicomlocal' }),
  },
];

// NOT FOUND (404)
const notFoundRoute = { component: NotFound };

const createRoutes = ({
  modes,
  dataSources,
  extensionManager,
  servicesManager,
  commandsManager,
  hotkeysManager,
  routerBasename,
  showStudyList,
}) => {
  const routes =
    buildModeRoutes({
      modes,
      dataSources,
      extensionManager,
      servicesManager,
      commandsManager,
      hotkeysManager,
    }) || [];

  const { customizationService } = servicesManager.services;
  const WorkListRoute = {
    path: `/`,
    children: DataSourceWrapper,
    private: true,
    props: { children: WorkList, servicesManager, extensionManager },
  };

  const LoginRoute = {
    path: `/login`,
    children: DataSourceWrapper,
    private: true,
    props: { children: Login, servicesManager, extensionManager },
  };

  const ChangePasswordRoute = {
    path: `/change-password`,
    children: DataSourceWrapper,
    private: true,
    props: { children: ChangePassword, servicesManager, extensionManager },
  };

  const ResetPasswordRoute = {
    path: `/reset-password`,
    children: DataSourceWrapper,
    private: true,
    props: { children: ResetPassword, servicesManager, extensionManager },
  };

  const AIModelsRoute = {
    path: `/ai-models`,
    children: DataSourceWrapper,
    private: true,
    props: { children: AIModels, servicesManager, extensionManager },
  };

  const MembersRoute = {
    path: `/members`,
    children: DataSourceWrapper,
    private: true,
    props: { children: Members, servicesManager, extensionManager },
  };

  const WorkspaceSettingsRoute = {
    path: `/workspace-settings`,
    children: DataSourceWrapper,
    private: true,
    props: { children: WorkspaceSettings, servicesManager, extensionManager },
  };

  const KibanaLogsRoute = {
    path: `/kibana-logs`,
    children: DataSourceWrapper,
    private: true,
    props: { children: KibanaLogs, servicesManager, extensionManager },
  };

  const SettingsRoute = {
    path: `/settings`,
    children: DataSourceWrapper,
    private: true,
    props: { children: Settings, servicesManager, extensionManager },
  };

  const customRoutes = customizationService.getGlobalCustomization('customRoutes');
  const allRoutes = [
    ...routes,
    ...(showStudyList ? [WorkListRoute] : []),
    ...(showStudyList ? [LoginRoute] : []),
    ...(showStudyList ? [ChangePasswordRoute] : []),
    ...(showStudyList ? [ResetPasswordRoute] : []),
    ...(showStudyList ? [AIModelsRoute] : []),
    ...(showStudyList ? [MembersRoute] : []),
    ...(showStudyList ? [KibanaLogsRoute] : []),
    ...(showStudyList ? [SettingsRoute] : []),
    ...(showStudyList ? [WorkspaceSettingsRoute] : []),
    ...(customRoutes?.routes || []),
    ...bakedInRoutes,
    customRoutes?.notFoundRoute || notFoundRoute,
  ];

  function RouteWithErrorBoundary({ route, ...rest }) {
    // eslint-disable-next-line react/jsx-props-no-spreading
    return (
      <ErrorBoundary
        context={`Route ${route.path}`}
        fallbackRoute="/"
      >
        <route.children
          {...rest}
          {...route.props}
          route={route}
          servicesManager={servicesManager}
          extensionManager={extensionManager}
          hotkeysManager={hotkeysManager}
        />
      </ErrorBoundary>
    );
  }

  const { userAuthenticationService } = servicesManager.services;

  // Note: PrivateRoutes in react-router-dom 6.x should be defined within
  // a Route element
  return (
    <Routes>
      {allRoutes.map((route, i) => {
        return route.private === true ? (
          <Route
            key={i}
            exact
            path={route.path}
            element={
              <PrivateRoute handleUnauthenticated={userAuthenticationService.handleUnauthenticated}>
                <RouteWithErrorBoundary route={route} />
              </PrivateRoute>
            }
          ></Route>
        ) : (
          <Route
            key={i}
            path={route.path}
            element={<RouteWithErrorBoundary route={route} />}
          />
        );
      })}
    </Routes>
  );
};

export default createRoutes;
