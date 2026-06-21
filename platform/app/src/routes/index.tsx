import React from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@ohif/ui-next';

// Route Components
import DataSourceWrapper from './DataSourceWrapper';
import WorkList from './WorkList';
import Login from './Login';
import Register from './Register';
import UserConsent from './User/Consent';
import ChangePassword from './ChangePassword';
import ResetPassword from './ResetPassword';
import Local from './Local';
import Debug from './Debug';
import NotFound from './NotFound';
import buildModeRoutes from './buildModeRoutes';
import PrivateRoute from './PrivateRoute';
import PropTypes from 'prop-types';
import Members from './Members';
import KibanaLogs from './KibanaLogs';
import AIModels from './AIModels';
import Settings from './Settings';
import TenantNotFound from './TenantNotFound';
import WorkspaceSettings from './WorkspaceSettings';
import { routerBasename } from '../utils/publicUrl';
import { useAppConfig } from '@state';
import { history } from '../utils/history';

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
  const [appConfig] = useAppConfig();
  const { showStudyList } = appConfig;

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
        {showStudyList && (
          <p className="mt-2">
            Return to the{' '}
            <Link
              className="text-primary-light"
              to="/"
            >
              study list
            </Link>{' '}
            to select a different study to view.
          </p>
        )}
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
    path: `/notfoundserver`,
    children: NotFoundServer,
  },
  {
    path: `/notfoundstudy`,
    children: NotFoundStudy,
  },
  {
    path: `/debug`,
    children: Debug,
  },
  {
    path: '/tenantnotfound',
    children: TenantNotFound,
  },
  {
    path: `/local`,
    children: Local.bind(null, { modePath: '' }), // navigate to the worklist
  },
  {
    path: `/localbasic`,
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
  showStudyList,
}: withAppTypes) => {
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

  const path =
    routerBasename.length > 1 && routerBasename.endsWith('/')
      ? routerBasename.substring(0, routerBasename.length - 1)
      : routerBasename;

  console.log('Registering worklist route', routerBasename, path);

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

  const RegisterRoute = {
    path: `/register`,
    children: DataSourceWrapper,
    private: true,
    props: { children: Register, servicesManager, extensionManager },
  };

  const UserConsentRoute = {
    path: `/user/consent`,
    children: DataSourceWrapper,
    private: true,
    props: { children: UserConsent, servicesManager, extensionManager },
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
    path: `/admin/members`,
    children: DataSourceWrapper,
    private: true,
    props: { children: Members, servicesManager, extensionManager },
  };

  const WorkspaceSettingsRoute = {
    path: `/admin/workspace-settings`,
    children: DataSourceWrapper,
    private: true,
    props: { children: WorkspaceSettings, servicesManager, extensionManager },
  };

  const KibanaLogsRoute = {
    path: `/admin/kibana-logs`,
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

  const customRoutes = customizationService.getCustomization('routes.customRoutes');

  const allRoutes = [
    ...routes,
    ...(showStudyList ? [WorkListRoute] : []),
    ...(showStudyList ? [UserConsentRoute] : []),
    ...(showStudyList ? [LoginRoute] : []),
    ...(showStudyList ? [RegisterRoute] : []),
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
    const [appConfig] = useAppConfig();
    const { showErrorDetails } = appConfig;

    history.navigate = useNavigate();

    // eslint-disable-next-line react/jsx-props-no-spreading
    return (
      <ErrorBoundary
        context={`Route ${route.path}`}
        showErrorDetails={showErrorDetails}
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

  // All routes are private by default and then we let the user auth service
  // to check if it is enabled or not
  // Todo: I think we can remove the second public return below
  return (
    <Routes>
      {allRoutes.map((route, i) => {
        return route.private === true ? (
          <Route
            key={i}
            path={route.path}
            element={
              <PrivateRoute
                handleUnauthenticated={() => userAuthenticationService.handleUnauthenticated()}
              >
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
