import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onIdTokenChanged } from "firebase/auth";

export const firebaseApp = initializeApp({
  apiKey: "AIzaSyBNmd_LkU1Axa7_3_TAiv0T6uR0hcu2Duc",
  authDomain: "emergencysiting.firebaseapp.com",
  projectId: "emergencysiting",
  appId: "1:375669771805:web:c4c438c7b08e3062ed00f4",
});
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

onIdTokenChanged(auth, async (user) => {
  if (user) {
    const t = await user.getIdToken();
    localStorage.setItem("idToken", t);
  } else {
    localStorage.removeItem("idToken");
  }
});
