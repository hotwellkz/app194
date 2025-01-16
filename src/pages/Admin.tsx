import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, serverTimestamp, orderBy, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile, getAuth } from 'firebase/auth';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebase/auth';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { UserList } from '../components/admin/UserList';
import { AddUserModal } from '../components/admin/AddUserModal';
import { AdminUser } from '../types/admin';

export const Admin: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminUser[];
      
      setUsers(usersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddUser = async (userData: {
    email: string;
    displayName: string;
    password: string;
    role: 'admin' | 'employee' | 'user';
  }) => {
    try {
      // Создаем пользователя в Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );

      // Обновляем профиль пользователя
      await updateProfile(userCredential.user, {
        displayName: userData.displayName
      });

      // Сохраняем дополнительные данные в Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        createdAt: serverTimestamp()
      });
      
      setShowAddModal(false);
      showSuccessNotification('Пользователь успешно добавлен');
    } catch (error) {
      showErrorNotification('Ошибка при добавлении пользователя');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) return;

    const auth = getAuth();

    try {
      // Удаляем пользователя из Firebase Authentication
      await auth.deleteUser(userId);

      // Удаляем данные пользователя из Firestore
      await deleteDoc(doc(db, 'users', userId));

      showSuccessNotification('Пользователь успешно удален');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      
      // Если пользователь не найден в Auth, удаляем только из Firestore
      if (error.code === 'auth/user-not-found') {
        try {
          await deleteDoc(doc(db, 'users', userId));
          showSuccessNotification('Пользователь успешно удален');
          return;
        } catch (firestoreError) {
          console.error('Error deleting user from Firestore:', firestoreError);
        }
      }

      showErrorNotification('Ошибка при удалении пользователя');
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'employee' | 'user') => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      showSuccessNotification('Роль пользователя успешно обновлена');
    } catch (error) {
      showErrorNotification('Ошибка при обновлении роли');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button onClick={() => navigate(-1)} className="mr-4">
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">Управление пользователями</h1>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors"
            >
              <UserPlus className="w-5 h-5 mr-1" />
              Добавить пользователя
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <UserList
          users={users}
          onRoleChange={handleRoleChange}
          onDelete={handleDeleteUser}
          loading={loading}
        />
      </div>

      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddUser}
      />
    </div>
  );
};