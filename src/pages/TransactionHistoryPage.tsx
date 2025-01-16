import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch, getDocs, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatTime } from '../utils/dateUtils';
import { formatAmount } from '../utils/formatUtils';
import { useSwipeable } from 'react-swipeable';
import { showErrorNotification, showSuccessNotification } from '../utils/notifications';
import { PasswordPrompt } from '../components/PasswordPrompt';
import { ExpenseWaybill } from '../components/warehouse/ExpenseWaybill';

interface Transaction {
  id: string;
  fromUser: string;
  toUser: string;
  amount: number;
  description: string;
  date: any;
  type: 'income' | 'expense';
  categoryId: string;
  isSalary?: boolean;
  isCashless?: boolean;
  waybillNumber?: string;
  waybillData?: any;
}

export const TransactionHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { categoryId } = useParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryTitle, setCategoryTitle] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [swipedTransactionId, setSwipedTransactionId] = useState<string | null>(null);
  const [showWaybill, setShowWaybill] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'salary' | 'cashless'>('all');
  const [totalAmount, setTotalAmount] = useState(0);
  const [salaryTotal, setSalaryTotal] = useState(0);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!categoryId) return;

    const q = query(
      collection(db, 'transactions'),
      where('categoryId', '==', categoryId),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      
      if (transactionsData.length > 0) {
        setCategoryTitle(transactionsData[0].fromUser);
      }

      // Вычисляем общую сумму и сумму ЗП
      const total = transactionsData.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const salarySum = transactionsData.reduce((sum, t) => 
        t.isSalary ? sum + Math.abs(t.amount) : sum, 0
      );

      setTransactions(transactionsData);
      setTotalAmount(total);
      setSalaryTotal(salarySum);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [categoryId]);

  // Фильтрация транзакций
  useEffect(() => {
    let filtered = transactions;

    // Применяем фильтр по типу
    if (selectedFilter === 'salary') {
      filtered = filtered.filter(t => t.isSalary);
    } else if (selectedFilter === 'cashless') {
      filtered = filtered.filter(t => t.isCashless);
    }

    // Применяем поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(query) ||
        t.fromUser.toLowerCase().includes(query) ||
        t.toUser.toLowerCase().includes(query) ||
        Math.abs(t.amount).toString().includes(query)
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, selectedFilter, searchQuery]);

  const handlers = useSwipeable({
    onSwipedLeft: (eventData) => {
      const element = eventData.event.target as HTMLElement;
      const transactionElement = element.closest('[data-transaction-id]');
      if (transactionElement) {
        const transactionId = transactionElement.getAttribute('data-transaction-id');
        if (transactionId) {
          setSwipedTransactionId(transactionId === swipedTransactionId ? null : transactionId);
        }
      }
    },
    onSwipedRight: () => {
      setSwipedTransactionId(null);
    },
    trackMouse: true,
    delta: 10
  });

  const handleDelete = async (isAuthenticated: boolean) => {
    if (!isAuthenticated || !selectedTransaction) {
      setShowPasswordPrompt(false);
      setSelectedTransaction(null);
      return;
    }

    try {
      const batch = writeBatch(db);
      const amount = selectedTransaction.amount;
      
      // Delete the transaction
      const transactionRef = doc(db, 'transactions', selectedTransaction.id);
      batch.delete(transactionRef);

      // Получаем текущий баланс категории
      const categoryRef = doc(db, 'categories', categoryId!);
      const categoryDoc = await getDoc(categoryRef);
      
      if (categoryDoc.exists()) {
        const currentBalance = parseFloat(categoryDoc.data().amount?.replace(/[^\d.-]/g, '') || '0');
        // Если это был расход, то добавляем сумму обратно
        // Если это был доход, то вычитаем сумму
        const newBalance = currentBalance + (amount * -1);
        batch.update(categoryRef, {
          amount: `${newBalance} ₸`,
          updatedAt: serverTimestamp()
        });
      }

      // Find and delete the related transaction
      const relatedTransactionsQuery = query(
        collection(db, 'transactions'),
        where('relatedTransactionId', '==', selectedTransaction.id)
      );
      
      const relatedTransactionsSnapshot = await getDocs(relatedTransactionsQuery);
      for (const docSnapshot of relatedTransactionsSnapshot.docs) {
        const relatedTransaction = docSnapshot.data();
        batch.delete(docSnapshot.ref);
        
        // Обновляем баланс связанной категории
        const relatedCategoryRef = doc(db, 'categories', relatedTransaction.categoryId);
        const relatedCategoryDoc = await getDoc(relatedCategoryRef);
        
        if (relatedCategoryDoc.exists()) {
          const relatedBalance = parseFloat(relatedCategoryDoc.data().amount?.replace(/[^\d.-]/g, '') || '0');
          const newRelatedBalance = relatedBalance + (relatedTransaction.amount * -1);
          batch.update(relatedCategoryRef, {
            amount: `${newRelatedBalance} ₸`,
            updatedAt: serverTimestamp()
          });
        }
      }

      await batch.commit();
      showSuccessNotification('Операция успешно удалена');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      showErrorNotification('Ошибка при удалении операции');
    } finally {
      setShowPasswordPrompt(false);
      setSelectedTransaction(null);
      setSwipedTransactionId(null);
    }
  };

  const handleDeleteClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowPasswordPrompt(true);
  };

  const handleWaybillClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowWaybill(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button onClick={() => navigate(-1)} className="mr-4">
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">История операций</h1>
                <p className="text-sm text-gray-500">{categoryTitle}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="border-t border-b border-gray-200 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="w-5 h-5 text-red-500" />
                    <span className="text-sm text-gray-600">Общая сумма:</span>
                  </div>
                  <span className="text-lg font-semibold text-red-600">
                    {formatAmount(totalAmount)}
                  </span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm text-gray-600">Сумма ЗП:</span>
                  </div>
                  <span className="text-lg font-semibold text-emerald-600">
                    {formatAmount(salaryTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Фильтры */}
        <div className="border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Поиск */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Поиск по описанию или сумме..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Фильтры */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedFilter === 'all'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Все операции
                </button>
                <button
                  onClick={() => setSelectedFilter('salary')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedFilter === 'salary'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  }`}
                >
                  Только ЗП
                </button>
                <button
                  onClick={() => setSelectedFilter('cashless')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedFilter === 'cashless'
                      ? 'bg-purple-500 text-white'
                      : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                  }`}
                >
                  Безналичные
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Список транзакций */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-4" {...handlers}>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <ArrowDownRight className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">История операций пуста</h3>
              <p className="text-gray-500">
                {searchQuery || selectedFilter !== 'all' 
                  ? 'Нет операций, соответствующих фильтрам' 
                  : 'Здесь будут отображаться все операции'}
              </p>
            </div>
          ) : (
            filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                data-transaction-id={transaction.id}
                className={`relative overflow-hidden rounded-lg ${
                  transaction.isSalary ? 'bg-emerald-50' :
                  transaction.isCashless ? 'bg-purple-50' :
                  'bg-white'
                }`}
              >
                <div
                  className={`absolute inset-y-0 right-0 w-16 bg-red-500 flex items-center justify-center transition-opacity duration-200 ${
                    swipedTransactionId === transaction.id ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <button
                    onClick={() => handleDeleteClick(transaction)}
                    className="w-full h-full flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div
                  className={`p-4 transition-transform ${
                    swipedTransactionId === transaction.id ? '-translate-x-16' : 'translate-x-0'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3">
                      <div className="mt-1">
                        {transaction.type === 'income' ? (
                          <ArrowUpRight className={`w-5 h-5 ${
                            transaction.isSalary ? 'text-emerald-600' :
                            transaction.isCashless ? 'text-purple-600' :
                            'text-emerald-500'
                          }`} />
                        ) : (
                          <ArrowDownRight className={`w-5 h-5 ${
                            transaction.isSalary ? 'text-emerald-600' :
                            transaction.isCashless ? 'text-purple-600' :
                            'text-red-500'
                          }`} />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{transaction.fromUser}</div>
                        <div className="text-sm text-gray-500">{transaction.toUser}</div>
                        {transaction.waybillNumber && (
                          <button
                            onClick={() => handleWaybillClick(transaction)}
                            className="mt-1 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Накладная №{transaction.waybillNumber}
                          </button>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {formatTime(transaction.date)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${
                        transaction.isSalary ? 'text-emerald-600' :
                        transaction.isCashless ? 'text-purple-600' :
                        transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'} {formatAmount(transaction.amount)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {transaction.description}
                      </div>
                      <div className="flex gap-1 mt-1 justify-end">
                        {transaction.isSalary && (
                          <div className="text-xs text-emerald-600 font-medium px-1.5 py-0.5 bg-emerald-50 rounded">
                            ЗП
                          </div>
                        )}
                        {transaction.isCashless && (
                          <div className="text-xs text-purple-600 font-medium px-1.5 py-0.5 bg-purple-50 rounded">
                            Безнал
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showPasswordPrompt && (
        <PasswordPrompt
          isOpen={showPasswordPrompt}
          onClose={() => {
            setShowPasswordPrompt(false);
            setSelectedTransaction(null);
          }}
          onSuccess={() => handleDelete(true)}
        />
      )}

      {showWaybill && selectedTransaction?.waybillData && (
        <ExpenseWaybill
          isOpen={showWaybill}
          onClose={() => {
            setShowWaybill(false);
            setSelectedTransaction(null);
          }}
          data={selectedTransaction.waybillData}
        />
      )}
    </div>
  );
};