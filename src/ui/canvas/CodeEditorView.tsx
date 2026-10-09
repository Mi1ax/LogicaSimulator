import React from 'react';

export const CodeEditorView: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-slate-400">
      <div className="text-6xl mb-4">⌨️</div>
      <h2 className="text-2xl font-bold text-gray-700 dark:text-slate-200 mb-2">Code Editor</h2>
      <p className="max-w-md text-center">
        This tab will contain the WinCUPL editor and other programmable logic tools, 
        allowing you to compile equations directly into components like GAL22V10.
      </p>
    </div>
  );
};
