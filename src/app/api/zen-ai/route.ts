import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, action, documentText, customApiKey, model = 'llama-3.3-70b-versatile' } = body;

    // 1. Resolve API key (priority: customApiKey from student input -> header -> env)
    const apiKey = customApiKey?.trim() || req.headers.get('x-zen-key') || process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'MISSING_API_KEY', 
          message: 'Zen AI Custom Key is required. You can enter your free key directly in the AI Assistant settings or set GROQ_API_KEY in the environment.' 
        }, 
        { status: 401 }
      );
    }

    // 2. Build student-focused system prompt and user instruction
    let systemInstruction = 'You are ZenOffice Academic AI, a fast, knowledgeable study and document co-pilot built specifically for students and academic researchers. Explain concepts clearly, accurately, and concisely. Use markdown formatting with bullet points and bold headers where appropriate.';

    let userInstruction = prompt || '';

    // Specialized student actions
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

    // 3. Call Groq OpenAI-compatible chat completion endpoint
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userInstruction }
        ],
        temperature: 0.4,
        max_tokens: 2048,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Zen AI Engine error:', errorText);
      return NextResponse.json(
        { error: 'ZEN_AI_API_ERROR', message: `Zen AI Engine error (${groqResponse.status}): ${errorText}` },
        { status: groqResponse.status }
      );
    }

    const data = await groqResponse.json();
    const resultText = data.choices?.[0]?.message?.content || 'No response generated.';

    return NextResponse.json({
      result: resultText,
      model: data.model || model,
      usage: data.usage,
    });
  } catch (error: any) {
    console.error('Zen AI error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
