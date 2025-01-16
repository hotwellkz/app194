import React, { useState } from 'react';
import { X, Search, Filter, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatAmount } from '../../../utils/formatUtils';

interface TransactionHistoryHeaderProps {
  title: string;
  onClose: () => void;
  totalAmount: number;
  salaryTotal: number;
  onSearch: (query: string) => void;
  onFilterChange: (filter: 'all' | 'salary' | 'cashless') => void;
  selectedFilter: 'all' | 'salary' | 'cashless';
}

export const TransactionHistoryHeader: React.FC<TransactionHistoryHeaderProps> = ({
  title,
  onClose,
  totalAmount,
  salaryTotal,
  onSearch,
  onFilterChange,
  selectedFilter
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch(value);
  };

  return (
    <div className="sticky top-0 bg-white border-b z-10">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
          <X className="w-6 h-6 text-gray-500" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50">
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

      {/* Search and Filters */}
      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Поиск по описанию или сумме..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onFilterChange('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Все операции
          </button>
          <button
            onClick={() => onFilterChange('salary')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedFilter === 'salary'
                ? 'bg-emerald-500 text-white'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
          >
            Только ЗП
          </button>
          <button
            onClick={() => onFilterChange('cashless')}
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
  );
};