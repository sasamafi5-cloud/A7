export type AIMode = "Pametna AI" | "Šaljiva AI" | "Sveznalica AI" | "Profesionalna AI";

export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

export interface Alarm {
  id: string;
  time: string;
  label: string;
  createdAt: string;
  active: boolean;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "luna";
  text: string;
  timestamp: string;
}
