// FILE: src/lib/types.ts
/* =========================================================
 * Central TypeScript models for Quiz & Evaluations
 * (Consolidated + course-assignment support)
 * ========================================================= */

export type QuestionType = "multiple-choice" | "checkbox" | "short-answer";

/** Score display modes:
 * - "percent"   → 0–100%
 * - "points900" → 0–900 points (CompTIA-style)
 */
export type ScoreMode = "percent" | "points900";

/** Course assignment for quizzes. */
export type CourseTag = "unassigned" | "security+" | "a+";
export type StudentCourseTag = Extract<CourseTag, "security+" | "a+">;

// ========================= Quiz Content =========================

export interface Question {
  id: string;
  question: string;
  type: QuestionType;
  options: string[];
  /** string for multiple-choice / short-answer; string[] for checkbox */
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

// ========================= Scoring Config =========================

export interface ScoringConfig {
  mode: ScoreMode; // "percent" or "points900"
}

// ========================= Quiz & Related =========================

export type QuizStatus = "Not Started" | "In Progress" | "Completed" | "Archived" | "Draft";

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  /** Represents the student-facing lifecycle; admins may set 'Archived'. */
  status: QuizStatus;
  timeLimit?: number; // minutes
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  results?: QuizResult[]; // multiple attempts per student

  // metadata
  scoring?: ScoringConfig; // how to display final grade
  archived?: boolean; // explicit archived flag (compat)
  order?: number; // for manual ordering
  course?: CourseTag; // ← NEW: assignment to course (default 'unassigned')
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
  /** Persistent course assignment (chosen once via access code). */
  courseTag?: StudentCourseTag;
}

export interface EvaluationCriterion {
  score: number;
  notes?: string | null;
}

export interface Evaluation {
  id?: string;
  type: "daily";
  studentId: string;
  studentName: string;
  date: number; // Timestamp
  trainingTopic: string;
  personalSkills: {
    professionalCommitment: EvaluationCriterion;
    behavioralMaturity: EvaluationCriterion;
    communicationSkills: EvaluationCriterion;
    initiativeAndResponsibility: EvaluationCriterion;
  };
  classroomSkills: {
    participationQuality: EvaluationCriterion;
    dialogueManagement: EvaluationCriterion;
    teamwork: EvaluationCriterion;
    cyberRulesCommitment: EvaluationCriterion;
  };
  technicalSkills: {
    contentComprehension: EvaluationCriterion;
    focusAndAttention: EvaluationCriterion;
    activityParticipation: EvaluationCriterion;
    askingQuestions: EvaluationCriterion;
    summarizationAbility: EvaluationCriterion;
    deviceUsage: EvaluationCriterion;
  };
  overallRating: "Excellent" | "Very Good" | "Good" | "Acceptable" | "Needs Improvement";
}

export interface FinalEvaluation {
  id?: string;
  type: "final";
  studentId: string;
  studentName: string;
  trainerName: string;
  courseName: string;
  trainingPeriodStart: number;
  trainingPeriodEnd: number;
  date: number; // Timestamp
  technicalSkills: {
    cybersecurityPrinciples: EvaluationCriterion;
    threatTypes: EvaluationCriterion;
    protectionTools: EvaluationCriterion;
    vulnerabilityAnalysis: EvaluationCriterion;
    incidentResponse: EvaluationCriterion;
    networkProtocols: EvaluationCriterion;
    policyImplementation: EvaluationCriterion;
    forensics: EvaluationCriterion;
  };
  analyticalSkills: {
    analyticalThinking: EvaluationCriterion;
    problemSolving: EvaluationCriterion;
    attentionToDetail: EvaluationCriterion;
    decisionMaking: EvaluationCriterion;
  };
  behavioralSkills: {
    discipline: EvaluationCriterion;
    respectForRules: EvaluationCriterion;
    interaction: EvaluationCriterion;
    teamwork: EvaluationCriterion;
  };
  communicationSkills: {
    speakingAndExplanation: EvaluationCriterion;
    clarity: EvaluationCriterion;
  };
  trainerNotes?: string | null;

  overallRating: "Excellent" | "Very Good" | "Good" | "Acceptable" | "Needs Improvement";
  finalRecommendation: "Ready for Security+ exam" | "Needs review before exam" | "Re-study recommended";
}
