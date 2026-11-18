// The study browser header's action icons, as in OHIF v3.13.14
// extensions/default/src/Panels/StudyBrowser/constants/actionIcons.ts
// (not exported by @ohif/extension-default).
type ActionIcon = { id: string; iconName: string; value: boolean };

const defaultActionIcons: ActionIcon[] = [
  {
    id: 'settings',
    iconName: 'Settings',
    value: false,
  },
];

export { defaultActionIcons };
export type { ActionIcon };
