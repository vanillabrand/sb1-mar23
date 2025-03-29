import React, { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

interface ComboboxProps {
  options: { value: string; label: string; popular?: boolean }[];
  selectedValues: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
}

export function Combobox({
  options,
  selectedValues,
  onSelect,
  placeholder = "Search trading pairs..."
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(option =>
    option.value.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedValues.includes(option.value)
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 bg-gunmetal-900 border border-gunmetal-700 rounded-lg text-gray-200 placeholder-gray-400 focus:outline-none focus:border-pink-500"
        />
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gunmetal-900 border border-gunmetal-700 rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onSelect(option.value);
                setSearchTerm('');
                inputRef.current?.focus();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gunmetal-800 flex justify-between items-center"
            >
              <span className="text-gray-200">{option.value}</span>
              {option.popular && (
                <span className="text-xs text-yellow-500">Popular</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
