export type AdditionalLesson = {
  key: string;
  module: string;
  title: string;
  teach: string[];
  kb: string[];
  practice: { question: string; explain: string } & (
    { choices: string[] } |
    { fields: { label: string; answer: number; unit?: string; tolerance?: number }[] }
  );
};
