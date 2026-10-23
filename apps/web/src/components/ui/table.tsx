'use client';

import React from 'react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  key?: keyof T;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage = 'No records in ledger.',
  className = '',
}: TableProps<T>) {
  return (
    <div
      className={`w-full overflow-x-auto border border-hairline rounded-sm bg-paper-raised ${className}`}
    >
      <table className="w-full border-collapse text-left text-xs font-mono">
        <thead>
          <tr className="border-b border-hairline bg-paper">
            {columns.map((col, idx) => (
              <th
                key={idx}
                scope="col"
                className={`py-2.5 px-3 uppercase tracking-wider text-ink-muted font-medium ${
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                } ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-8 text-center text-ink-muted italic font-sans"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-hairline/10 transition-colors">
                {columns.map((col, colIdx) => {
                  const keyField = col.accessorKey || col.key;
                  const content = col.render
                    ? col.render(row)
                    : keyField
                      ? (row[keyField] as React.ReactNode)
                      : null;
                  return (
                    <td
                      key={colIdx}
                      className={`py-2.5 px-3 text-ink tabular-nums ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                      } ${col.className || ''}`}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
