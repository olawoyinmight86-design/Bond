import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const TIPS = [
  'Share one thing you appreciate about your partner today — small or big.',
  'Plan a mini date for this week. Even 20 minutes of focused time counts.',
  'Ask your partner: "What made you smile today?" and really listen.',
  'Send a surprise message just to say you are thinking about them.',
  'Try a new activity together this week — novelty strengthens bonds.',
  'Reflect on a favorite memory together and talk about why it matters.',
  'Leave a kind note where your partner will find it unexpectedly.',
  'Take five minutes to share your goals for the month with each other.',
  'Practice active listening today — repeat back what you heard before responding.',
  'Express gratitude for something specific your partner did recently.',
  'Create a shared playlist of songs that remind you of each other.',
  'Plan something to look forward to together — anticipation builds connection.',
  'Put your phone away during your next meal together. Just be present.',
  'Tell your partner one thing they do that makes you feel loved.',
  'Reminisce about your first date or first impression of each other.',
  'Write down three words that describe your partner and share them.',
];

const PROMPTS: { keywords: string[]; responses: string[] }[] = [
  {
    keywords: ['date', 'idea', 'activity', 'fun', 'bored', 'do together'],
    responses: [
      'Try a cozy movie night at home with a theme — pick a genre, make snacks, and put phones away. The key is focused, distraction-free time.',
      'Cook a new recipe together. Pick something neither of you has made before. The mess is half the fun.',
      'Take a walk somewhere new — a different neighborhood, a park you have not explored. Novelty sparks conversation.',
      'Have a board game night or try a two-player card game. Friendly competition brings out laughter.',
      'Create a shared bucket list. Each of you adds five things you want to do together this year.',
    ],
  },
  {
    keywords: ['talk', 'conversation', 'say', 'discuss', 'communicate'],
    responses: [
      'Try asking open-ended questions: "What is something you are excited about this week?" or "What is a goal you are working toward?"',
      'Play the "36 Questions" game — start with light ones and go deeper. It is designed to build closeness.',
      'Share your high and low of the day with each other. It is a simple ritual that builds daily connection.',
      'Ask: "Is there anything you have been wanting to tell me but have not found the right moment?"',
      'Try the rose and thorn exercise: share one good thing and one hard thing from your day.',
    ],
  },
  {
    keywords: ['argument', 'fight', 'conflict', 'angry', 'upset', 'mad'],
    responses: [
      'Take a pause before responding. Acknowledge each other\'s feelings and use "I" statements. Focus on the issue, not the person.',
      'Remember: it is you two versus the problem, not you versus each other. Take a breath and tackle it as a team.',
      'When tensions rise, try saying: "I want to understand your perspective. Can you tell me more?"',
      'It is okay to take a 15-minute break during a heated moment. Come back when you both feel calmer.',
      'After a disagreement, do a repair check-in: "Are we okay? Is there anything you still need from me?"',
    ],
  },
  {
    keywords: ['far', 'distance', 'long distance', 'apart', 'miss'],
    responses: [
      'Send a voice note instead of a text. Hearing your voice carries warmth that words alone cannot.',
      'Watch something together while on a call — sync up a movie or show and react in real time.',
      'Share a photo of your day, even the ordinary moments. It helps your partner feel part of your life.',
      'Set a regular time to connect — even a 10-minute call at the same time daily creates a ritual.',
      'Write a letter by hand and mail it. In a world of texts, a physical letter is deeply personal.',
    ],
  },
  {
    keywords: ['love', 'appreciate', 'grateful', 'thank'],
    responses: [
      'Tell your partner one specific thing they did recently that made you feel loved. Specificity makes gratitude real.',
      'Write a short note listing three things you love about your partner. Leave it where they will find it.',
      'Try a gratitude ritual: before bed, each of you names one thing you appreciated about the other today.',
      'Say "thank you" for the small, everyday things — making coffee, listening, being there. These matter most.',
    ],
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? 'tip';

    if (action === 'tip') {
      const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
      return new Response(JSON.stringify({ tip }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'prompt') {
      const prompt = (body.prompt ?? '').toLowerCase();

      for (const category of PROMPTS) {
        if (category.keywords.some(kw => prompt.includes(kw))) {
          const message = category.responses[Math.floor(Math.random() * category.responses.length)];
          return new Response(JSON.stringify({ message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      return new Response(JSON.stringify({
        message: 'I am here to help you strengthen your bond. Ask me about date ideas, conversation starters, handling disagreements, or staying connected from afar.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
