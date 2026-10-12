import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, action, documentText } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'CONFIGURATION_ERROR', 
          message: 'Zen AI service is currently unavailable. Please contact administrator.' 
        }, 
        { status: 503 }
      );
    }

    // 1. Build student-focused system prompt and user instruction
    const systemInstruction = 'You are ZenOffice Academic AI, a fast, knowledgeable study and document co-pilot built specifically for students and academic researchers. Explain concepts clearly, accurately, and concisely. Use markdown formatting with bullet points, clear step-by-step points, and bold headers where appropriate.';

    let userInstruction = prompt || '';

    // Specialized student and academic actions
    if (action === 'explain') {
      userInstruction = `Explain the following academic document or lecture notes in simple, intuitive terms. Break down complex terminology, formulas, and concepts so a student preparing for an exam can easily understand them:\n\n${documentText ? `--- DOCUMENT CONTENT ---\n${documentText.slice(0, 8000)}\n--- END CONTENT ---\n\n` : ''}${prompt ? `Student Question: ${prompt}` : 'Please provide a comprehensive concept breakdown.'}`;
    } else if (action === 'quiz') {
      userInstruction = `Based on the provided document content, generate 5 high-yield practice quiz questions for student exam preparation. For each question, provide 4 options (A, B, C, D), indicate the correct answer, and provide a clear step-by-step explanation:\n\n${documentText ? `--- DOCUMENT CONTENT ---\n${documentText.slice(0, 8000)}\n--- END CONTENT ---\n\n` : ''}${prompt ? `Focus on: ${prompt}` : ''}`;
    } else if (action === 'summarize') {
      userInstruction = `Create a high-impact revision cheat sheet and study summary based on the following material. Include: 1) Core Themes, 2) Key Definitions & Formulas, 3) Critical Takeaways for Exams:\n\n${documentText ? `--- DOCUMENT CONTENT ---\n${documentText.slice(0, 8000)}\n--- END CONTENT ---\n\n` : ''}${prompt ? `Additional Notes: ${prompt}` : ''}`;
    } else if (action === 'cite') {
      userInstruction = `Format academic citations for the following text or topic in APA (7th ed), MLA (9th ed), IEEE, and Harvard formats. Also provide advice on proper in-text citation placement:\n\n${documentText ? `Text/Reference: ${documentText.slice(0, 4000)}\n\n` : ''}${prompt ? `Query: ${prompt}` : ''}`;
    } else if (action === 'polish') {
      userInstruction = `Proofread and elevate the academic tone of the following text for a university essay or research paper. Correct grammar, syntax, flow, and conciseness while preserving the original meaning:\n\n${documentText ? `Text: ${documentText.slice(0, 5000)}\n\n` : ''}${prompt ? `Specific instruction: ${prompt}` : ''}`;
    } else if (action === 'formula') {
      userInstruction = `You are a spreadsheet formula expert for ZenOffice Excel. Write the exact formula for the user's request. Give the exact formula (e.g. =SUM(C6:E6) or =AVERAGEIF(B2:B20, ">50")) and a 1-sentence explanation of how it works:\n\nRequest: ${prompt || documentText || 'Calculate total'}`;
    } else {
      if (documentText) {
        userInstruction = `Document Context:\n${documentText.slice(0, 6000)}\n\nStudent Query: ${prompt}`;
      }
    }

    // 2. Call Google Gemini 3.6 Flash
    const model = 'gemini-3.6-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            parts: [{ text: userInstruction }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Zen AI Engine error:', errorText);
      return NextResponse.json(
        { error: 'ZEN_AI_API_ERROR', message: 'The AI engine was unable to complete the request. Please try again.' },
        { status: geminiResponse.status }
      );
    }

    const data = await geminiResponse.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

    return NextResponse.json({
      result: resultText,
      model,
    });
  } catch (error: any) {
    console.error('Zen AI error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
