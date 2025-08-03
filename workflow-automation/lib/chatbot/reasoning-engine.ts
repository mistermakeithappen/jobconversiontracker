import OpenAI from 'openai';
import { getServiceSupabase } from '@/lib/supabase/client';

interface GoalEvaluationParams {
  goal: string;
  possibleOutcomes: string[];
  userMessage: string;
  conversationHistory: Message[];
  botContext?: string;
  sessionData?: Record<string, any>;
}

interface GoalEvaluationResult {
  achieved: boolean;
  confidence: number;
  reasoning: string;
  selectedOutcome?: string;
  suggestedResponse?: string;
  extractedData?: Record<string, any>;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AIReasoningEngine {
  private openai: OpenAI;
  private supabase = getServiceSupabase();

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Evaluate if a goal has been achieved based on the conversation
   */
  async evaluateGoalAchievement(params: GoalEvaluationParams): Promise<GoalEvaluationResult> {
    try {
      // Build the evaluation prompt
      const systemPrompt = this.buildGoalEvaluationPrompt(params);
      
      // Create messages array with conversation history
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...params.conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        { role: 'user', content: params.userMessage }
      ];

      // Call OpenAI for reasoning
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.3, // Lower temperature for more consistent reasoning
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from AI');
      }

      // Parse the structured response
      const evaluation = JSON.parse(response) as GoalEvaluationResult;

      // Ensure confidence is between 0-100
      evaluation.confidence = Math.max(0, Math.min(100, evaluation.confidence));

      return evaluation;

    } catch (error) {
      console.error('Error in goal evaluation:', error);
      return {
        achieved: false,
        confidence: 0,
        reasoning: 'Failed to evaluate goal due to an error',
        suggestedResponse: 'I apologize, but I encountered an error evaluating your response. Could you please try again?'
      };
    }
  }

  /**
   * Evaluate conditions for branching logic
   */
  async evaluateCondition(
    condition: any,
    userMessage: string,
    conversationHistory: Message[],
    sessionData: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      switch (condition.type) {
        case 'contains_keyword':
          return this.evaluateKeywordCondition(userMessage, condition.keywords);

        case 'sentiment_analysis':
          return await this.evaluateSentiment(userMessage, condition.sentiment);

        case 'intent_matching':
          return await this.evaluateIntent(userMessage, condition.intents, conversationHistory);

        case 'data_extraction':
          return await this.evaluateDataExtraction(userMessage, condition.dataType, sessionData);

        case 'custom_logic':
          return await this.evaluateCustomLogic(
            userMessage, 
            condition.logic, 
            conversationHistory, 
            sessionData
          );

        default:
          return false;
      }
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false;
    }
  }

  /**
   * Generate a contextual response based on the current state
   */
  async generateResponse(
    nodeType: string,
    nodeConfig: any,
    conversationHistory: Message[],
    botContext: string,
    sessionData: Record<string, any> = {}
  ): Promise<string> {
    try {
      const systemPrompt = this.buildResponseGenerationPrompt(
        nodeType,
        nodeConfig,
        botContext,
        sessionData
      );

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        max_tokens: 500
      });

      return completion.choices[0].message.content || 'I understand. How can I help you further?';

    } catch (error) {
      console.error('Error generating response:', error);
      return 'I apologize for the confusion. Could you please clarify what you need?';
    }
  }

  /**
   * Extract structured data from user messages
   */
  async extractData(
    userMessage: string,
    dataSchema: Record<string, any>,
    conversationHistory: Message[] = []
  ): Promise<Record<string, any>> {
    try {
      const systemPrompt = `You are a data extraction assistant. Extract the following information from the user's message and conversation history:

${JSON.stringify(dataSchema, null, 2)}

Return the extracted data as a JSON object matching the schema. If a field cannot be extracted, set it to null.`;

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0].message.content;
      return response ? JSON.parse(response) : {};

    } catch (error) {
      console.error('Error extracting data:', error);
      return {};
    }
  }

  /**
   * Private helper methods
   */

  private buildGoalEvaluationPrompt(params: GoalEvaluationParams): string {
    return `You are an AI assistant evaluating whether a conversation goal has been achieved.

GOAL: ${params.goal}

POSSIBLE OUTCOMES:
${params.possibleOutcomes.map((outcome, i) => `${i + 1}. ${outcome}`).join('\n')}

${params.botContext ? `CONTEXT: ${params.botContext}` : ''}

Your task is to analyze the conversation and the latest user message to determine:
1. Has the goal been achieved?
2. If yes, which specific outcome was reached?
3. Your confidence level (0-100)
4. Your reasoning for this evaluation
5. Any relevant data extracted from the conversation
6. A suggested response for the bot

Consider the full conversation context and look for:
- Explicit confirmations or agreements
- Implicit acceptance through providing requested information
- Clear rejections or refusals
- Requests for more information (goal not yet achieved)
- Off-topic responses (goal not achieved)

Return your evaluation as a JSON object with the following structure:
{
  "achieved": boolean,
  "confidence": number (0-100),
  "reasoning": "string explaining your evaluation",
  "selectedOutcome": "string (one of the possible outcomes, if achieved)",
  "suggestedResponse": "string (what the bot should say next)",
  "extractedData": { "key": "value" } (any relevant data from the conversation)
}`;
  }

  private buildResponseGenerationPrompt(
    nodeType: string,
    nodeConfig: any,
    botContext: string,
    sessionData: Record<string, any>
  ): string {
    let prompt = `You are an AI assistant in a conversation workflow. ${botContext}\n\n`;

    switch (nodeType) {
      case 'milestone':
        prompt += `You are at a milestone node trying to achieve: ${nodeConfig.goal_description}
Guide the conversation naturally toward this goal while being helpful and conversational.`;
        break;

      case 'book_appointment':
        prompt += `You are helping to book an appointment. Available calendars: ${nodeConfig.calendar_ids?.join(', ') || 'General calendar'}
Help the user schedule a convenient time while gathering necessary information.`;
        break;

      case 'message':
        prompt += `Deliver this message naturally: ${nodeConfig.content}
Make it conversational and appropriate to the context.`;
        break;

      default:
        prompt += `Continue the conversation naturally while being helpful and staying on topic.`;
    }

    if (Object.keys(sessionData).length > 0) {
      prompt += `\n\nSession context: ${JSON.stringify(sessionData)}`;
    }

    prompt += `\n\nGenerate a natural, conversational response that moves the conversation forward.`;

    return prompt;
  }

  private evaluateKeywordCondition(message: string, keywords: string[]): boolean {
    const lowerMessage = message.toLowerCase();
    return keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
  }

  private async evaluateSentiment(
    message: string, 
    expectedSentiment: 'positive' | 'negative' | 'neutral'
  ): Promise<boolean> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Classify the sentiment of the message as positive, negative, or neutral. Return only the sentiment word.'
          },
          { role: 'user', content: message }
        ],
        temperature: 0,
        max_tokens: 10
      });

      const sentiment = completion.choices[0].message.content?.toLowerCase().trim();
      return sentiment === expectedSentiment;

    } catch (error) {
      console.error('Error in sentiment analysis:', error);
      return false;
    }
  }

  private async evaluateIntent(
    message: string,
    expectedIntents: string[],
    conversationHistory: Message[]
  ): Promise<boolean> {
    try {
      const systemPrompt = `Classify the user's intent from their message. Possible intents: ${expectedIntents.join(', ')}
Return only the matching intent, or "none" if no match.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.slice(-3).map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })),
          { role: 'user', content: message }
        ],
        temperature: 0,
        max_tokens: 50
      });

      const detectedIntent = completion.choices[0].message.content?.toLowerCase().trim();
      return expectedIntents.some(intent => 
        detectedIntent?.includes(intent.toLowerCase())
      );

    } catch (error) {
      console.error('Error in intent evaluation:', error);
      return false;
    }
  }

  private async evaluateDataExtraction(
    message: string,
    dataType: string,
    sessionData: Record<string, any>
  ): Promise<boolean> {
    // Check if the required data type has been extracted
    const extractionPatterns: Record<string, RegExp> = {
      email: /[\w.-]+@[\w.-]+\.\w+/,
      phone: /[\d\s\-\(\)]+\d{4,}/,
      date: /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/,
      time: /\d{1,2}:\d{2}\s*(am|pm|AM|PM)?/,
      number: /\d+/
    };

    const pattern = extractionPatterns[dataType];
    if (pattern) {
      return pattern.test(message);
    }

    // For custom data types, check session data
    return sessionData[dataType] !== undefined;
  }

  private async evaluateCustomLogic(
    message: string,
    logic: string,
    conversationHistory: Message[],
    sessionData: Record<string, any>
  ): Promise<boolean> {
    try {
      const systemPrompt = `Evaluate if the following custom condition is met:
${logic}

Consider the user's message, conversation history, and session data.
Return "true" or "false" only.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Message: ${message}\nSession Data: ${JSON.stringify(sessionData)}` 
          }
        ],
        temperature: 0,
        max_tokens: 10
      });

      return completion.choices[0].message.content?.toLowerCase().trim() === 'true';

    } catch (error) {
      console.error('Error in custom logic evaluation:', error);
      return false;
    }
  }

  /**
   * Log evaluation results to database
   */
  async logEvaluation(
    sessionId: string,
    nodeId: string,
    userMessage: string,
    evaluation: GoalEvaluationResult
  ): Promise<void> {
    try {
      await this.supabase
        .from('workflow_goal_evaluations')
        .insert([{
          session_id: sessionId,
          node_id: nodeId,
          user_message: userMessage,
          ai_evaluation: evaluation,
          goal_achieved: evaluation.achieved,
          confidence_score: evaluation.confidence,
          reasoning: evaluation.reasoning,
          selected_outcome: evaluation.selectedOutcome
        }]);
    } catch (error) {
      console.error('Error logging evaluation:', error);
    }
  }
}