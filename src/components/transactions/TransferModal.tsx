import React, { useState, useCallback } from 'react';
import { X, Upload } from 'lucide-react';
import { CategoryCardType } from '../../types';
import { transferFunds } from '../../lib/firebase/transactions';
import { uploadFile } from '../../utils/storageUtils';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';

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
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isSalary, setIsSalary] = useState(false);
  const [isCashless, setIsCashless] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Проверяем размер каждого файла (макс. 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const validFiles = acceptedFiles.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        showErrorNotification(`Файл ${file.name} слишком большой (макс. 10MB)`);
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  if (!isOpen) return null;

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

      // Загружаем файлы
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

      // Выполняем перевод с загруженными файлами
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

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    // Очищаем прогресс загрузки для удаленного файла
    const removedFile = selectedFiles[index];
    if (removedFile) {
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[removedFile.name];
        return newProgress;
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Перевод средств</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>От: {sourceCategory.title}</span>
            <span>Кому: {targetCategory.title}</span>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Текущий баланс: {sourceCategory.amount}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Сумма перевода
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Введите сумму"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Комментарий к переводу
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Укажите назначение перевода"
              required
            />
          </div>

          {sourceCategory.row === 2 && (
            <div className="flex items-center gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isSalary}
                  onChange={(e) => setIsSalary(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">ЗП</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isCashless}
                  onChange={(e) => setIsCashless(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Безнал</span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Прикрепить файлы
            </label>
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 text-center">
                  {isDragActive
                    ? 'Перетащите файлы сюда'
                    : 'Перетащите файлы или нажмите для выбора'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Поддерживаются изображения, PDF и документы Word (до 10MB)
                </p>
              </div>
            </div>
          </div>

          {/* Список выбранных файлов */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <div className="flex items-center">
                    <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Индикаторы прогресса загрузки */}
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="mt-2">
              <div className="text-xs text-gray-500">{fileName}</div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 px-4 rounded-md text-white transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }`}
          >
            {loading ? 'Выполняется перевод...' : 'Выполнить перевод'}
          </button>
        </form>
      </div>
    </div>
  );
};