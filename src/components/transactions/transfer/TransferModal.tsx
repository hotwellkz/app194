import React, { useState, useCallback } from 'react';
import { CategoryCardType } from '../../../types';
import { transferFunds } from '../../../lib/firebase/transactions';
import { uploadFile } from '../../../utils/storageUtils';
import { showErrorNotification, showSuccessNotification } from '../../../utils/notifications';
import { TransferHeader } from './TransferHeader';
import { TransferForm } from './TransferForm';
import { FileUploader } from './FileUploader';

interface TransferModalProps {
  sourceCategory: CategoryCardType;
  targetCategory: CategoryCardType;
  isOpen: boolean;
  onClose: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  sourceCategory,
  targetCategory,
  isOpen,
  onClose
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isSalary, setIsSalary] = useState(false);
  const [isCashless, setIsCashless] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((acceptedFiles: File[]) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const validFiles = acceptedFiles.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        showErrorNotification(`Файл ${file.name} слишком большой (макс. 10MB)`);
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
  }, []);

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    const removedFile = selectedFiles[index];
    if (removedFile) {
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[removedFile.name];
        return newProgress;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const uploadedFiles = [];

    try {
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Сумма перевода должна быть больше нуля');
      }

      if (!description.trim()) {
        throw new Error('Необходимо указать комментарий к переводу');
      }

      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          try {
            setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
            
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const path = `transactions/${sourceCategory.id}/${timestamp}-${safeName}`;
            
            const url = await uploadFile(
              file, 
              path,
              (progress) => {
                setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
              }
            );
            
            uploadedFiles.push({
              name: file.name,
              url,
              type: file.type,
              size: file.size,
              uploadedAt: new Date(),
              path
            });

            showSuccessNotification(`Файл ${file.name} успешно загружен`);
          } catch (error) {
            console.error(`Error uploading file ${file.name}:`, error);
            showErrorNotification(`Ошибка при загрузке файла ${file.name}`);
            throw error;
          }
        }
      }

      const transferAmount = Math.abs(parseFloat(amount));

      await transferFunds(
        sourceCategory,
        targetCategory,
        transferAmount,
        description.trim(),
        uploadedFiles,
        sourceCategory.row === 2 ? {
          isSalary,
          isCashless
        } : undefined
      );

      showSuccessNotification('Перевод успешно выполнен');
      onClose();
    } catch (error) {
      console.error('Ошибка при переводе средств:', error);
      setError(error instanceof Error ? error.message : 'Не удалось выполнить перевод средств');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div 
        className="w-full max-w-md transform transition-all duration-300 ease-out scale-100 opacity-100"
        style={{ 
          maxHeight: '90vh',
          marginBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 space-y-6">
            <TransferHeader
              sourceCategory={sourceCategory}
              targetCategory={targetCategory}
              onClose={onClose}
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <TransferForm
                amount={amount}
                description={description}
                isSalary={isSalary}
                isCashless={isCashless}
                showEmployeeOptions={sourceCategory.row === 2}
                onAmountChange={setAmount}
                onDescriptionChange={setDescription}
                onSalaryChange={setIsSalary}
                onCashlessChange={setIsCashless}
              />

              <FileUploader
                selectedFiles={selectedFiles}
                uploadProgress={uploadProgress}
                onDrop={handleDrop}
                onRemoveFile={handleRemoveFile}
              />

              <button
                type="submit"
                disabled={loading}
                className={`
                  w-full py-3 px-4 rounded-xl text-white font-medium
                  transition-all duration-200 transform active:scale-[0.98]
                  ${loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl focus:ring-4 focus:ring-blue-500/50'
                  }
                `}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    <span>Выполняется перевод...</span>
                  </div>
                ) : (
                  'Выполнить перевод'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};