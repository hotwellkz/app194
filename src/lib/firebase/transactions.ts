import { collection, doc, runTransaction, serverTimestamp, query, where, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { db } from './config';
import { CategoryCardType } from '../../types';
import { formatAmount, parseAmount } from './categories';
import { sendTelegramNotification, formatTransactionMessage } from '../../services/telegramService';

interface TransactionPhoto {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: { seconds: number; nanoseconds: number };
  path: string;
}

interface PhotoData {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  path: string;
}

interface TransferOptions {
  isSalary?: boolean;
  isCashless?: boolean;
}

const convertPhotoToFirestore = (photo: PhotoData): TransactionPhoto => ({
  name: photo.name,
  url: photo.url,
  type: photo.type,
  size: photo.size,
  uploadedAt: {
    seconds: Math.floor(photo.uploadedAt.getTime() / 1000),
    nanoseconds: (photo.uploadedAt.getTime() % 1000) * 1000000
  },
  path: photo.path
});

export const transferFunds = async (
  sourceCategory: CategoryCardType,
  targetCategory: CategoryCardType,
  amount: number,
  description: string,
  photos: PhotoData[] = [],
  options?: TransferOptions
): Promise<void> => {
  if (!amount || amount <= 0) {
    throw new Error('Сумма перевода должна быть больше нуля');
  }

  if (!description.trim()) {
    throw new Error('Необходимо указать комментарий к переводу');
  }

  try {
    await runTransaction(db, async (transaction) => {
      const sourceRef = doc(db, 'categories', sourceCategory.id);
      const targetRef = doc(db, 'categories', targetCategory.id);
      
      const sourceDoc = await transaction.get(sourceRef);
      const targetDoc = await transaction.get(targetRef);

      if (!sourceDoc.exists()) {
        throw new Error('Категория отправителя не найдена');
      }

      if (!targetDoc.exists()) {
        throw new Error('Категория получателя не найдена');
      }

      const sourceBalance = parseAmount(sourceDoc.data().amount);
      const targetBalance = parseAmount(targetDoc.data().amount);

      // Создаем ID для транзакции заранее
      const withdrawalId = doc(collection(db, 'transactions')).id;
      const depositId = doc(collection(db, 'transactions')).id;

      const timestamp = serverTimestamp();
      
      // Convert photos to Firestore format
      const firestorePhotos = photos.map(convertPhotoToFirestore);
      
      const transactionData = {
        categoryId: sourceCategory.id,
        fromUser: sourceCategory.title,
        toUser: targetCategory.title,
        amount: -amount,
        description,
        type: 'expense',
        date: timestamp,
        relatedTransactionId: withdrawalId,
        photos: firestorePhotos,
        ...(options?.isSalary !== undefined && { isSalary: options.isSalary }),
        ...(options?.isCashless !== undefined && { isCashless: options.isCashless })
      };
      
      transaction.set(doc(db, 'transactions', withdrawalId), transactionData);

      const depositData = {
        categoryId: targetCategory.id,
        fromUser: sourceCategory.title,
        toUser: targetCategory.title,
        amount: amount,
        description,
        type: 'income',
        date: timestamp,
        relatedTransactionId: withdrawalId,
        photos: firestorePhotos,
        ...(options?.isSalary !== undefined && { isSalary: options.isSalary }),
        ...(options?.isCashless !== undefined && { isCashless: options.isCashless })
      };
      
      transaction.set(doc(db, 'transactions', depositId), depositData);

      transaction.update(sourceRef, {
        amount: formatAmount(sourceBalance - amount),
        updatedAt: timestamp
      });

      transaction.update(targetRef, {
        amount: formatAmount(targetBalance + amount),
        updatedAt: timestamp
      });
      
      // Отправляем уведомление в Telegram
      await sendTelegramNotification(
        formatTransactionMessage(
          sourceCategory.title,
          targetCategory.title,
          amount,
          description,
          'expense'
        )
      );
    });
  } catch (error) {
    console.error('Error transferring funds:', error);
    throw error;
  }
};

export const deleteTransaction = async (transactionId: string): Promise<void> => {
  if (!transactionId) {
    throw new Error('ID транзакции обязателен');
  }

  try {
    const batch = writeBatch(db);
    const transactionRef = doc(db, 'transactions', transactionId);
    const transactionSnap = await getDoc(transactionRef);

    if (!transactionSnap.exists()) {
      throw new Error('Транзакция не найдена');
    }

    const transactionData = transactionSnap.data();
    const relatedTransactionId = transactionData.relatedTransactionId;
    const categoryId = transactionData.categoryId;
    const amount = Number(transactionData.amount);

    batch.delete(transactionRef);

    // Находим и обрабатываем связанную транзакцию
    let relatedTransactionData;
    if (relatedTransactionId) {
      const relatedTransactionsQuery = query(
        collection(db, 'transactions'),
        where('relatedTransactionId', '==', relatedTransactionId)
      );

      const relatedTransactionsSnapshot = await getDocs(relatedTransactionsQuery);
      relatedTransactionsSnapshot.docs.forEach(doc => {
        if (doc.id !== transactionId) {
          relatedTransactionData = doc.data();
          batch.delete(doc.ref);
        }
      });
    }

    // Обновляем баланс категории
    const categoryRef = doc(db, 'categories', categoryId);
    const categorySnap = await getDoc(categoryRef);

    if (categorySnap.exists()) {
      const currentAmount = parseAmount(categorySnap.data().amount);
      const newAmount = transactionData.type === 'expense' 
        ? Math.round(currentAmount + Math.abs(amount))
        : Math.round(currentAmount - amount);

      batch.update(categoryRef, {
        amount: formatAmount(newAmount),
        updatedAt: serverTimestamp()
      });
    }

    // Если есть связанная транзакция, обновляем баланс второй категории
    if (relatedTransactionData && relatedTransactionData.categoryId) {
      const relatedCategoryRef = doc(db, 'categories', relatedTransactionData.categoryId);
      const relatedCategorySnap = await getDoc(relatedCategoryRef);

      if (relatedCategorySnap.exists()) {
        const currentAmount = parseAmount(relatedCategorySnap.data().amount);
        const newAmount = relatedTransactionData.type === 'expense'
          ? Math.round(currentAmount + Math.abs(relatedTransactionData.amount))
          : Math.round(currentAmount - relatedTransactionData.amount);

        batch.update(relatedCategoryRef, {
          amount: formatAmount(newAmount),
          updatedAt: serverTimestamp()
        });
      }
    }

    await batch.commit();
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw new Error('Не удалось удалить транзакцию');
  }
};