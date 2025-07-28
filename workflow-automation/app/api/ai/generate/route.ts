import { NextResponse } from "next/server";
import { mockAuthServer } from "@/lib/auth/mock-auth-server";

// This is a mock AI generation function
// In production, you would use OpenAI or Anthropic API
async function generateWorkflowFromPrompt(prompt: string) {
  // Simulate AI processing time
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Parse the prompt to determine what kind of workflow to create
  const promptLower = prompt.toLowerCase();
  
  // Example: "When a contact is created in GoHighLevel, send them a welcome email"
  if (promptLower.includes('contact') && promptLower.includes('created') && promptLower.includes('email')) {
    return {
      nodes: [
        {
          id: 'trigger-1',
          type: 'custom',
          position: { x: 250, y: 100 },
          data: {
            label: 'GoHighLevel Trigger',
            description: 'Trigger from GHL events',
            iconName: 'GoHighLevel Trigger',
            color: 'bg-orange-100 text-orange-600',
            integration: 'GoHighLevel',
            moduleType: 'trigger',
            options: [
              { value: 'contact_created', label: 'Contact Created', description: 'When a new contact is created' },
              { value: 'contact_updated', label: 'Contact Updated', description: 'When a contact is updated' },
            ],
            selectedOption: 'contact_created'
          }
        },
        {
          id: 'action-1',
          type: 'custom',
          position: { x: 250, y: 250 },
          data: {
            label: 'Send Email',
            description: 'Send email notification',
            iconName: 'Send Email',
            color: 'bg-pink-100 text-pink-600',
            moduleType: 'action',
            config: {
              to: '{{contact.email}}',
              subject: 'Welcome to our platform!',
              body: 'Hi {{contact.firstName}},\\n\\nWelcome! We\'re excited to have you here.'
            }
          }
        }
      ],
      edges: [
        {
          id: 'e1-2',
          source: 'trigger-1',
          target: 'action-1',
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        }
      ]
    };
  }

  // Example: "Every day at 9am, check for new opportunities and create tasks"
  if (promptLower.includes('every day') && promptLower.includes('opportunities') && promptLower.includes('task')) {
    return {
      nodes: [
        {
          id: 'trigger-1',
          type: 'custom',
          position: { x: 250, y: 100 },
          data: {
            label: 'Schedule',
            description: 'Run on a schedule',
            iconName: 'Schedule',
            color: 'bg-green-100 text-green-600',
            moduleType: 'trigger',
            config: {
              frequency: 'daily',
              time: '09:00'
            }
          }
        },
        {
          id: 'action-1',
          type: 'custom',
          position: { x: 250, y: 250 },
          data: {
            label: 'GoHighLevel Action',
            description: 'Perform GHL actions',
            iconName: 'GoHighLevel Action',
            color: 'bg-orange-100 text-orange-600',
            integration: 'GoHighLevel',
            moduleType: 'action',
            options: [
              { value: 'create_task', label: 'Create Task', description: 'Create a task' },
            ],
            selectedOption: 'create_task'
          }
        }
      ],
      edges: [
        {
          id: 'e1-2',
          source: 'trigger-1',
          target: 'action-1',
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        }
      ]
    };
  }

  // Default workflow if we can't parse the intent
  return {
    nodes: [
      {
        id: 'trigger-1',
        type: 'custom',
        position: { x: 250, y: 100 },
        data: {
          label: 'Webhook',
          description: 'Trigger on HTTP request',
          iconName: 'Webhook',
          color: 'bg-blue-100 text-blue-600',
          moduleType: 'trigger'
        }
      },
      {
        id: 'action-1',
        type: 'custom',
        position: { x: 250, y: 250 },
        data: {
          label: 'HTTP Request',
          description: 'Make an API call',
          iconName: 'HTTP Request',
          color: 'bg-orange-100 text-orange-600',
          moduleType: 'action'
        }
      }
    ],
    edges: [
      {
        id: 'e1-2',
        source: 'trigger-1',
        target: 'action-1',
        animated: true,
        style: { stroke: '#94a3b8', strokeWidth: 2 }
      }
    ]
  };
}

export async function POST(request: Request) {
  try {
    const { userId } = mockAuthServer();
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const workflow = await generateWorkflowFromPrompt(prompt);

    return NextResponse.json({ 
      success: true,
      workflow,
      message: "Workflow generated successfully!"
    });
  } catch (error) {
    console.error('Error generating workflow:', error);
    return NextResponse.json(
      { error: "Failed to generate workflow" },
      { status: 500 }
    );
  }
}