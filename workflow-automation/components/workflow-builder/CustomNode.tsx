import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ChevronDown, Copy } from 'lucide-react';
import ModuleIcon from './ModuleIcon';
import { useParams } from 'next/navigation';

interface CustomNodeData {
  label: string;
  description?: string;
  iconName?: string;
  color?: string;
  integration?: string;
  moduleType?: 'trigger' | 'action';
  options?: {
    value: string;
    label: string;
    description?: string;
  }[];
  selectedOption?: string;
}

const CustomNode = memo(({ data, selected }: NodeProps<CustomNodeData>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(data.selectedOption || '');
  const [copied, setCopied] = useState(false);
  const params = useParams();
  const workflowId = params?.id as string;

  const hasOptions = data.options && data.options.length > 0;
  const isWebhookTrigger = data.integration === 'webhook' || 
    (data.integration === 'gohighlevel' && data.moduleType === 'trigger');
  
  const webhookUrl = workflowId && isWebhookTrigger 
    ? `${window.location.origin}/api/webhooks/${workflowId}`
    : null;

  const handleOptionSelect = (value: string) => {
    setSelectedOption(value);
    setIsOpen(false);
    // In a real implementation, this would update the node data in the flow
    data.selectedOption = value;
  };

  const selectedOptionLabel = data.options?.find(opt => opt.value === selectedOption)?.label;

  return (
    <div className={`min-w-[280px] bg-white rounded-lg border-2 ${selected ? 'border-blue-500 shadow-lg' : 'border-gray-200 shadow-sm'} transition-all`}>
      {data.moduleType === 'trigger' ? (
        <Handle 
          type="source" 
          position={Position.Bottom} 
          className="w-3 h-3 bg-blue-500 border-2 border-white"
        />
      ) : (
        <Handle 
          type="target" 
          position={Position.Top} 
          className="w-3 h-3 bg-gray-400 border-2 border-white"
        />
      )}

      <div className="p-4">
        <div className="flex items-start space-x-3 mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${data.color || 'bg-gray-100 text-gray-600'}`}>
            <ModuleIcon name={data.label} className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-sm text-gray-900">{data.label}</h3>
            {data.integration && (
              <p className="text-xs text-gray-500 mt-0.5">{data.integration}</p>
            )}
          </div>
        </div>

        {hasOptions && (
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-full px-3 py-2 text-left text-sm border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between text-gray-900"
            >
              <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
                {selectedOptionLabel || 'Select an option...'}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {data.options?.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleOptionSelect(option.value)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  >
                    <p className="text-sm font-medium text-gray-900">{option.label}</p>
                    {option.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedOption && !isOpen && (
          <p className="text-xs text-gray-500 mt-2">{data.description}</p>
        )}
        
        {webhookUrl && (
          <div className="mt-3 p-2 bg-gray-50 rounded-md">
            <p className="text-xs font-medium text-gray-700 mb-1">Webhook URL:</p>
            <div className="flex items-center space-x-2">
              <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200 flex-1 truncate">
                {webhookUrl}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Copy webhook URL"
              >
                <Copy className={`w-3 h-3 ${copied ? 'text-green-600' : 'text-gray-500'}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {data.moduleType === 'action' && (
        <Handle 
          type="source" 
          position={Position.Bottom} 
          className="w-3 h-3 bg-blue-500 border-2 border-white"
        />
      )}
    </div>
  );
});

CustomNode.displayName = 'CustomNode';

export default CustomNode;