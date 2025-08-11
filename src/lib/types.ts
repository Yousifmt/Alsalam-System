
export type QuestionType = 'multiple-choice' | 'checkbox' | 'short-answer';

export interface Question {
  id: string;
  question: string;
  type: QuestionType;
  options: string[];
  // answer is a string for multiple-choice and short-answer, and a string[] for checkboxes
  answer: string | string[]; 
  imageUrl?: string | null;
}

export interface QuizResult {
    date: number; // Timestamp of the attempt
    score: number;
    total: number;
    answeredQuestions: {
        question: string;
        userAnswer: string | string[];
        correctAnswer: string | string[];
        isCorrect: boolean;
    }[];
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  status: 'Not Started' | 'In Progress' | 'Completed'; // Represents the student's status, not master quiz.
  timeLimit?: number; // in minutes
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  results?: QuizResult[]; // Store multiple results for a student
}

export interface UserQuiz extends Omit<Quiz, 'id'> {
    userId: string;
    quizId: string;
}

export interface ManagedFile {
    name: string;
    size: string;
    url: string;
    path: string;
}
