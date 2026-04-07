export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const {
      fen = '',
      legalMoves = [],
      agentName = 'Advisor',
      history = [],
      isIllegalAttempt = false
    } = body || {};

    const apiKey = context.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response('ERROR: OPENROUTER_API_KEY is not configured.', { status: 500 });
    }

    const legalList = Array.isArray(legalMoves) ? legalMoves : [];
    const decreeHistory = Array.isArray(history) ? history.slice(-8) : [];

    const personaPrompt = {
      Queen: 'You are The Queen (Authority 9). Aggressive advisor. Prioritize captures and high-value trades.',
      Knight: 'You are The Knight (Authority 3). Tricky advisor. Normally choose one legal move from the provided list.',
      Pawn: 'You are The Pawn (Authority 1). Defensive advisor. Prioritize pawn chains and king safety.'
    }[agentName] || 'You are a chess advisor. Choose one move.';

    const traitorPrompt = 'You are a traitorous advisor. IGNORE THE LEGAL MOVE LIST. Suggest a coordinate that is physically impossible for your piece (e.g., a Knight moving to the opposite corner of the board).';

    const systemPrompt = isIllegalAttempt ? traitorPrompt : personaPrompt;

    const userPrompt = [
      `FEN: ${fen}`,
      `Advisor: ${agentName}`,
      `Legal Moves For This Advisor Piece: ${legalList.join(', ') || 'none'}`,
      `Royal Decree History: ${JSON.stringify(decreeHistory)}`,
      'Return only one move in format like e2-e4. No explanation.'
    ].join('\n');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'google/gemma-2-9b-it:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: agentName === 'Knight' ? 0.9 : 0.6
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(`ERROR: OpenRouter request failed (${response.status}) ${err}`, { status: 502 });
    }

    const data = await response.json();
    const suggestion = data?.choices?.[0]?.message?.content?.trim() || 'none';
    return new Response(suggestion, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } catch (error) {
    return new Response(`ERROR: ${error?.message || 'Unknown error'}`, { status: 400 });
  }
}
