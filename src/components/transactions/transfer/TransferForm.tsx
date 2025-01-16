import React from 'react';

interface TransferFormProps {
  amount: string;
  description: string;
  isSalary: boolean;
  isCashless: boolean;
  showEmployeeOptions: boolean;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSalaryChange: (value: boolean) => void;
  onCashlessChange: (value: boolean) => void;
}

export const TransferForm: React.FC<TransferFormProps> = ({
  amount,
  description,
  isSalary,
  isCashless,
  showEmployeeOptions,
  onAmountChange,
  onDescriptionChange,
  onSalaryChange,
  onCashlessChange
}) => {
  // Function to format number with commas
  const formatAmount = (value: string): string => {
    // Remove all non-digit characters
    const numericValue = value.replace(/[^\d]/g, '');
    
    // Add commas for thousands
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Handle amount change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Remove commas for processing
    const numericValue = value.replace(/,/g, '');
    
    // Validate if it's a valid number
    if (numericValue === '' || !isNaN(Number(numericValue))) {
      onAmountChange(numericValue); // Store unformatted value
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Сумма перевода
        </label>
        <div className="relative">
          <input
            type="text"
            value={formatAmount(amount)}
            onChange={handleAmountChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="0"
            required
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
            ₸
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Комментарий к переводу
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          placeholder="Укажите назначение перевода"
          required
        />
      </div>

      {showEmployeeOptions && (
        <div className="flex items-center gap-6">
          <label className="relative flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isSalary}
              onChange={(e) => onSalaryChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ms-3 text-sm font-medium text-gray-900">ЗП</span>
          </label>
          
          <label className="relative flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isCashless}
              onChange={(e) => onCashlessChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ms-3 text-sm font-medium text-gray-900">Безнал</span>
          </label>
        </div>
      )}
    </div>
  );
};