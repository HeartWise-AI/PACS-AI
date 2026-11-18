import { pacsAiTheme } from './theme/pacsAiTheme';

/**
 * `@pacs-ai/theme.customizationModule.pacsAiTheme`, listed in
 * pacs-ai/config/pacs-ai.js. Selecting it is what turns the theme on (see
 * applyTheme.ts); its value exposes the preset to code that wants the token
 * values (`customizationService.getCustomization('pacsAi.theme')`).
 */
export default function getCustomizationModule() {
  return [
    {
      name: 'pacsAiTheme',
      value: {
        'pacsAi.theme': pacsAiTheme,
      },
    },
  ];
}
