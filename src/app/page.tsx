import Chat from '@/components/Chat';
import { UserInfo } from '@/components/UserInfo';

export default function Home() {
  return (
    <div className="h-full flex flex-col">
      {/* Header with user info */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">GovernsAI</h1>
          <UserInfo />
        </div>
      </div>
      
      {/* Chat component */}
      <div className="flex-1">
        <Chat />
      </div>
    </div>
  );
}
