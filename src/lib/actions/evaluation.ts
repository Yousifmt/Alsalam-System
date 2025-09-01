
'use server';

import type { Evaluation } from "../types";
import { deleteEvaluation as deleteEvalFromDb } from "@/services/evaluation-service";


export async function deleteEvaluationAction(evaluationId: string): Promise<{ success: boolean; message: string }> {
    if (!evaluationId) {
        return { success: false, message: "Evaluation ID is required." };
    }
    try {
        await deleteEvalFromDb(evaluationId);
        return { success: true, message: "Evaluation deleted successfully." };
    } catch (error) {
        console.error("Error deleting evaluation:", error);
        return { success: false, message: (error as Error).message || "An unknown error occurred during deletion." };
    }
}
