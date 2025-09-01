'use server';
/**
 * @fileOverview An AI agent that generates feedback notes for student evaluations.
 *
 * - generateEvaluationNotes - A function that handles the note generation process.
 * - GenerateEvaluationNotesInput - The input type for the generateEvaluationNotes function.
 * - GenerateEvaluationNotesOutput - The return type for the generateEvaluationNotes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CriterionSchema = z.object({
  id: z.string().describe('The unique identifier for the criterion.'),
  name: z.string().describe('The name of the evaluation criterion in Arabic.'),
  score: z.number().describe('The score given, from 1 (worst) to 5 (best).'),
});

const GenerateEvaluationNotesInputSchema = z.object({
  criteria: z.array(CriterionSchema),
});
export type GenerateEvaluationNotesInput = z.infer<typeof GenerateEvaluationNotesInputSchema>;

const NoteSchema = z.object({
    id: z.string().describe('The unique identifier for the criterion.'),
    note: z.string().describe('The generated feedback note in Arabic.'),
});

const GenerateEvaluationNotesOutputSchema = z.object({
  notes: z.array(NoteSchema).describe('The list of generated notes for each criterion.'),
});
export type GenerateEvaluationNotesOutput = z.infer<typeof GenerateEvaluationNotesOutputSchema>;


export async function generateEvaluationNotes(input: GenerateEvaluationNotesInput): Promise<GenerateEvaluationNotesOutput> {
  if (input.criteria.length === 0) {
      return { notes: [] };
  }
  const criteriaWithNumbers = {
      ...input,
      criteria: input.criteria.map(c => ({...c, score: Number(c.score)}))
  }
  return generateEvaluationNotesFlow(criteriaWithNumbers);
}


const prompt = ai.definePrompt({
  name: 'generateEvaluationNotesPrompt',
  input: {schema: GenerateEvaluationNotesInputSchema},
  output: {schema: GenerateEvaluationNotesOutputSchema},
  prompt: `You are an expert educational assessor writing internal evaluation notes for a student in a cybersecurity training program.
These notes are for the administration and will NOT be shared directly with the student. Your tone should be professional, direct, and analytical.

Your task is to generate a concise note in Arabic for each evaluation criterion based on its score (1-5, where 5 is best).
- High scores (4-5) should be noted as strengths.
- Average scores (3) should be noted as meeting expectations, with potential for growth.
- Low scores (1-2) should be noted as areas of concern or weaknesses that require attention.

The notes must be in Arabic. Do not provide English translations.
Important: When generating the note for each criterion, provide only the direct feedback text. Frame the feedback around the student. For example, instead of saying "The participation is distinguished...", say "The student is distinguished by high-quality participation...".

Here are the criteria to generate notes for:
{{#each criteria}}
- Criterion ID: {{{id}}}, Name: "{{{name}}}", Score: {{{score}}}/5
{{/each}}

Please generate a note for each criterion and return it in the specified JSON output format.
`,
});


const generateEvaluationNotesFlow = ai.defineFlow(
  {
    name: 'generateEvaluationNotesFlow',
    inputSchema: GenerateEvaluationNotesInputSchema,
    outputSchema: GenerateEvaluationNotesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
