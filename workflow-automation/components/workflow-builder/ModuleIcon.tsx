import { Building2, Webhook, Clock, Globe, Mail, Sparkles, Database, Code, GitBranch, Filter, Repeat, FileText, LucideIcon } from 'lucide-react';

interface ModuleIconProps {
  name: string;
  className?: string;
}

const iconMap: Record<string, LucideIcon> = {
  'GoHighLevel Trigger': Building2,
  'GoHighLevel Action': Building2,
  'Webhook': Webhook,
  'Schedule': Clock,
  'HTTP Request': Globe,
  'Send Email': Mail,
  'AI Generate': Sparkles,
  'Database Query': Database,
  'Transform Data': Code,
  'Branch': GitBranch,
  'Filter': Filter,
  'Loop': Repeat,
  'Form Submit': FileText,
};

export default function ModuleIcon({ name, className = "w-5 h-5" }: ModuleIconProps) {
  const Icon = iconMap[name] || Database;
  return <Icon className={className} />;
}