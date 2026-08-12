// Web Speech API için minimal tip tanımları — resmi @types paketi
// mevcut değil, sadece bu projede kullanılan alanlar tanımlanıyor.
// Tarayıcı desteği garanti değildir, kullanım öncesi her zaman
// feature-detection yapılmalıdır (bkz. src/app/(dashboard)/ai-destek/page.tsx).

interface SpeechRecognitionEventResultItem {
  transcript: string;
}

interface SpeechRecognitionEventResult {
  0: SpeechRecognitionEventResultItem;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionEventResultList {
  length: number;
  item(index: number): SpeechRecognitionEventResult;
  [index: number]: SpeechRecognitionEventResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionEventResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}
