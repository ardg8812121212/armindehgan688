export interface Attachment {
  type: 'image' | 'file';
  mimeType: string;
  data: string; // base64
  name?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isError?: boolean;
  timestamp: number;
  sources?: Array<{ uri: string; title: string }>;
  isStreaming?: boolean;
  images?: string[]; // Generated images by AI
  imageError?: boolean;
  attachments?: Attachment[]; // User uploaded attachments
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  themeColor: string;
  bgColor: string;
  textColor: string;
  icon: string;
}

export interface AppSettings {
  model: string;
  temperature: number;
  enableSearch: boolean;
}

export interface Notification {
  id: string;
  type: 'error' | 'success' | 'info';
  message: string;
}