import React from 'react';

interface ExpertCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  theme?: string;
}

export function ExpertCodeEditor({
  value,
  onChange,
  language = 'javascript',
  theme = 'vs-dark'
}: ExpertCodeEditorProps) {
  return (
    <div className="h-full w-full bg-gunmetal-900 rounded-lg overflow-hidden">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-full bg-gunmetal-900 text-gray-200 p-4 font-mono text-sm resize-none border-none outline-none"
        placeholder={`// ${language} code editor
// Advanced code editor with Monaco will be available soon...
// For now, you can write your strategy code here

function initialize() {
  return {
    name: "My Strategy",
    description: "Custom trading strategy",
    version: "1.0.0"
  };
}

function onTick(data, state) {
  // Your trading logic here
  return { signal: "NEUTRAL", confidence: 0.5 };
}`}
        spellCheck={false}
      />
    </div>
  );
}
