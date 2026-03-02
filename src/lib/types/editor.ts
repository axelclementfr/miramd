export interface Tab {
  id: string;
  path: string | null;
  name: string;
  content: string;
  savedContent: string;
  isModified: boolean;
}

export interface DocumentStats {
  words: number;
  chars: number;
  lines: number;
  paragraphs: number;
}

export interface TocEntry {
  level: number;
  text: string;
  pos: number;
}
