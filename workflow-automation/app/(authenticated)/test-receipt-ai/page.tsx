'use client';

import { useState } from 'react';
import { Upload, Camera, MessageSquare, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface ProcessingResult {
  success: boolean;
  receiptData?: any;
  jobMatches?: any[];
  response?: any;
  nextAction?: string;
  error?: string;
}

export default function TestReceiptAIPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setResult(null);
      
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const processReceipt = async () => {
    if (!selectedFile) return;

    setProcessing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('userPhone', '+1234567890'); // Mock phone for testing
      formData.append('userEmail', 'test@example.com'); // Mock email for testing

      const response = await fetch('/api/receipts/process-image', {
        method: 'POST',
        body: formData,
        credentials: 'include' // Include cookies for mock auth
      });

      const data = await response.json();
      console.log('API Response:', data);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        console.error('API returned error:', data);
        setResult({
          success: false,
          error: data.error || 'Failed to process receipt',
          details: data.details || 'Unknown error'
        });
      } else {
        setResult(data);
      }

    } catch (error) {
      console.error('Error processing receipt:', error);
      setResult({
        success: false,
        error: 'Failed to process receipt image',
        details: error instanceof Error ? error.message : 'Network error'
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AI Receipt Processing Test</h1>
        <p className="text-gray-600 mt-2">
          Upload a receipt image to test the AI processing and job matching system
        </p>
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-700 text-sm">
            <strong>Note:</strong> This system now uses your personal OpenAI API key. 
            Make sure you've added one in <a href="/settings/api-keys" className="underline hover:text-blue-800">API Keys Settings</a>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="text-center relative"
            >
              {previewUrl ? (
                <div className="space-y-4">
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    className="max-w-full max-h-64 mx-auto rounded-lg border"
                  />
                  <p className="text-sm text-gray-600">{selectedFile?.name}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-lg font-medium text-gray-900">Drop receipt image here</p>
                    <p className="text-gray-600">or click to browse</p>
                  </div>
                </div>
              )}
              
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {selectedFile && (
            <button
              onClick={processReceipt}
              disabled={processing}
              className="w-full inline-flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing Receipt...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Process Receipt with AI</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {result && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="border-b p-4">
                <div className="flex items-center space-x-2">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <h3 className="text-lg font-semibold text-gray-900">
                    Processing {result.success ? 'Complete' : 'Failed'}
                  </h3>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {result.success ? (
                  <>
                    {/* Extracted Receipt Data */}
                    {result.receiptData && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Extracted Data</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500 block text-xs">Vendor:</span>
                            <p className="font-medium text-gray-900">{result.receiptData.vendor_name}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-xs">Amount:</span>
                            <p className="font-medium text-gray-900">{formatCurrency(result.receiptData.amount)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-xs">Date:</span>
                            <p className="font-medium text-gray-900">{result.receiptData.receipt_date}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-xs">Category:</span>
                            <p className="font-medium text-gray-900">{result.receiptData.category}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500 block text-xs">Description:</span>
                            <p className="font-medium text-gray-900">{result.receiptData.description || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-xs">Confidence:</span>
                            <p className="font-medium text-gray-900">{result.receiptData.confidence}%</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Job Matches */}
                    {result.jobMatches && result.jobMatches.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                          AI Job Matches Found
                        </h4>
                        <div className="space-y-2">
                          {result.jobMatches.map((match: any, index: number) => (
                            <div key={index} className="bg-white rounded-lg p-3 border border-green-100">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-900">{match.opportunityName}</p>
                                  <p className="text-sm text-gray-600 mt-1">Contact: {match.contactName}</p>
                                  <p className="text-xs text-gray-500 mt-2 italic">{match.reason}</p>
                                </div>
                                <div className="ml-3 flex-shrink-0">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-green-100 to-green-200 text-green-800">
                                    {match.confidence}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Response */}
                    {result.response && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                          <MessageSquare className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-2">AI Response</h4>
                            <p className="text-gray-800 whitespace-pre-line leading-relaxed">{result.response.message}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                Type: <span className="font-medium ml-1">{result.response.type}</span>
                              </span>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                Next Action: <span className="font-medium ml-1">{result.nextAction}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* What Happens Next */}
                    {result.response && result.response.type === 'no_match' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-2 text-blue-600" />
                          What Happens Next?
                        </h4>
                        <div className="text-sm text-gray-700 space-y-2">
                          <p>Since no matching jobs were found, in a real workflow:</p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>The user would receive an SMS/email with the receipt details</li>
                            <li>They would be asked to specify which job this expense belongs to</li>
                            <li>They could reply with a job name or number from their active jobs</li>
                            <li>The receipt would then be automatically logged to that job</li>
                          </ol>
                          <p className="mt-3 text-xs text-gray-600">
                            <strong>Note:</strong> Job matching works by comparing vendor names, descriptions, 
                            and date proximity with your GoHighLevel opportunities.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-red-700 space-y-2">
                    <p className="font-semibold">{result.error}</p>
                    {result.details && (
                      <p className="text-sm text-red-600">Details: {result.details}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {processing && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-blue-500 animate-pulse" />
                <div>
                  <h3 className="font-medium text-gray-900">Processing Receipt</h3>
                  <p className="text-sm text-gray-600">
                    AI is analyzing the image and matching to jobs...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* How it Works */}
      <div className="mt-12 bg-gray-50 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">How AI Receipt Processing Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-medium text-gray-900">1. Upload</h3>
            <p className="text-sm text-gray-600">Send receipt image via SMS, email, or app</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Camera className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-medium text-gray-900">2. Extract</h3>
            <p className="text-sm text-gray-600">AI reads vendor, amount, date, and description</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="font-medium text-gray-900">3. Match</h3>
            <p className="text-sm text-gray-600">Smart matching to active jobs and contacts</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <MessageSquare className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-medium text-gray-900">4. Confirm</h3>
            <p className="text-sm text-gray-600">User confirms and receipt is automatically logged</p>
          </div>
        </div>
      </div>
    </div>
  );
}