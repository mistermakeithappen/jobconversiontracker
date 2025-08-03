'use client';

export default function BotPage({ params }: { params: { botId: string } }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Bot ID: {params.botId}</h1>
      <p>This is a test page to verify dynamic routing works.</p>
    </div>
  );
}