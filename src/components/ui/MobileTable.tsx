import React from 'react';
import { motion } from 'framer-motion';
import { useMobileDetect } from '../../hooks/useMobileDetect';

interface MobileTableProps {
  data: any[];
  columns: {
    key: string;
    header: string;
    render?: (value: any, row: any) => React.ReactNode;
  }[];
  keyField: string;
  emptyMessage?: string;
  className?: string;
}

export function MobileTable({ data, columns, keyField, emptyMessage = 'No data available', className = '' }: MobileTableProps) {
  const { isMobile } = useMobileDetect();
  
  // If not on mobile, render a regular table
  if (!isMobile) {
    return (
      <div className={`table-container ${className}`}>
        <table className="w-full">
          <thead className="bg-gunmetal-800/50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gunmetal-800">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-4 text-center text-sm text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row[keyField]} className="hover:bg-gunmetal-800/30">
                  {columns.map((column) => (
                    <td key={`${row[keyField]}-${column.key}`} className="px-4 py-3 text-sm text-gray-300">
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }
  
  // On mobile, render card-style rows
  return (
    <div className={`space-y-3 ${className}`}>
      {data.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          {emptyMessage}
        </div>
      ) : (
        data.map((row, index) => (
          <motion.div
            key={row[keyField]}
            className="mobile-table-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            {columns.map((column) => (
              <div key={`${row[keyField]}-${column.key}`} className="mobile-table-card-row">
                <div className="text-xs font-medium text-gray-400">{column.header}</div>
                <div className="text-sm text-gray-200">
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </div>
              </div>
            ))}
          </motion.div>
        ))
      )}
    </div>
  );
}
