import React, { useState, useRef, useCallback } from 'react';
import {
  useFloating,
  useInteractions,
  useClick,
  useDismiss,
  useRole,
  useListNavigation,
  FloatingFocusManager,
  autoUpdate,
  offset,
  flip,
  size,
} from '@floating-ui/react';
import { Search, Check } from 'lucide-react';

interface ComboboxProps {
  options: string[];
  selectedOptions: string[];
  onSelect: (option: string) => void;
  onRemove: (option: string) => void;
  placeholder?: string;
  className?: string;
}

const TOP_PAIRS = [
  'BTC_USDT',  // Bitcoin
  'ETH_USDT',  // Ethereum
  'SOL_USDT',  // Solana
  'BNB_USDT',  // Binance Coin
  'XRP_USDT',  // Ripple
  'ADA_USDT',  // Cardano
  'DOGE_USDT', // Dogecoin
  'MATIC_USDT', // Polygon
  'DOT_USDT',  // Polkadot
  'LINK_USDT'  // Chainlink
];

export function Combobox({
  options,
  selectedOptions,
  onSelect,
  onRemove,
  placeholder = 'Search...',
  className = ''
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const listRef = useRef<Array<HTMLElement | null>>([]);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
            maxHeight: '300px'
          });
        },
        padding: 8
      })
    ]
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);
  const listNav = useListNavigation(context, {
    listRef,
    activeIndex,
    onNavigate: setActiveIndex,
    loop: true
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    dismiss,
    role,
    listNav
  ]);

  const sortByPopularity = useCallback((pairs: string[]): string[] => {
    const topPairs = TOP_PAIRS.filter(pair => pairs.includes(pair));
    const otherPairs = pairs.filter(pair => !TOP_PAIRS.includes(pair));
    return [...topPairs, ...otherPairs];
  }, []);

  const filteredOptions = options
    .filter(option => 
      option.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedOptions.includes(option)
    );

  const sortedOptions = sortByPopularity(filteredOptions);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  const handleSelect = (option: string) => {
    onSelect(option);
    setInputValue('');
    setIsOpen(false);
  };

  return (
    <div className={className}>
      {/* Selected Options */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedOptions.map((option) => (
            <div
              key={option}
              className="flex items-center gap-1 px-2 py-1 bg-neon-raspberry/20 text-neon-raspberry rounded-lg text-sm"
            >
              <span>{option.replace('_', '/')}</span>
              <button
                type="button"
                onClick={() => onRemove(option)}
                className="hover:text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div ref={refs.setReference} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="w-full bg-gunmetal-800 border border-gunmetal-700 rounded-lg pl-10 pr-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-neon-raspberry focus:border-transparent"
          {...getReferenceProps()}
        />
      </div>

      {/* Dropdown */}
      {isOpen && sortedOptions.length > 0 && (
        <FloatingFocusManager context={context} modal={false}>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="bg-gunmetal-900/95 backdrop-blur-xl border border-gunmetal-700 rounded-lg shadow-lg overflow-y-auto z-50"
            {...getFloatingProps()}
          >
            {sortedOptions.map((option, index) => (
              <div
                key={option}
                ref={(node) => {
                  listRef.current[index] = node;
                }}
                className={`px-4 py-2 cursor-pointer flex items-center justify-between ${
                  activeIndex === index
                    ? 'bg-gunmetal-800 text-white'
                    : 'text-gray-300 hover:bg-gunmetal-800/50'
                }`}
                {...getItemProps({
                  onClick: () => handleSelect(option)
                })}
              >
                <span>{option.replace('_', '/')}</span>
                {TOP_PAIRS.includes(option) && (
                  <span className="text-xs text-neon-yellow">Popular</span>
                )}
              </div>
            ))}
          </div>
        </FloatingFocusManager>
      )}
    </div>
  );
}