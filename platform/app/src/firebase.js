import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAG88Dhz5XAmq2jDbpzF9DVJPzMO5tnres',
  authDomain: 'pacs-ai-staging-b0930.firebaseapp.com',
  projectId: 'pacs-ai-staging-b0930',
  storageBucket: 'pacs-ai-staging-b0930.appspot.com',
  messagingSenderId: '465941683159',
  appId: '1:465941683159:web:d037a643681b12661ac992',
  measurementId: 'G-X03Y53VTDM',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export default app;
