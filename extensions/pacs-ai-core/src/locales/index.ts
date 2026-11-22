/**
 * PACS-AI translations, registered with i18n.addLocales in the core
 * extension's preRegistration (after OHIF loads its own locales).
 *
 * - Our namespaces (AIModelButton, ChatBox, Members, ...) are complete files.
 * - Files named after an OHIF namespace (Common, StudyList, StudyBrowser,
 *   Buttons, Header, ...) hold only the keys we add or change in that OHIF
 *   namespace; addLocales merges them over OHIF's (deep, overwrite).
 *
 * When adding a file, add it here (one import per file; no require.context so
 * jest can load it).
 */
import ar_AIModelButton from './ar/AIModelButton.json';
import ar_AboutModal from './ar/AboutModal.json';
import ar_ChatBox from './ar/ChatBox.json';
import ar_Common from './ar/Common.json';
import ar_HeaderPanel from './ar/HeaderPanel.json';
import ar_Members from './ar/Members.json';
import ar_Onboarding from './ar/Onboarding.json';
import ar_Settings from './ar/Settings.json';
import ar_Sidebar from './ar/Sidebar.json';
import ar_StoreFileButton from './ar/StoreFileButton.json';
import ar_StudyBrowser from './ar/StudyBrowser.json';
import ar_StudyList from './ar/StudyList.json';
import ar_TopNavigation from './ar/TopNavigation.json';
import ar_TutorialProgressOverlay from './ar/TutorialProgressOverlay.json';
import ar_ViewportDownloadForm from './ar/ViewportDownloadForm.json';
import de_AIModelButton from './de/AIModelButton.json';
import de_ChatBox from './de/ChatBox.json';
import de_Common from './de/Common.json';
import de_DataSourceConfiguration from './de/DataSourceConfiguration.json';
import de_Header from './de/Header.json';
import de_HeaderPanel from './de/HeaderPanel.json';
import de_Members from './de/Members.json';
import de_Messages from './de/Messages.json';
import de_Onboarding from './de/Onboarding.json';
import de_Settings from './de/Settings.json';
import de_SidePanel from './de/SidePanel.json';
import de_Sidebar from './de/Sidebar.json';
import de_StoreFileButton from './de/StoreFileButton.json';
import de_StudyBrowser from './de/StudyBrowser.json';
import de_StudyList from './de/StudyList.json';
import de_TopNavigation from './de/TopNavigation.json';
import de_TutorialProgressOverlay from './de/TutorialProgressOverlay.json';
import en_US_AIModelButton from './en-US/AIModelButton.json';
import en_US_AiPredictions from './en-US/AiPredictions.json';
import en_US_ChatBox from './en-US/ChatBox.json';
import en_US_Common from './en-US/Common.json';
import en_US_HeaderPanel from './en-US/HeaderPanel.json';
import en_US_Members from './en-US/Members.json';
import en_US_Onboarding from './en-US/Onboarding.json';
import en_US_ResultModal from './en-US/ResultModal.json';
import en_US_Settings from './en-US/Settings.json';
import en_US_Sidebar from './en-US/Sidebar.json';
import en_US_StoreFileButton from './en-US/StoreFileButton.json';
import en_US_StudyBrowser from './en-US/StudyBrowser.json';
import en_US_StudyList from './en-US/StudyList.json';
import en_US_TopNavigation from './en-US/TopNavigation.json';
import en_US_TutorialProgressOverlay from './en-US/TutorialProgressOverlay.json';
import es_AIModelButton from './es/AIModelButton.json';
import es_Buttons from './es/Buttons.json';
import es_ChatBox from './es/ChatBox.json';
import es_Common from './es/Common.json';
import es_DataSourceConfiguration from './es/DataSourceConfiguration.json';
import es_Header from './es/Header.json';
import es_HeaderPanel from './es/HeaderPanel.json';
import es_Members from './es/Members.json';
import es_Messages from './es/Messages.json';
import es_Onboarding from './es/Onboarding.json';
import es_Settings from './es/Settings.json';
import es_Sidebar from './es/Sidebar.json';
import es_StoreFileButton from './es/StoreFileButton.json';
import es_StudyBrowser from './es/StudyBrowser.json';
import es_StudyList from './es/StudyList.json';
import es_TopNavigation from './es/TopNavigation.json';
import es_TutorialProgressOverlay from './es/TutorialProgressOverlay.json';
import es_UserPreferencesModal from './es/UserPreferencesModal.json';
import fr_AIModelButton from './fr/AIModelButton.json';
import fr_AboutModal from './fr/AboutModal.json';
import fr_AiPredictions from './fr/AiPredictions.json';
import fr_Buttons from './fr/Buttons.json';
import fr_ChatBox from './fr/ChatBox.json';
import fr_Common from './fr/Common.json';
import fr_DataSourceConfiguration from './fr/DataSourceConfiguration.json';
import fr_DatePicker from './fr/DatePicker.json';
import fr_Header from './fr/Header.json';
import fr_HeaderPanel from './fr/HeaderPanel.json';
import fr_MeasurementTable from './fr/MeasurementTable.json';
import fr_Members from './fr/Members.json';
import fr_Messages from './fr/Messages.json';
import fr_Onboarding from './fr/Onboarding.json';
import fr_ResultModal from './fr/ResultModal.json';
import fr_Settings from './fr/Settings.json';
import fr_SidePanel from './fr/SidePanel.json';
import fr_Sidebar from './fr/Sidebar.json';
import fr_StoreFileButton from './fr/StoreFileButton.json';
import fr_StudyBrowser from './fr/StudyBrowser.json';
import fr_StudyList from './fr/StudyList.json';
import fr_TopNavigation from './fr/TopNavigation.json';
import fr_TutorialProgressOverlay from './fr/TutorialProgressOverlay.json';
import fr_UserPreferencesModal from './fr/UserPreferencesModal.json';
import fr_ViewportDownloadForm from './fr/ViewportDownloadForm.json';
import test_LNG_StudyList from './test-LNG/StudyList.json';
import zh_AIModelButton from './zh/AIModelButton.json';
import zh_StoreFileButton from './zh/StoreFileButton.json';

const locales: Record<string, Record<string, Record<string, unknown>>> = {
  'ar': {
    AIModelButton: ar_AIModelButton,
    AboutModal: ar_AboutModal,
    ChatBox: ar_ChatBox,
    Common: ar_Common,
    HeaderPanel: ar_HeaderPanel,
    Members: ar_Members,
    Onboarding: ar_Onboarding,
    Settings: ar_Settings,
    Sidebar: ar_Sidebar,
    StoreFileButton: ar_StoreFileButton,
    StudyBrowser: ar_StudyBrowser,
    StudyList: ar_StudyList,
    TopNavigation: ar_TopNavigation,
    TutorialProgressOverlay: ar_TutorialProgressOverlay,
    ViewportDownloadForm: ar_ViewportDownloadForm,
  },
  'de': {
    AIModelButton: de_AIModelButton,
    ChatBox: de_ChatBox,
    Common: de_Common,
    DataSourceConfiguration: de_DataSourceConfiguration,
    Header: de_Header,
    HeaderPanel: de_HeaderPanel,
    Members: de_Members,
    Messages: de_Messages,
    Onboarding: de_Onboarding,
    Settings: de_Settings,
    SidePanel: de_SidePanel,
    Sidebar: de_Sidebar,
    StoreFileButton: de_StoreFileButton,
    StudyBrowser: de_StudyBrowser,
    StudyList: de_StudyList,
    TopNavigation: de_TopNavigation,
    TutorialProgressOverlay: de_TutorialProgressOverlay,
  },
  'en-US': {
    AIModelButton: en_US_AIModelButton,
    AiPredictions: en_US_AiPredictions,
    ChatBox: en_US_ChatBox,
    Common: en_US_Common,
    HeaderPanel: en_US_HeaderPanel,
    Members: en_US_Members,
    Onboarding: en_US_Onboarding,
    ResultModal: en_US_ResultModal,
    Settings: en_US_Settings,
    Sidebar: en_US_Sidebar,
    StoreFileButton: en_US_StoreFileButton,
    StudyBrowser: en_US_StudyBrowser,
    StudyList: en_US_StudyList,
    TopNavigation: en_US_TopNavigation,
    TutorialProgressOverlay: en_US_TutorialProgressOverlay,
  },
  'es': {
    AIModelButton: es_AIModelButton,
    Buttons: es_Buttons,
    ChatBox: es_ChatBox,
    Common: es_Common,
    DataSourceConfiguration: es_DataSourceConfiguration,
    Header: es_Header,
    HeaderPanel: es_HeaderPanel,
    Members: es_Members,
    Messages: es_Messages,
    Onboarding: es_Onboarding,
    Settings: es_Settings,
    Sidebar: es_Sidebar,
    StoreFileButton: es_StoreFileButton,
    StudyBrowser: es_StudyBrowser,
    StudyList: es_StudyList,
    TopNavigation: es_TopNavigation,
    TutorialProgressOverlay: es_TutorialProgressOverlay,
    UserPreferencesModal: es_UserPreferencesModal,
  },
  'fr': {
    AIModelButton: fr_AIModelButton,
    AboutModal: fr_AboutModal,
    AiPredictions: fr_AiPredictions,
    Buttons: fr_Buttons,
    ChatBox: fr_ChatBox,
    Common: fr_Common,
    DataSourceConfiguration: fr_DataSourceConfiguration,
    DatePicker: fr_DatePicker,
    Header: fr_Header,
    HeaderPanel: fr_HeaderPanel,
    MeasurementTable: fr_MeasurementTable,
    Members: fr_Members,
    Messages: fr_Messages,
    Onboarding: fr_Onboarding,
    ResultModal: fr_ResultModal,
    Settings: fr_Settings,
    SidePanel: fr_SidePanel,
    Sidebar: fr_Sidebar,
    StoreFileButton: fr_StoreFileButton,
    StudyBrowser: fr_StudyBrowser,
    StudyList: fr_StudyList,
    TopNavigation: fr_TopNavigation,
    TutorialProgressOverlay: fr_TutorialProgressOverlay,
    UserPreferencesModal: fr_UserPreferencesModal,
    ViewportDownloadForm: fr_ViewportDownloadForm,
  },
  'test-LNG': {
    StudyList: test_LNG_StudyList,
  },
  'zh': {
    AIModelButton: zh_AIModelButton,
    StoreFileButton: zh_StoreFileButton,
  },
};

export default locales;
