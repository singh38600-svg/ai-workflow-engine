/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Workflow, CategoryType } from '@/src/types';

export const TEMPLATE_WORKFLOWS: Record<string, Workflow> = {
  "linkedin": {
    id: "wf-linkedin",
    title: "Daily AI LinkedIn Content Writer",
    description: "Monitors daily AI tech news, drafts engaging LinkedIn ideas, creates visual graphics, and queues them for optimal morning post timings.",
    category: "content_creation",
    difficulty: "Beginner",
    automationLevel: "Semi-automated",
    estimatedCostMin: 800,
    estimatedCostMax: 1500,
    currency: "INR",
    setupTimeEstimate: "45 minutes",
    humanApprovalRequired: true,
    privacyRisk: "Low",
    requirementsSummary: "Extract requirements for automated content publishing with morning routines.",
    costNotes: "Estimated cost based on free tiers for Search API, Google Gemini, and Buffer starter plan. Overages are usage-based.",
    steps: [
      {
        id: "step-1",
        order: 1,
        title: "AI News Research",
        purpose: "Fetch the latest trending AI news, reports, and breakthroughs daily.",
        toolId: "tool-google-search",
        toolSlug: "google-search",
        toolName: "Google Search API",
        toolLogo: "🔍",
        toolCategory: "research",
        whySelected: "Highly reliable for querying Google Search index with precise date filters.",
        input: "Query: 'Generative AI news last 24 hours'",
        output: "Raw array of 10 search result links with summaries.",
        setupInstructions: [
          "Create a Google Custom Search Engine (CSE) in your developer console.",
          "Obtain an API Key and search engine ID.",
          "Configure your automation platform to trigger a daily HTTP request."
        ],
        expectedOutput: "List of the top 10 articles from tech blogs.",
        humanAction: null,
        limitationNotes: ["Limited to 100 queries/day on the free tier."],
        estimatedCost: "Free (first 100/day)",
        difficulty: "beginner",
        isFree: true,
        requiresApi: true,
        requiresWebhook: false,
        privacyNotes: "Search queries are shared with Google. Do not put proprietary data.",
        alternatives: [
          { toolId: "tool-feedly", toolSlug: "feedly", toolName: "Feedly", score: 85, strength: "Best for subscribing directly to RSS newsletters.", costDiff: "Free", difficultyDiff: "Easier", compatibilityDiff: "Same" },
          { toolId: "tool-perplexity", toolSlug: "perplexity", toolName: "Perplexity AI", score: 80, strength: "Provides pre-summarized bullet points directly.", costDiff: "₹1,600/mo", difficultyDiff: "Easier", compatibilityDiff: "Harder" }
        ]
      },
      {
        id: "step-2",
        order: 2,
        title: "Idea Generation",
        purpose: "Synthesize tech articles and extract 5 hook-driven post topics.",
        toolId: "tool-gemini",
        toolSlug: "gemini",
        toolName: "Google Gemini",
        toolLogo: "✦",
        toolCategory: "research",
        whySelected: "Excellent context window and accurate structured output capabilities for bulk synthesis.",
        input: "Top 10 search articles and summaries.",
        output: "JSON array of 5 potential LinkedIn topics with hook variations.",
        setupInstructions: [
          "Acquire a Gemini API key from Google AI Studio.",
          "Design a system instruction guiding tone of voice and LinkedIn viral hooks.",
          "Feed the JSON output from Step 1 to the Gemini prompt."
        ],
        expectedOutput: "5 content ideas structured with hooks, value, and summary.",
        humanAction: null,
        limitationNotes: ["May require strict prompting to avoid generic marketing jargon."],
        estimatedCost: "Pay-as-you-go (Very Cheap)",
        difficulty: "intermediate",
        isFree: false,
        requiresApi: true,
        requiresWebhook: false,
        privacyNotes: "Data processed under API guidelines, meaning it is not stored or trained on.",
        alternatives: [
          { toolId: "tool-claude", toolSlug: "claude", toolName: "Anthropic Claude", score: 90, strength: "Slightly superior writing tone and natural dialogue style.", costDiff: "Usage-based", difficultyDiff: "Same", compatibilityDiff: "Same" },
          { toolId: "tool-chatgpt", toolSlug: "chatgpt", toolName: "OpenAI ChatGPT", score: 88, strength: "Highly integrated, simple web widget workflows.", costDiff: "Usage-based", difficultyDiff: "Easier", compatibilityDiff: "Same" }
        ]
      },
      {
        id: "step-3",
        order: 3,
        title: "Top 3 Idea Ranking",
        purpose: "Select and refine the top 3 post ideas based on potential user engagement.",
        toolId: "tool-claude",
        toolSlug: "claude",
        toolName: "Anthropic Claude",
        toolLogo: "✉️",
        toolCategory: "research",
        whySelected: "Renowned for deep logical evaluation, writing tone, and formatting details.",
        input: "5 generated post topics from previous step.",
        output: "Top 3 refined post outlines with bullet drafts.",
        setupInstructions: [
          "Pass the list of ideas to Anthropic Claude via your API router.",
          "Configure instructions to prioritize practical case-studies and code examples."
        ],
        expectedOutput: "3 high-quality post blueprints with designated formatting.",
        humanAction: "Perform final edit on the copy of the selected 3 posts.",
        limitationNotes: ["Requires manual configuration of system prompts."],
        estimatedCost: "Usage-based",
        difficulty: "intermediate",
        isFree: false,
        requiresApi: true,
        requiresWebhook: false,
        privacyNotes: "Ensures secure API transfer, zero-data logging.",
        alternatives: [
          { toolId: "tool-gemini", toolSlug: "gemini", toolName: "Google Gemini", score: 85, strength: "Extremely cost-effective for larger reasoning arrays.", costDiff: "Lower cost", difficultyDiff: "Same", compatibilityDiff: "Same" }
        ]
      },
      {
        id: "step-4",
        order: 4,
        title: "Post Draft Creation",
        purpose: "Expand the outlines into full, print-ready text drafts with hashtags.",
        toolId: "tool-gemini",
        toolSlug: "gemini",
        toolName: "Google Gemini",
        toolLogo: "✦",
        toolCategory: "research",
        whySelected: "Extremely fast generation and supports high-volume daily drafting seamlessly.",
        input: "Refined post outline and copywriting style directives.",
        output: "Completed post text with spaced paragraphs, bullet points, and hashtags.",
        setupInstructions: [
          "Connect the previous Claude output into the prompt template.",
          "Define strict length constraints (under 1,500 characters)."
        ],
        expectedOutput: "A fully copy-written post draft ready for review.",
        humanAction: "Review and approve the draft.",
        limitationNotes: ["Check formatting; sometimes LLMs output excessive emojis."],
        estimatedCost: "Usage-based",
        difficulty: "intermediate",
        isFree: false,
        requiresApi: true,
        requiresWebhook: false,
        privacyNotes: "No proprietary credentials leaked.",
        alternatives: [
          { toolId: "tool-chatgpt", toolSlug: "chatgpt", toolName: "OpenAI ChatGPT", score: 87, strength: "Very consistent response layouts.", costDiff: "Usage-based", difficultyDiff: "Same", compatibilityDiff: "Same" }
        ]
      },
      {
        id: "step-5",
        order: 5,
        title: "Carousel Prompt Generation",
        purpose: "Create supporting visual image prompts or diagram requests to boost post reach.",
        toolId: "tool-nanobanana",
        toolSlug: "nanobanana",
        toolName: "Nano Banana Lite (Gemini Image)",
        toolLogo: "🍌",
        toolCategory: "content_creation",
        whySelected: "Lightweight and embedded image creator directly inside Google AI Studio ecosystem.",
        input: "Approved post text summary.",
        output: "A stunning visual thumbnail or schema representing the topic.",
        setupInstructions: [
          "Setup the image generation call with aspect ratio set to 1:1.",
          "Retrieve the base64-encoded image output."
        ],
        expectedOutput: "A graphic banner ready to be uploaded.",
        humanAction: null,
        limitationNotes: ["Does not write high-quality text within the image."],
        estimatedCost: "Free",
        difficulty: "intermediate",
        isFree: true,
        requiresApi: true,
        requiresWebhook: false,
        privacyNotes: "Standard sandbox privacy.",
        alternatives: [
          { toolId: "tool-recraft", toolSlug: "recraft", toolName: "Recraft AI", score: 92, strength: "Generates beautiful scalable SVG charts and icons.", costDiff: "₹1,600/mo", difficultyDiff: "Harder", compatibilityDiff: "Same" },
          { toolId: "tool-canva", toolSlug: "canva", toolName: "Canva Pro", score: 89, strength: "Great manual templating options for slides.", costDiff: "₹1,000/mo", difficultyDiff: "Easier", compatibilityDiff: "Easier" }
        ]
      },
      {
        id: "step-6",
        order: 6,
        title: "Scheduling / Export",
        purpose: "Queue the finalized post and visual banner for morning publishing.",
        toolId: "tool-buffer",
        toolSlug: "buffer",
        toolName: "Buffer",
        toolLogo: "📊",
        toolCategory: "marketing",
        whySelected: "Easiest social schedule manager with fully featured API connectors and clear calendar visuals.",
        input: "Final post draft text and image attachment.",
        output: "Successfully scheduled LinkedIn calendar item.",
        setupInstructions: [
          "Connect your LinkedIn profile to your Buffer account.",
          "Integrate Buffer's API through Make or Zapier to create pending posts.",
          "Set the queue time to 08:30 AM."
        ],
        expectedOutput: "LinkedIn item queued in the weekly calendar.",
        humanAction: "Optionally check the pending queue in your Buffer mobile app.",
        limitationNotes: ["Free plan restricts you to 10 queued items per channel."],
        estimatedCost: "Free (up to 3 channels)",
        difficulty: "beginner",
        isFree: true,
        requiresApi: true,
        requiresWebhook: true,
        privacyNotes: "Buffer maintains active security tokens to access your accounts safely.",
        alternatives: [
          { toolId: "tool-make", toolSlug: "make", toolName: "Make.com", score: 88, strength: "Directly post via LinkedIn API endpoints, bypassing Buffer.", costDiff: "Usage-based", difficultyDiff: "Developer", compatibilityDiff: "Advanced" }
        ]
      }
    ],
    overallInstructions: [
      "Obtain API keys for Google Custom Search, Google AI Studio, and a free account on Buffer and Make.",
      "Create a Make.com scenario starting with a daily timer trigger at 7:00 AM.",
      "Add a Google Search node to fetch the top articles.",
      "Link a Gemini API node with system prompts to draft topics.",
      "Incorporate Claude to rank and finalize drafts.",
      "Generate matching graphic assets via the Nano Banana Image API node.",
      "Route the copy and graphics to a Buffer node to publish at 8:30 AM.",
      "Enable 'Draft Mode' inside Buffer so posts wait for your manual review."
    ],
    privacyWarnings: [
      "Any proprietary insights typed into Gemini/Claude may be processed on remote cloud instances.",
      "Be careful not to include customer emails or confidential roadmaps in the prompt context."
    ],
    riskWarnings: [
      "Automation may cause posting errors if API tokens expire. Regularly monitor your Buffer connection.",
      "Ensure the output doesn't breach LinkedIn's community formatting policies."
    ],
    optimisationSuggestions: [
      "Use Feedly RSS instead of broad Google search queries to filter tech topics with higher precision.",
      "Add an intermediate Slack notification node to ping you for manual approval of drafted copy."
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  "jobs": {
    id: "wf-jobs",
    title: "AI Job Application and Resume Tailoring Tracker",
    description: "Fetches job matches, evaluates requirements, generates custom-tailored resume modifications, and maintains a clean visual board.",
    category: "job_search",
    difficulty: "Beginner",
    automationLevel: "Semi-automated",
    estimatedCostMin: 0,
    estimatedCostMax: 500,
    currency: "INR",
    setupTimeEstimate: "30 minutes",
    humanApprovalRequired: true,
    privacyRisk: "Medium",
    requirementsSummary: "Extract requirements for automated job hunting, resume drafting, and application pipeline updates.",
    costNotes: "Completely runnable on Google Sheets, Gemini Free Tier, and Notion. Extremely cost-effective.",
    steps: [
      {
        id: "step-1",
        order: 1,
        title: "Match Scraper",
        purpose: "Consolidate open jobs matching your skillset from favorite websites.",
        toolId: "tool-google-search",
        toolSlug: "google-search",
        toolName: "Google Search API",
        toolLogo: "🔍",
        toolCategory: "research",
        whySelected: "Best for targeted keyword index scanning (e.g., site:lever.co/ 'React Developer').",
        input: "Target role title and geo-location.",
        output: "List of 15 matching application links.",
        setupInstructions: [
          "Configure specific search queries with terms like 'site:greenhouse.io' or 'site:lever.co'.",
          "Fetch links programmatically using Custom Search API or trigger search."
        ],
        expectedOutput: "A structured spreadsheet array of fresh job URLs.",
        humanAction: null,
        limitationNotes: ["Requires careful search query tweaking to filter out old postings."],
        estimatedCost: "Free",
        difficulty: "beginner",
        isFree: true,
        requiresApi: true,
        requiresWebhook: false,
        privacyNotes: "Job links are public data.",
        alternatives: []
      },
      {
        id: "step-2",
        order: 2,
        title: "Resume Customization",
        purpose: "Align your profile resume bullets with the scraped job descriptions.",
        toolId: "tool-gemini",
        toolSlug: "gemini",
        toolName: "Google Gemini",
        toolLogo: "✦",
        toolCategory: "research",
        whySelected: "Unmatched context size allows feeding entire resume text and target job specifications at once.",
        input: "Your master CV text and the target job description.",
        output: "Tailored experience summaries highlighting relevant tech skills.",
        setupInstructions: [
          "Write a detailed system prompt: 'You are an elite career counselor...'",
          "Provide CV sections as standard input fields.",
          "Invoke the Gemini API to receive bullet point improvements."
        ],
        expectedOutput: "3 tailored bullets for your resume's experience section.",
        humanAction: "Accept and paste the optimized bullets into your master resume.",
        limitationNotes: ["Avoid lying or making up experience. Always verify generated details."],
        estimatedCost: "Free",
        difficulty: "intermediate",
        isFree: true,
        requiresApi: true,
        requiresWebhook: false,
        privacyNotes: "Do not pass highly private identifiers (e.g. social security, passport) in search inputs.",
        alternatives: [
          { toolId: "tool-claude", toolSlug: "claude", toolName: "Anthropic Claude", score: 94, strength: "Generates incredibly convincing and sophisticated human-sounding prose.", costDiff: "Usage-based", difficultyDiff: "Same", compatibilityDiff: "Same" }
        ]
      },
      {
        id: "step-3",
        order: 3,
        title: "Application Logging",
        purpose: "Update your pipeline boards to log applied positions.",
        toolId: "tool-notion",
        toolSlug: "notion",
        toolName: "Notion",
        toolLogo: "📓",
        toolCategory: "productivity",
        whySelected: "Provides standard visual kanban boards with custom status tags (Applied, Interview, Rejected, Offer).",
        input: "Tailored CV copy and job link.",
        output: "Newly created item in the CRM board.",
        setupInstructions: [
          "Build a Notion database with properties: Job Title, Company, Date, URL, and tailored bullets.",
          "Connect Notion to Make.com to automatically spawn a card whenever a job is matched."
        ],
        expectedOutput: "A neat pipeline card indicating status 'Ready to Apply'.",
        humanAction: "Manually submit the CV to the company's portal.",
        limitationNotes: ["Requires manual submission as most sites block robotic applicants."],
        estimatedCost: "Free",
        difficulty: "beginner",
        isFree: true,
        requiresApi: true,
        requiresWebhook: true,
        privacyNotes: "Workspaces are secure. Share details only with trusted colleagues.",
        alternatives: [
          { toolId: "tool-airtable", toolSlug: "airtable", toolName: "Airtable", score: 88, strength: "Deeper database automations and spreadsheet formulas.", costDiff: "Free", difficultyDiff: "Same", compatibilityDiff: "Same" }
        ]
      }
    ],
    overallInstructions: [
      "Set up a Notion database titled 'Job Hunt 2026'.",
      "Run a weekly query on Google Search to pull matches, and append them to a Google Sheets sheet.",
      "Pass the matched job requirements to Gemini along with your CV text.",
      "Read the optimized resumes, download them as PDF, and submit them.",
      "Move the corresponding Notion card to 'Applied' to maintain neat dashboards."
    ],
    privacyWarnings: [
      "Do not send personal documents with sensitive metadata to public web chat platforms."
    ],
    riskWarnings: [
      "Applying with 100% robotic resumes is heavily penalized by some enterprise applicant tracking software (ATS). Always manually edit the text."
    ],
    optimisationSuggestions: [
      "Add a calendar alarm triggered on Notion status changes to automatically prepare for upcoming mock interviews."
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  "reviews": {
    id: "wf-reviews",
    title: "Customer Review Sentiment Analyzer & Email Reporter",
    description: "Gathers review submissions, assesses customer sentiment levels, isolates major complaints, and emails a beautifully formatted weekly executive PDF.",
    category: "data_reporting",
    difficulty: "Beginner",
    automationLevel: "Fully automated",
    estimatedCostMin: 1200,
    estimatedCostMax: 2500,
    currency: "INR",
    setupTimeEstimate: "35 minutes",
    humanApprovalRequired: false,
    privacyRisk: "Medium",
    requirementsSummary: "Extract requirements for reviews scanning, batch analytics, sentiment analysis, and email reporting.",
    costNotes: "Pricing based on Airtable free limits, Gemini API tokens, and a starter plan on Resend or Gmail integration.",
    steps: [
      {
        id: "step-1",
        order: 1,
        title: "Review Intake Queue",
        purpose: "Collect and structure all incoming customer reviews from forms or widgets.",
        toolId: "tool-airtable",
        toolSlug: "airtable",
        toolName: "Airtable",
        toolLogo: "🗂️",
        toolCategory: "productivity",
        whySelected: "Visual database that creates instant secure input webforms for customers.",
        input: "Customer input via webform.",
        output: "Newly logged rows in Airtable.",
        setupInstructions: [
          "Create a table in Airtable named 'Product Reviews'.",
          "Create fields: Name, Email, Stars, Feedback text, Sentiment score, and Status.",
          "Activate the Form View and share the link."
        ],
        expectedOutput: "Spreadsheet rows filled with star ratings and reviews text.",
        humanAction: null,
        limitationNotes: ["Free plan restricts you to 1,000 items per workspace."],
        estimatedCost: "Free",
        difficulty: "beginner",
        isFree: true,
        requiresApi: true,
        requiresWebhook: true,
        privacyNotes: "Airtable is highly secure and GDPR compliant.",
        alternatives: [
          { toolId: "tool-google-sheets", toolSlug: "google-sheets", toolName: "Google Sheets", score: 87, strength: "Simpler spreadsheet structure with 100% free limitations.", costDiff: "Free", difficultyDiff: "Easier", compatibilityDiff: "Same" }
        ]
      },
      {
        id: "step-2",
        order: 2,
        title: "AI Sentiment Analysis",
        purpose: "Assess raw texts, output sentiment ratings (Positive, Neutral, Negative), and pull out tags.",
        toolId: "tool-gemini",
        toolSlug: "gemini",
        toolName: "Google Gemini",
        toolLogo: "✦",
        toolCategory: "research",
        whySelected: "Best-in-class support for low-latency JSON schema enforcement to map database scores.",
        input: "Raw star rating and feedback text from Airtable.",
        output: "JSON string containing sentiment tags, isolated root complaint, and priority level.",
        setupInstructions: [
          "Connect your Airtable new row trigger to Make.com.",
          "Add a Gemini node. Pass stars and text inside the prompt.",
          "Set the response structure to output variables: sentiment, primary_issue, urgent."
        ],
        expectedOutput: "A structured analysis mapping feedback to complaint buckets.",
        humanAction: null,
        limitationNotes: ["Requires strict prompts to ensure uniform output tag spelling."],
        estimatedCost: "Pay-as-you-go (< ₹100/mo)",
        difficulty: "intermediate",
        isFree: false,
        requiresApi: true,
        requiresWebhook: false,
        privacyNotes: "Data secure under API guidelines.",
        alternatives: [
          { toolId: "tool-chatgpt", toolSlug: "chatgpt", toolName: "OpenAI ChatGPT", score: 85, strength: "Very consistent performance on structured JSON schemas.", costDiff: "Usage-based", difficultyDiff: "Same", compatibilityDiff: "Same" }
        ]
      },
      {
        id: "step-3",
        order: 3,
        title: "Weekly Dispatch",
        purpose: "Send a clean, structured digest of reviews, sentiment trends, and warnings to management.",
        toolId: "tool-resend",
        toolSlug: "resend",
        toolName: "Resend",
        toolLogo: "✉️",
        toolCategory: "marketing",
        whySelected: "Developer-optimized email builder that sends beautifully formatted layouts without spam folder warnings.",
        input: "Synthesized review analytics and lists of urgent complaints.",
        output: "Emailed digest delivered to stakeholder inboxes.",
        setupInstructions: [
          "Verify your business domain inside the Resend settings console.",
          "Create an email template summarizing sentiment statistics.",
          "Configure a weekly schedule inside Make.com to pull reviews and dispatch the email."
        ],
        expectedOutput: "A beautifully styled HTML weekly report email.",
        humanAction: null,
        limitationNotes: ["Domain verification is required to send emails successfully."],
        estimatedCost: "Free (up to 3,000 emails/mo)",
        difficulty: "intermediate",
        isFree: true,
        requiresApi: true,
        requiresWebhook: true,
        privacyNotes: "Addresses and feedback texts are sent to email routing servers.",
        alternatives: [
          { toolId: "tool-gmail", toolSlug: "gmail", toolName: "Gmail (Google Workspace)", score: 89, strength: "Simplest connection with zero domain verifications needed.", costDiff: "Free", difficultyDiff: "Easier", compatibilityDiff: "Same" }
        ]
      }
    ],
    overallInstructions: [
      "Set up your customer survey form inside Airtable.",
      "Build a Make.com integration flow triggered on 'New Airtable Record'.",
      "Pass the text to Google Gemini for JSON sentiment tags mapping.",
      "Write back the results (Sentiment, Urgent, Primary Issue) to the Airtable row.",
      "Add a scheduled scenario running every Monday at 9:00 AM to fetch 'Negative' or 'Urgent' reviews, group them, and send a summary email via Resend."
    ],
    privacyWarnings: [
      "Ensure customer personal contact info (like phone numbers) is redacted or anonymized before running bulk AI reviews processing if sensitivity levels are set to High."
    ],
    riskWarnings: [
      "Ensure the email scheduler works securely. Spamming corporate stakeholders on every review entry is highly counter-productive."
    ],
    optimisationSuggestions: [
      "Integrate Slack notifications for any sentiment flagged as 'Critical' or star rating below 2, enabling real-time support recovery."
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};
