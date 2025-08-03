const fs = require('fs');
const path = require('path');

// Define the replacements
const replacements = [
  // Input fields
  {
    pattern: /className="w-full px-2 py-1 text-sm font-medium border border-\w+-300 rounded bg-white text-gray-900 (?:placeholder-gray-500 )?focus:ring-1 focus:ring-\w+-500 focus:border-transparent"/g,
    replacement: 'className={inputStyles.full}'
  },
  {
    pattern: /className="flex-1 px-2 py-1 text-xs border border-\w+-300 rounded bg-white text-gray-900 (?:placeholder-gray-500 )?focus:ring-1 focus:ring-\w+-500"/g,
    replacement: 'className={`flex-1 ${inputStyles.full}`}'
  },
  {
    pattern: /className="w-20 px-2 py-1 text-sm border border-\w+-300 rounded bg-white text-gray-900 focus:ring-1 focus:ring-\w+-500"/g,
    replacement: 'className={`w-20 ${inputStyles.full}`}'
  },
  // Textareas
  {
    pattern: /className="w-full px-2 py-1 (?:mt-1 )?text-sm border border-\w+-300 rounded bg-white text-gray-900 placeholder-gray-500 focus:ring-1 focus:ring-\w+-500 focus:border-transparent resize-none"/g,
    replacement: 'className={`${textareaStyles.full} mt-1`}'
  },
  // Select elements
  {
    pattern: /className="w-full px-2 py-1 (?:mt-1 )?text-sm border border-\w+-300 rounded bg-white text-gray-900 focus:ring-1 focus:ring-\w+-500"/g,
    replacement: 'className={`${selectStyles.full} mt-1`}'
  },
  {
    pattern: /className="w-1\/2 px-2 py-1 text-xs border border-\w+-300 rounded bg-white text-gray-900 focus:ring-1 focus:ring-\w+-500"/g,
    replacement: 'className={`w-1/2 ${selectStyles.full}`}'
  },
  // Labels
  {
    pattern: /className="text-xs font-medium text-gray-700"/g,
    replacement: 'className={labelStyles}'
  },
  // Display text
  {
    pattern: /<div className="text-sm font-medium text-gray-900">/g,
    replacement: '<div className={displayTextStyles.value}>'
  },
  {
    pattern: /<div className="text-sm text-gray-800 mt-1(?:\s+\w+)*">/g,
    replacement: '<div className={`${displayTextStyles.value} mt-1`}>'
  },
  {
    pattern: /<span className="(?:italic )?text-gray-400">/g,
    replacement: '<span className={displayTextStyles.placeholder}>'
  }
];

// Files to update
const files = [
  'components/workflow-builder/nodes/MilestoneNode.tsx',
  'components/workflow-builder/nodes/ActionNode.tsx',
  'components/workflow-builder/nodes/ConditionNode.tsx',
  'components/workflow-builder/nodes/EndNode.tsx',
  'components/workflow-builder/nodes/AppointmentNode.tsx'
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Apply all replacements
  replacements.forEach(({ pattern, replacement }) => {
    content = content.replace(pattern, replacement);
  });
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
});

console.log('Style updates complete!');