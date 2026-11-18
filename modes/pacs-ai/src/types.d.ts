/**
 * @ohif/mode-basic ships no type declarations (its package `main` is its
 * build output). The part of its exports this mode uses
 * (modes/basic/src/index.tsx at OHIF 3.13.14).
 */
declare module '@ohif/mode-basic' {
  type ViewportEntry = { namespace: string; displaySetsToDisplay: string[] };

  type Layout = {
    id: string;
    props: {
      leftPanels: string[];
      rightPanels: string[];
      viewports: ViewportEntry[];
      [key: string]: unknown;
    };
  };

  type Route = {
    path: string;
    layoutTemplate: (...args: any[]) => Layout;
    layoutInstance: Layout;
    [key: string]: unknown;
  };

  type ModeInstance = {
    id: string;
    routeName: string;
    displayName: string;
    routes: Route[];
    extensions: Record<string, string>;
    modeCustomizations: string | Record<string, unknown>;
    onModeEnter: (this: any, args: any) => void;
    onModeExit: (this: any, args: any) => void;
    isValidMode: (
      this: any,
      args: { modalities: string; study?: any }
    ) => {
      valid: boolean;
      description: string;
    };
    [key: string]: any;
  };

  export const basicLayout: Layout;
  export const basicRoute: Route;
  export const modeInstance: ModeInstance;
  export const extensionDependencies: Record<string, string>;
  export const customizations: Record<string, Record<string, unknown>>;
  export const dicomecg: { sopClassHandler: string };
  export const cornerstone: Record<
    | 'measurements'
    | 'labelMapSegmentationPanel'
    | 'contourSegmentationPanel'
    | 'segmentation'
    | 'viewport',
    string
  >;
  export const mode: {
    id: string;
    modeFactory: (
      this: any,
      args: { modeConfiguration?: unknown; loadModules?: unknown }
    ) => ModeInstance;
    modeInstance: ModeInstance;
    extensionDependencies: Record<string, string>;
    customizations: Record<string, Record<string, unknown>>;
  };
  export function initToolGroups(...args: any[]): void;
  export default mode;
}
