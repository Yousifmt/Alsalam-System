
"use server";

import { generateQuizQuestions } from "@/ai/flows/generate-quiz-questions";
import { z } from "zod";
import type { Quiz, Question } from "@/lib/types";
import { createQuiz } from "@/services/quiz-service";

const QuizGenerationSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters long." }),
  numQuestions: z.coerce.number().min(1, { message: "Please enter a number of questions." }).max(10, { message: "You can generate up to 10 questions at a time." }),
  pdfFile: z.instanceof(File).refine(file => file.size > 0, "PDF file is required."),
});

export interface QuizGenerationState {
  state: 'idle' | 'generating' | 'generated' | 'error';
  message?: string;
  quiz?: Omit<Quiz, 'id'>;
}

export async function generateQuizAction(
  prevState: QuizGenerationState,
  formData: FormData
): Promise<QuizGenerationState> {
  const rawFormData = {
    topic: formData.get("topic"),
    numQuestions: formData.get("numQuestions"),
    pdfFile: formData.get("pdfFile"),
  };

  // Allow resetting the form state
  if (!rawFormData.topic && !rawFormData.numQuestions && !(rawFormData.pdfFile as File)?.size) {
    return { state: 'idle' };
  }
  
  const validatedFields = QuizGenerationSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      state: 'error',
      message: validatedFields.error.flatten().fieldErrors.pdfFile?.[0] || validatedFields.error.flatten().fieldErrors.topic?.[0] || validatedFields.error.flatten().fieldErrors.numQuestions?.[0] || 'Invalid input.',
    };
  }

  const { topic, numQuestions, pdfFile } = validatedFields.data;

  try {
    const fileBuffer = await pdfFile.arrayBuffer();
    const base64String = Buffer.from(fileBuffer).toString('base64');
    const pdfDataUri = `data:application/pdf;base64,${base64String}`;

    const result = await generateQuizQuestions({
      topic,
      numQuestions,
      pdfDataUri,
    });
    
    if (result && result.questions) {
      const generatedQuiz: Omit<Quiz, 'id'> = {
        title: topic,
        questions: result.questions.map((q, i) => ({ ...q, id: `gen-${Date.now()}-${i}` })),
        description: `An AI-generated quiz about ${topic}`,
        status: 'Not Started',
        shuffleAnswers: false,
        shuffleQuestions: false,
        results: [],
      };
      return {
        state: 'generated',
        quiz: generatedQuiz
      };
    } else {
      return { state: 'error', message: "Failed to generate quiz. The AI model returned an unexpected result." };
    }

  } catch (e) {
    const error = e as Error;
    console.error(error);
    return { state: 'error', message: `An error occurred: ${error.message}` };
  }
}


export async function saveGeneratedQuizAction(quiz: Omit<Quiz, 'id'>): Promise<{success: boolean, message: string, error?: boolean}> {
    try {
        await createQuiz(quiz);
        return { success: true, message: "Quiz saved successfully!" };
    } catch (error) {
        console.error("Failed to save AI-generated quiz:", error);
        return { success: false, message: "Failed to save the quiz to the database.", error: true };
    }
}
