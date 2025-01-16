import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { app } from './config';
import { db } from './config';

export const auth = getAuth(app);

export const registerUser = async (email: string, password: string, displayName: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Создаем запись в Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email,
      displayName,
      role: 'user',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await updateProfile(userCredential.user, { displayName });
    return userCredential.user;
  } catch (error: any) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        throw new Error('Этот email уже используется');
      case 'auth/invalid-email':
        throw new Error('Некорректный email');
      case 'auth/weak-password':
        throw new Error('Слишком простой пароль');
      default:
        throw new Error('Ошибка при регистрации');
    }
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Получаем дополнительные данные пользователя из Firestore
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    if (!userDoc.exists()) {
      throw new Error('Данные пользователя не найдены');
    }
    
    return userCredential.user;
  } catch (error: any) {
    switch (error.code) {
      case 'auth/invalid-email':
        throw new Error('Некорректный email');
      case 'auth/user-disabled':
        throw new Error('Аккаунт заблокирован');
      case 'auth/user-not-found':
        throw new Error('Пользователь не найден');
      case 'auth/wrong-password':
        throw new Error('Неверный пароль');
      default:
        throw new Error('Ошибка при входе');
    }
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error('Ошибка при выходе из системы');
  }
};

// Функция для проверки роли пользователя
export const getUserRole = async (uid: string): Promise<string> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      return 'user';
    }
    return userDoc.data().role;
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'user';
  }
};

// Функция для получения всех пользователей
export const getAllUsers = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    return usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};