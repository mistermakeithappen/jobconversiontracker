'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Trash2, Building2, Bot, MessageSquare, Clock, Mail, AlertCircle, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { authenticatedFetch } from '@/lib/utils/api-fetch';

interface BotContext {
  business_name: string;
  business_type: string;
  industry: string;
  services_offered: string[];
  target_audience: string;
  unique_value_proposition: string;
  tone_of_voice: string;
  language_style: string;
  business_hours: any;
  contact_information: any;
  key_policies: string[];
  faqs: any[];
  response_guidelines: string[];
  prohibited_topics: string[];
  escalation_triggers: string[];
  custom_instructions: string;
  knowledge_base: any;
}

interface Bot {
  id: string;
  name: string;
  description: string;
  avatar_url?: string;
  is_active: boolean;
}

const BUSINESS_TYPES = [
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'dental', label: 'Dental Practice' },
  { value: 'fitness', label: 'Fitness Studio' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'saas', label: 'SaaS' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'medical', label: 'Medical Practice' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' }
];

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'casual', label: 'Casual' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'empathetic', label: 'Empathetic' }
];

const LANGUAGE_STYLES = [
  { value: 'formal', label: 'Formal' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'technical', label: 'Technical' },
  { value: 'simple', label: 'Simple' },
  { value: 'persuasive', label: 'Persuasive' }
];

const TEMPLATES = [
  { value: '', label: 'No template' },
  { value: 'real_estate', label: 'Real Estate Agency' },
  { value: 'dental', label: 'Dental Practice' },
  { value: 'fitness', label: 'Fitness Studio' },
  { value: 'ecommerce', label: 'E-commerce Store' },
  { value: 'saas', label: 'SaaS Company' }
];

export default function BotSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // Form state
  const [formData, setFormData] = useState<BotContext>({
    business_name: '',
    business_type: '',
    industry: '',
    services_offered: [],
    target_audience: '',
    unique_value_proposition: '',
    tone_of_voice: 'professional',
    language_style: 'conversational',
    response_guidelines: [],
    prohibited_topics: [],
    escalation_triggers: [],
    custom_instructions: '',
    contact_information: {
      phone: '',
      email: '',
      address: '',
      website: ''
    },
    business_hours: {},
    key_policies: [],
    faqs: []
  });

  // Bot settings
  const [botSettings, setBotSettings] = useState({
    name: '',
    description: '',
    avatar_url: '',
    is_active: true
  });

  useEffect(() => {
    fetchBotAndContext();
  }, [botId]);

  const fetchBotAndContext = async () => {
    try {
      // Fetch bot details
      const botResponse = await authenticatedFetch(`/api/bots?botId=${botId}`);
      if (!botResponse.ok) {
        console.error('Failed to fetch bot');
        return;
      }
      const botData = await botResponse.json();
      setBot(botData);
      setBotSettings({
        name: botData.name,
        description: botData.description || '',
        avatar_url: botData.avatar_url || '',
        is_active: botData.is_active
      });

      // Fetch bot context
      const contextResponse = await authenticatedFetch(`/api/bots/${botId}/context`);
      if (contextResponse.ok) {
        const contextData = await contextResponse.json();
        if (contextData.context) {
          setFormData(contextData.context);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveContext = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/bots/${botId}/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save context');
      
      // Show success message
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 2000);
    } catch (error) {
      console.error('Error saving context:', error);
      alert('Failed to save context');
    } finally {
      setSaving(false);
    }
  };

  const saveBotSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/bots?botId=${botId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(botSettings)
      });

      if (!response.ok) throw new Error('Failed to save bot settings');
      
      // Update local bot data
      if (bot) {
        setBot({ ...bot, ...botSettings });
      }
    } catch (error) {
      console.error('Error saving bot settings:', error);
      alert('Failed to save bot settings');
    } finally {
      setSaving(false);
    }
  };

  const deleteBot = async () => {
    if (!confirm('Are you sure you want to delete this bot? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/bots?botId=${botId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete bot');
      
      router.push('/chatbot');
    } catch (error) {
      console.error('Error deleting bot:', error);
      alert('Failed to delete bot');
    }
  };

  const applyTemplate = async (templateType: string) => {
    if (!templateType) return;

    try {
      // Fetch template data
      const response = await fetch(`/api/bot-context-templates?type=${templateType}`);
      if (!response.ok) return;

      const data = await response.json();
      if (data.template && data.template.template_data) {
        const templateData = data.template.template_data;
        setFormData(prev => ({
          ...prev,
          business_type: templateData.business_type || prev.business_type,
          tone_of_voice: templateData.tone_of_voice || prev.tone_of_voice,
          language_style: templateData.language_style || prev.language_style,
          services_offered: templateData.services_offered || prev.services_offered,
          response_guidelines: templateData.response_guidelines || prev.response_guidelines,
          escalation_triggers: templateData.escalation_triggers || prev.escalation_triggers,
          prohibited_topics: templateData.prohibited_topics || prev.prohibited_topics
        }));
        
        setCopiedTemplate(true);
        setTimeout(() => setCopiedTemplate(false), 2000);
      }
    } catch (error) {
      console.error('Error applying template:', error);
    }
  };

  const addArrayItem = (field: keyof BotContext, value: string) => {
    if (!value.trim()) return;
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[] || []), value]
    }));
  };

  const removeArrayItem = (field: keyof BotContext, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Bot not found</p>
          <Link href="/chatbot" className="text-purple-600 hover:text-purple-700">
            Back to Bot Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/chatbot"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bot Settings</h1>
              <p className="text-gray-600">{bot.name}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/chatbot/${botId}/workflow`}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Edit Workflow
          </Link>
          <Link
            href={`/chatbot/${botId}/test`}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Test Bot
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'basic', label: 'Bot Settings' },
              { id: 'context', label: 'Business Context' },
              { id: 'communication', label: 'Communication Style' },
              { id: 'guidelines', label: 'AI Guidelines' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bot Name
                  </label>
                  <input
                    type="text"
                    value={botSettings.name}
                    onChange={(e) => setBotSettings(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={botSettings.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setBotSettings(prev => ({ ...prev, is_active: e.target.value === 'active' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={botSettings.description}
                  onChange={(e) => setBotSettings(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  placeholder="Describe what this bot does..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Avatar URL (optional)
                </label>
                <input
                  type="text"
                  value={botSettings.avatar_url}
                  onChange={(e) => setBotSettings(prev => ({ ...prev, avatar_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  placeholder="https://example.com/avatar.png"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <button
                  onClick={saveBotSettings}
                  disabled={saving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Bot Settings'}
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Bot
                </button>
              </div>

              {showDeleteConfirm && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 mb-3">
                    Are you sure you want to delete this bot? This action cannot be undone.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={deleteBot}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Yes, Delete Bot
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'context' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-800">
                      Define the business context for this bot. This helps the AI understand your business and provide accurate, on-brand responses.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-sm font-medium text-blue-800">Quick start with template:</label>
                      <select
                        onChange={(e) => applyTemplate(e.target.value)}
                        className="px-3 py-1 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                        defaultValue=""
                      >
                        {TEMPLATES.map(template => (
                          <option key={template.value} value={template.value}>{template.label}</option>
                        ))}
                      </select>
                      {copiedTemplate && (
                        <span className="text-sm text-blue-600 flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          Template applied!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    value={formData.business_name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                    placeholder="Your Business Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Type
                  </label>
                  <select
                    value={formData.business_type || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, business_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    <option value="">Select a type</option>
                    {BUSINESS_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industry
                </label>
                <input
                  type="text"
                  value={formData.industry || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  placeholder="e.g., Technology, Healthcare, Finance"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Audience
                </label>
                <textarea
                  value={formData.target_audience || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_audience: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  placeholder="Describe your ideal customers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unique Value Proposition
                </label>
                <textarea
                  value={formData.unique_value_proposition || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, unique_value_proposition: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  placeholder="What makes your business unique?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Services Offered
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add a service"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addArrayItem('services_offered', (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                      addArrayItem('services_offered', input.value);
                      input.value = '';
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(formData.services_offered || []).map((service, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                      <span>{service}</span>
                      <button
                        onClick={() => removeArrayItem('services_offered', index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <button
                  onClick={saveContext}
                  disabled={saving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Business Context'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'communication' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tone of Voice
                  </label>
                  <select
                    value={formData.tone_of_voice || 'professional'}
                    onChange={(e) => setFormData(prev => ({ ...prev, tone_of_voice: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    {TONE_OPTIONS.map(tone => (
                      <option key={tone.value} value={tone.value}>{tone.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language Style
                  </label>
                  <select
                    value={formData.language_style || 'conversational'}
                    onChange={(e) => setFormData(prev => ({ ...prev, language_style: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    {LANGUAGE_STYLES.map(style => (
                      <option key={style.value} value={style.value}>{style.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Communication Instructions
                </label>
                <textarea
                  value={formData.custom_instructions || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, custom_instructions: e.target.value }))}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  placeholder="Any specific instructions for how the AI should communicate?"
                />
              </div>

              <div className="pt-4 border-t">
                <button
                  onClick={saveContext}
                  disabled={saving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Communication Style'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'guidelines' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Response Guidelines
                </label>
                <p className="text-sm text-gray-600 mb-2">
                  How should the AI respond to customers?
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add a guideline"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addArrayItem('response_guidelines', (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                      addArrayItem('response_guidelines', input.value);
                      input.value = '';
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(formData.response_guidelines || []).map((guideline, index) => (
                    <div key={index} className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg">
                      <span className="text-green-800">✓ {guideline}</span>
                      <button
                        onClick={() => removeArrayItem('response_guidelines', index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prohibited Topics
                </label>
                <p className="text-sm text-gray-600 mb-2">
                  Topics the AI should avoid discussing
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add a prohibited topic"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addArrayItem('prohibited_topics', (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                      addArrayItem('prohibited_topics', input.value);
                      input.value = '';
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(formData.prohibited_topics || []).map((topic, index) => (
                    <div key={index} className="flex items-center justify-between bg-red-50 px-3 py-2 rounded-lg">
                      <span className="text-red-800">✗ {topic}</span>
                      <button
                        onClick={() => removeArrayItem('prohibited_topics', index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Escalation Triggers
                </label>
                <p className="text-sm text-gray-600 mb-2">
                  When should the AI hand off to a human?
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add an escalation trigger"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addArrayItem('escalation_triggers', (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                      addArrayItem('escalation_triggers', input.value);
                      input.value = '';
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(formData.escalation_triggers || []).map((trigger, index) => (
                    <div key={index} className="flex items-center justify-between bg-yellow-50 px-3 py-2 rounded-lg">
                      <span className="text-yellow-800">⚠️ {trigger}</span>
                      <button
                        onClick={() => removeArrayItem('escalation_triggers', index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key Policies
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add a policy"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addArrayItem('key_policies', (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                      addArrayItem('key_policies', input.value);
                      input.value = '';
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(formData.key_policies || []).map((policy, index) => (
                    <div key={index} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg">
                      <span className="text-blue-800">📋 {policy}</span>
                      <button
                        onClick={() => removeArrayItem('key_policies', index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <button
                  onClick={saveContext}
                  disabled={saving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save AI Guidelines'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}