// ========================= Core Types =========================

export type QuestionType = "multiple-choice" | "checkbox" | "short-answer";

/** Only two display modes:
 * - "percent"   → show scores as 0–100%
 * - "points900" → show scores as 0–900 points (CompTIA-style)
 */
export type ScoreMode = "percent" | "points900";

// ========================= Quiz Content =========================

export interface Question {
  id: string;
  question: string;
  type: QuestionType;
  options: string[];
  // string for multiple-choice / short-answer; string[] for checkbox
  answer: string | string[];
  imageUrl?: string | null;
}

// ========================= Attempts & Sessions =========================

export interface QuizResult {
  date: number; // ms timestamp
  score: number; // number of correct answers
  total: number; // total questions
  answeredQuestions: {
    question: string;
    userAnswer: string | string[];
    correctAnswer: string | string[];
    isCorrect: boolean;
  }[];
  isPractice?: boolean;
}

export interface QuizSession {
  startedAt: number;
  order: string[];
  answersByQuestionId: Record<string, string | string[]>;
  lastSavedAt: number;
  currentIndex: number;
  submittedAt?: number; // set when user submits
}

// ========================= Scoring Config (simple) =========================

export interface ScoringConfig {
  mode: ScoreMode; // "percent" or "points900"
}

// ========================= Quiz & Related =========================

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  status: "Not Started" | "In Progress" | "Completed"; // student's status
  timeLimit?: number; // minutes
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  results?: QuizResult[]; // multiple attempts per student

  // optional metadata
  scoring?: ScoringConfig; // how to display final grade (100% or 900 pts)
  archived?: boolean;
}

export interface UserQuiz extends Omit<Quiz, "id"> {
  userId: string;
  quizId: string;
}

// ========================= Misc =========================

export interface ManagedFile {
  name: string;
  size: string;
  url: string;
  path: string;
}

export interface Student {
  uid: string;
  name: string;
  email: string;
}
