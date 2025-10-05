// --- Proxy URL: use full origin to avoid wrong-origin 405s during dev ---
const PROXY_URL = 'http://localhost:3000/api/gemini';

// --- Runtime env loader (client-side, no bundler) ---
// Not required when using the proxy; kept harmlessly for backward compatibility.
let GEMINI_API_KEY = '';
if (typeof window !== 'undefined' && window.__ENV && window.__ENV.GEMINI_API_KEY) {
  GEMINI_API_KEY = window.__ENV.GEMINI_API_KEY;
}

// ========================================
// AI SERVICE - GEMINI INTEGRATION
// ========================================

class AIService {
  constructor() {
    // Not used with the proxy flow; kept for optional client-only testing.
    this.API_KEY = GEMINI_API_KEY || '';

    this.BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
    this.MODEL = 'gemini-2.0-flash-exp'; // Using Gemini 2.0 Flash
    this.libsLoaded = { pdfjs: false, mammoth: false };
  }

  // Dynamically load external libs on demand
  async loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  async ensurePDFJS() {
    if (window.pdfjsLib) return;
    try {
      // Try multiple CDN sources for reliability
      const sources = [
        'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      ];

      for (const src of sources) {
        try {
          await this.loadScript(src);
          if (window.pdfjsLib) {
            // Set worker source with same base URL
            const baseUrl = src.substring(0, src.lastIndexOf('/'));
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${baseUrl}/pdf.worker.min.js`;
            return;
          }
        } catch (error) {
          console.warn(`Failed to load PDF.js from ${src}:`, error);
          continue;
        }
      }

      throw new Error('All PDF.js CDN sources failed to load');
    } catch (error) {
      console.warn('PDF.js not available, PDF processing will be skipped:', error);
    }
  }

  async ensureMammoth() {
    if (window.mammoth) return;
    await this.loadScript('https://unpkg.com/mammoth/mammoth.browser.min.js');
  }

  /**
   * Extract text content from a file
   */
  async extractFileContent(file) {
    const name = (file.name || '').toLowerCase();
    const ext = name.split('.').pop();

    // Text-like files: read as text
    if (
      file.type.includes('text') ||
      ['txt','md','json','js','ts','tsx','jsx','html','css','py','java','cpp','c','cs','go','rb'].includes(ext)
    ) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });
    }

    // PDF: use pdf.js to extract text (with fallback)
    if (file.type === 'application/pdf' || ext === 'pdf') {
      try {
        await this.ensurePDFJS();
        if (!window.pdfjsLib) {
          throw new Error('PDF.js not available');
        }
        const buffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map(it => it.str);
          fullText += strings.join(' ') + '\n\n';
        }
        return fullText.trim();
      } catch (error) {
        console.warn('PDF processing failed, using fallback:', error);
        return `PDF File: ${file.name} (${this.formatFileSize(file.size)}) - Text extraction not available. Please upload as text or use a different format for AI analysis.`;
      }
    }

    // DOCX: use mammoth to extract raw text
    if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      await this.ensureMammoth();
      const buffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
      return (result.value || '').trim();
    }

    // Fallback: Provide metadata only
    return `File: ${file.name} (${this.formatFileSize(file.size)}) - Content extraction not supported for this file type.`;
  }

  /**
   * Make API call to Gemini (via secure proxy)
   */
  async callGeminiAPI(prompt, systemPrompt = null) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required');
    }

    const combinedPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    try {
      // Use full URL so dev pages on different origins don't hit a static server by mistake
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemPrompt })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `Proxy error: ${response.status}`);
      }

      const data = await response.json();
      const text = data?.text || '';
      if (!text) {
        throw new Error('No response generated');
      }
      return text;
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  /**
   * Generate summary for educational content
   */
  async generateSummary(content, resourceTitle = '') {
    const systemPrompt = `You are an expert educational assistant. Create clear, comprehensive summaries of academic content.

FORMATTING REQUIREMENTS:
- Use clear headings with numbers (1., 2., 3., etc.)
- Use bullet points (-) for key concepts
- Use line breaks to separate sections
- Keep sentences concise and readable
- Structure the content logically`;

    const prompt = `Create a comprehensive summary of this educational content:

Title: ${resourceTitle}

Content:
${content}

Please provide:
1. Brief Overview (2-3 sentences)
2. Key Concepts (bullet points)
3. Important Details (bullet points)
4. Examples or Case Studies (if any)`;

    try {
      const response = await this.callGeminiAPI(prompt, systemPrompt);
      return {
        type: 'summary',
        title: resourceTitle,
        content: this.sanitizeOutput(response),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  /**
   * Generate study plan for educational content
   */
  async generateStudyPlan(content, resourceTitle = '') {
    const systemPrompt = `You are an expert educational planner. Create structured, actionable study plans that help students learn effectively.

FORMATTING REQUIREMENTS:
- Use clear headings with numbers (1., 2., 3., etc.)
- Use bullet points (-) for activities and tasks
- Use line breaks to separate sections
- Include time estimates for each activity
- Structure the content logically`;

    const prompt = `Create a detailed study plan for this educational content:

Title: ${resourceTitle}

Content:
${content}

Please provide:
1. Learning Objectives (what students should achieve)
2. Study Schedule Breakdown (sessions with time estimates)
3. Key Activities for Each Session (reading, practice, review)
4. Self-Assessment Methods
5. Review Schedule Recommendations
6. Additional Resources or Practice Suggestions`;

    try {
      const response = await this.callGeminiAPI(prompt, systemPrompt);
      return {
        type: 'study_plan',
        title: resourceTitle,
        content: this.sanitizeOutput(response),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to generate study plan: ${error.message}`);
    }
  }

  /**
   * Generate flashcards for educational content
   */
  async generateFlashcards(content, resourceTitle = '') {
    const systemPrompt = `You are an expert educational content creator. Create effective flashcards for active recall and spaced repetition learning.

Instructions:
- Create 10-15 flashcards that cover the most important concepts
- Questions should test understanding, not just memorization
- Include a mix of factual, conceptual, and application questions
- Keep questions concise but specific
- Provide clear, accurate answers
- Format as JSON array with question and answer pairs`;

    const prompt = `Create flashcards for this educational content:

Title: ${resourceTitle}

Content:
${content}

Please create 10-15 flashcards in JSON format like this:
[
  {"question": "What is...", "answer": "..."},
  {"question": "How does...", "answer": "..."}
]

Focus on:
- Key concepts and definitions
- Important processes or procedures  
- Critical thinking applications
- Common misconceptions to address
- Practical examples and use cases`;

    try {
      const response = await this.callGeminiAPI(prompt, systemPrompt);

      // Try to parse JSON response
      let flashcards;
      try {
        // Extract JSON from response if it's wrapped in text
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          flashcards = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // If JSON parsing fails, convert text to flashcards format
        flashcards = this.parseTextToFlashcards(response);
      }

      return {
        type: 'flashcards',
        title: resourceTitle,
        content: {
          flashcards: flashcards,
          total_count: flashcards.length
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to generate flashcards: ${error.message}`);
    }
  }

  /**
   * Parse text response to flashcard format if JSON parsing fails
   */
  parseTextToFlashcards(text) {
    const flashcards = [];
    const lines = text.split('\n').filter(line => line.trim());

    let currentQuestion = null;
    let currentAnswer = null;

    for (let line of lines) {
      line = line.trim();

      // Look for question patterns
      if (line.match(/^\d+\.|^Q:|^Question:/i) || line.endsWith('?')) {
        if (currentQuestion && currentAnswer) {
          flashcards.push({
            question: currentQuestion.replace(/^\d+\.\s*|^Q:\s*|^Question:\s*/i, '').trim(),
            answer: currentAnswer.replace(/^A:\s*|^Answer:\s*/i, '').trim()
          });
        }
        currentQuestion = line;
        currentAnswer = null;
      }
      // Look for answer patterns
      else if (line.match(/^A:|^Answer:/i) || (currentQuestion && !currentAnswer)) {
        currentAnswer = line;
      }
      // Continue building current answer
      else if (currentAnswer && line.length > 0) {
        currentAnswer += ' ' + line;
      }
    }

    // Add the last flashcard
    if (currentQuestion && currentAnswer) {
      flashcards.push({
        question: currentQuestion.replace(/^\d+\.\s*|^Q:\s*|^Question:\s*/i, '').trim(),
        answer: currentAnswer.replace(/^A:\s*|^Answer:\s*/i, '').trim()
      });
    }

    // If no flashcards were parsed, create some basic ones
    if (flashcards.length === 0) {
      flashcards.push({
        question: "What are the main topics covered in this material?",
        answer: "Please review the original content for key concepts and themes."
      });
    }

    return flashcards;
  }

  /**
   * Process file and generate AI content
   */
  async processResource(file, generationType, resourceTitle = '') {
    try {
      // Extract content from file
      const content = await this.extractFileContent(file);

      // Generate based on type
      switch (generationType) {
        case 'summary':
          return await this.generateSummary(content, resourceTitle);
        case 'study_plan':
          return await this.generateStudyPlan(content, resourceTitle);
        case 'flashcards':
          return await this.generateFlashcards(content, resourceTitle);
        case 'comprehensive':
          return await this.generateComprehensiveAnalysis(content, resourceTitle);
        default:
          throw new Error('Invalid generation type');
      }
    } catch (error) {
      console.error('AI Processing Error:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive analysis (summary, study plan, and flashcards)
   */
  async generateComprehensiveAnalysis(content, resourceTitle = '') {
    try {
      // Generate all three types concurrently for better performance
      const [summary, studyPlan, flashcards] = await Promise.all([
        this.generateSummary(content, resourceTitle),
        this.generateStudyPlan(content, resourceTitle),
        this.generateFlashcards(content, resourceTitle)
      ]);

      return {
        summary: summary.content,
        studyPlan: studyPlan.content,
        flashcards: flashcards.content.flashcards || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Comprehensive analysis error:', error);
      throw new Error(`Failed to generate comprehensive analysis: ${error.message}`);
    }
  }

  async processResourceFromUrl(url, generationType, resourceTitle = '') {
    try {
      const fileName = resourceTitle || url.split('/').pop() || 'resource';
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to fetch resource content (${resp.status})`);
      const blob = await resp.blob();
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      return await this.processResource(file, generationType, resourceTitle || fileName);
    } catch (error) {
      console.error('Error processing resource from URL:', error);
      throw error;
    }
  }

  /**
   * Save AI generation to local storage (simplified approach)
   */
  async saveGeneration(resourceId, generationData) {
    try {
      const userId = window.appState?.currentUser?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Save to local storage for now
      const storageKey = `ai_generation_${userId}_${resourceId}_${generationData.type}`;
      const dataToStore = {
        ...generationData,
        created_at: new Date().toISOString(),
        user_id: userId,
        resource_id: resourceId
      };

      localStorage.setItem(storageKey, JSON.stringify(dataToStore));
      return dataToStore;
    } catch (error) {
      console.error('Error saving AI generation:', error);
      throw error;
    }
  }

  /**
   * Load AI generations for a resource from local storage
   */
  async loadGenerations(resourceId, generationType = null) {
    try {
      const userId = window.appState?.currentUser?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const generations = [];
      const prefix = `ai_generation_${userId}_${resourceId}_`;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (!generationType || data.type === generationType) {
              generations.push(data);
            }
          } catch (parseError) {
            console.warn('Failed to parse stored generation:', key);
          }
        }
      }

      // Sort by created_at descending
      return generations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      console.error('Error loading AI generations:', error);
      throw error;
    }
  }

  sanitizeOutput(text) {
    if (!text) return '';
    // Preserve basic formatting while cleaning up
    let out = text
      .replace(/\*\*+/g, '')          // remove bold markers
      .replace(/\r/g, '')             // remove carriage returns
      .trim();

    // Convert line breaks to HTML breaks for better display
    out = out.replace(/\n/g, '<br>');

    return out;
  }

  /**
   * Utility function to format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Create global instance
window.aiService = new AIService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
}
