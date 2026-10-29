export type MessageStatus = "streaming" | "complete" | "error" | "aborted";
export interface Source {
  id: string;
  label: string;
  count: number;
  included: number;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  createdAt: string;
  hasAttachment?: boolean;
  sources?: Source[];
  historyScopes?: string[] | null;
}
export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}
export interface Settings {
  mode: "direct" | "relay";
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  maxContextChars: number;
  includeContacts: boolean;
  keepHistory: boolean;
  rememberKey: boolean;
  visionEnabled: boolean;
  scopes: Record<string, boolean>;
}
export interface ContextPack {
  text: string;
  sources: Source[];
  chars: number;
  truncated: boolean;
}
export interface Attachment {
  name: string;
  preview: string;
  dataUrl: string;
}
export type Theme = "light" | "dark";
export type View = "chat" | "sessions";
export interface RequestHandle {
  promise: Promise<{ text: string; finishReason?: string }>;
  abort(): void;
}
export interface FamilySnapshot {
  [key: string]: unknown;
}
