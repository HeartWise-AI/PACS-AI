import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'XXXXXXXXXXXXXXX',
  authDomain: 'XXXXXXXXXXXXXXXXXX',
  projectId: 'XXXXXXXXXXXXXXXXX',
  storageBucket: 'XXXXXXXXXXXXXXXX',
  messagingSenderId: 'XXXXXXXXXXXXXXXXXXX',
  appId: 'XXXXXXXXXXXXXXXXXXXX',
  measurementId: 'XXXXXXXXXXXXXXXXXXXXXXXX',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export default app;
