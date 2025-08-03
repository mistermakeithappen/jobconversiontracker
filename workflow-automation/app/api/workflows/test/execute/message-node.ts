export async function executeMessageNode(
  node: any,
  context: any,
  controller: any,
  encoder: any,
  supabase: any,
  executeAIResponse: any
): Promise<string | null> {
  try {
    const config = node.config || {};
    const messageContent = config.message || 'Hello! How can I help you today?';
    
    // Create AI prompt for message node
    const systemPrompt = `You are a helpful AI assistant in a conversation flow.

${context.variables.user_goal ? `The user's overall goal is: "${context.variables.user_goal}"` : ''}

You need to deliver this message in a natural, conversational way: "${messageContent}"

After delivering the message, engage with the user based on their response. Keep the conversation flowing naturally toward achieving their goal.

Important: Incorporate the message content naturally into your response, don't just repeat it verbatim.`;

    // Execute AI response with message context
    await executeAIResponse(node, context, controller, encoder, supabase, {
      systemPrompt,
      includeHistory: true,
      storeResponseAs: 'message_response'
    });

    return null; // Let edges determine flow
  } catch (error) {
    console.error('Message node error:', error);
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'error',
      message: `Message node error: ${error instanceof Error ? error.message : 'Unknown error'}`
    })}\n\n`));
    return null;
  }
}