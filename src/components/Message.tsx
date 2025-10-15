"use client";

import { useState } from "react";
import { Message as MessageType } from "@/lib/types";
import DecisionBadge from "./DecisionBadge";

interface MessageProps {
  message: MessageType;
  className?: string;
}

export default function Message({ message, className = "" }: MessageProps) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const isBlocked = message.decision === "block";
  const [toast, setToast] = useState<string | null>(null);

  const canRemember = !isTool && !!message.content?.trim();

  const onRemember = async () => {
    try {
      const res = await fetch('/api/context/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message.content,
          contentType: message.role === 'user' ? 'user_message' : 'agent_message',
          metadata: {
            messageId: message.id,
            decision: message.decision,
            reasons: message.reasons,
          }
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to save context (${res.status})`);
      }
      setToast('Saved to memory');
      setTimeout(() => setToast(null), 2000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Save failed');
      setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <div
      className={`flex ${
        isUser ? "justify-end" : "justify-start"
      } ${className}`}
    >
      <div className={`max-w-[80%] ${isUser ? "order-2" : "order-1"}`}>
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? "bg-blue-500 text-white"
              : isTool
              ? isBlocked
                ? "bg-red-100 text-red-900 border border-red-300"
                : "bg-orange-100 text-orange-900 border border-orange-200"
              : isBlocked
              ? "bg-red-100 text-red-900 border border-red-300"
              : "bg-gray-100 text-gray-900"
          }`}
        >
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>

        {/* Show tool calls for assistant messages */}
        {!isUser &&
          !isTool &&
          message.tool_calls &&
          message.tool_calls.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.tool_calls.map((toolCall, index) => (
                <div
                  key={index}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-blue-900">
                      🔧 Tool Call
                    </span>
                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                      {toolCall.function.name}
                    </span>
                  </div>
                  <div className="text-xs text-blue-700 font-mono">
                    {(() => {
                      try {
                        return JSON.stringify(
                          JSON.parse(toolCall.function.arguments),
                          null,
                          2
                        );
                      } catch (error) {
                        // If JSON parsing fails, show the raw arguments
                        return toolCall.function.arguments;
                      }
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}

        {/* Show decision badge for assistant and tool messages */}
        {message.decision &&
          (message.role === "assistant" || message.role === "tool") && (
            <div className="mt-2 flex justify-start">
              <DecisionBadge
                decision={message.decision}
                reasons={message.reasons}
              />
            </div>
          )}

        {/* Remember action & toast */}
        {canRemember && (
          <div className={`mt-2 ${isUser ? 'text-right' : 'text-left'}`}>
            <button
              onClick={onRemember}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border bg-white hover:bg-gray-50 text-gray-700"
              title="Save this to memory"
            >
              🧠 Remember this
            </button>
          </div>
        )}
        {toast && (
          <div className={`mt-2 ${isUser ? 'text-right' : 'text-left'}`}>
            <span className="inline-block text-xs px-2 py-1 rounded bg-gray-800 text-white">{toast}</span>
          </div>
        )}

        {/* Show confirmation link if required */}
        {message.confirmationRequired && message.confirmationUrl && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900 mb-2">
                  This action requires your approval via passkey
                </p>
                <a
                  href={message.confirmationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  🔐 Approve with Passkey
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
                <p className="text-xs text-yellow-700 mt-2">
                  Correlation ID:{" "}
                  <code className="bg-yellow-100 px-1 rounded">
                    {message.correlationId}
                  </code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Role label for accessibility */}
        <div
          className={`text-xs text-gray-500 mt-1 ${
            isUser ? "text-right" : "text-left"
          }`}
        >
          {isUser ? "You" : isTool ? "Tool Result" : "Assistant"}
        </div>
      </div>
    </div>
  );
}
