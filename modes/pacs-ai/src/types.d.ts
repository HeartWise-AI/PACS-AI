/**
 * @ohif/mode-longitudinal ships no type declarations (its package entry is
 * its build output). The part of its default export this mode uses.
 */
declare module '@ohif/mode-longitudinal' {
  type LongitudinalMode = {
    id: string;
    routeName: string;
    routes: Array<{ path: string; layoutTemplate: (...args: any[]) => any; [key: string]: any }>;
    extensions: Record<string, string>;
    onModeEnter: (args: any) => void;
    onModeExit: (args: any) => void;
    [key: string]: any;
  };

  const longitudinalMode: {
    id: string;
    modeFactory: (args: { modeConfiguration?: unknown; loadModules?: unknown }) => LongitudinalMode;
    extensionDependencies: Record<string, string>;
  };

  export default longitudinalMode;
  export const initToolGroups: (...args: any[]) => void;
  export const toolbarButtons: any[];
}
