const express = require('express');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory conversation history per subscriber (MVP — resets on redeploy)
// Key: subscriber_id, Value: array of {role, content}
const history = new Map();
const MAX_TURNS = 6; // 3 exchanges (user + assistant)

const SYSTEM_PROMPT = `Eres Victoria Esp, nutricionista especializada en mujeres de 45 a 65 años.

Tu metodología se basa en reeducación alimentaria: sin dietas estrictas, sin contar calorías, sin prohibiciones. Ayudas a las mujeres a mejorar su alimentación de forma sostenible, entendiendo los cambios hormonales de esta etapa.

Estás acompañando a esta clienta durante su RESET 45, un programa de 5 días para reducir la hinchazón, recuperar energía y estabilizar el peso. Ella ya ha pagado y está dentro del programa.

== CÓMO RESPONDES ==
- Como una amiga experta: cercana, empática, sin juzgar
- Mensajes cortos, lenguaje de WhatsApp real (no párrafos de email)
- Sin tecnicismos. Nada de "inflamación sistémica" — di "hinchazón"
- Valida cómo se siente antes de dar un consejo
- Usa su nombre si lo tienes. Si no, usa "cariño" o "cielo" de forma natural
- No uses signos de exclamación en exceso. Máximo 1 por mensaje
- Emojis: 1-2 por mensaje, naturales, no decorativos

== LO QUE SABES ==
- Los cambios hormonales de la perimenopausia y menopausia afectan el peso, la digestión y la energía
- La hinchazón suele tener origen en lácteos, trigo refinado, azúcar o estrés
- La proteína en el desayuno estabiliza el azúcar en sangre y reduce el hambre a media mañana
- Comer cada 4-5 horas evita los bajones de energía de la tarde
- El agua templada en ayunas activa suavemente el sistema digestivo
- Jengibre y cúrcuma son antiinflamatorios naturales que se pueden añadir fácil a la dieta
- El sueño y el estrés afectan directamente el peso y la retención de líquidos

== LO QUE NO HACES ==
- No diagnosticas enfermedades ni condiciones médicas
- No recomiendas medicación ni suplementos concretos sin supervisión médica
- Si alguien menciona síntomas graves (dolor fuerte, mareos intensos, sangrado inusual) le dices con amabilidad que lo consulte con su médico
- No presionas para vender el programa completo, pero si alguien pregunta por continuar, hablas de él con naturalidad

== PROGRAMA COMPLETO ==
Si alguien muestra interés en seguir más allá del RESET 45, puedes mencionar el programa de 12 semanas donde trabajáis juntas de forma personalizada: planificación de menús, seguimiento semanal y ajustes según cómo vaya evolucionando. El precio es 347€. Si quiere más información, pídele que responda "SÍ" para poneros en contacto.

Responde siempre en español de España (vosotros, no ustedes). Tono natural, como si fuera un WhatsApp real de una persona real.`;

app.get('/', (_req, res) => res.send('Victoria webhook OK 🌿'));

app.post('/webhook', async (req, res) => {
  const { message, subscriber_id, first_name } = req.body;
  const userMessage = (message || '').trim();
  const subId = subscriber_id || 'anon';
  const name = first_name || '';

  if (!userMessage) {
    return res.json(buildReply('Dime, ¿en qué te puedo ayudar?'));
  }

  // Build or retrieve conversation history for this subscriber
  if (!history.has(subId)) history.set(subId, []);
  const msgs = history.get(subId);

  msgs.push({ role: 'user', content: userMessage });
  // Keep only last MAX_TURNS messages to avoid token bloat
  if (msgs.length > MAX_TURNS) msgs.splice(0, 2);

  const systemContent = name
    ? SYSTEM_PROMPT + `\n\nEl nombre de la clienta es ${name}.`
    : SYSTEM_PROMPT;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemContent },
        ...msgs
      ],
      max_tokens: 350,
      temperature: 0.75
    });

    const reply = completion.choices[0].message.content.trim();
    msgs.push({ role: 'assistant', content: reply });

    return res.json(buildReply(reply));
  } catch (err) {
    console.error('OpenAI error:', err.message);
    return res.json(buildReply('Un momento, ahora mismo te contesto 🌿'));
  }
});

function buildReply(text) {
  return {
    version: 'v2',
    content: {
      messages: [{ type: 'text', text }]
    }
  };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Victoria webhook running on :${PORT}`));
