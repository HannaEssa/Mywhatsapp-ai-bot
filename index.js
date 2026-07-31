const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// --- CONFIGURATION ---
const MY_VERIFY_TOKEN = "YOUR_CUSTOM_VERIFY_TOKEN";

// Meta API Credentials
const PHONE_NUMBER_ID = "YOUR_META_PHONE_NUMBER_ID"; 
const GRAPH_API_TOKEN = "YOUR_META_GRAPH_API_TOKEN";

// 👈 PASTE YOUR GROQ API KEY HERE (from console.groq.com)
const GROQ_API_KEY = "gsk_YOUR_GROQ_API_KEY"; 

// System Instruction for AI Assistant
const SYSTEM_INSTRUCTION = `
You are a personal WhatsApp writing assistant.
1. If the user's message is in Urdu or Roman Urdu, understand the informal slang and context, then translate it into natural, fluent English.
2. If the user's message is in English, fix any grammar or spelling errors and provide a polished version.
Keep responses concise, clear, and direct.
`;

// Helper function: Send request to Groq (Llama 3.3 70B)
async function getGroqResponse(userText) {
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: userText }
        ],
        temperature: 0.5
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const replyText = response.data?.choices?.[0]?.message?.content;
    if (replyText) {
      console.log(`✅ Groq AI responded successfully!`);
      return replyText;
    }
  } catch (err) {
    console.error("❌ Groq API Error:", err.response?.data || err.message);
  }

  return "Sorry, I couldn't process that text right now. Please try again!";
}

// 1. Meta Webhook Verification Handshake
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
    console.log("SUCCESS: Webhook verified by Meta!");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2. Receiving and Responding to WhatsApp Messages
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message && message.type === 'text') {
      const fromNumber = message.from;
      const userText = message.text.body;

      console.log(`💬 User sent: "${userText}"`);

      // Get response from Groq AI
      const replyText = await getGroqResponse(userText);

      console.log(`🤖 AI Answer: "${replyText}"`);
      await sendWhatsAppMessage(fromNumber, replyText);
    }
  } catch (error) {
    console.error("Error handling webhook:", error.message);
  }
});

// Send outbound message via Meta Graph API
async function sendWhatsAppMessage(toPhoneNumber, messageBody) {
  try {
    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
    
    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toPhoneNumber,
        type: "text",
        text: { body: messageBody }
      },
      {
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(`✅ Reply sent successfully to ${toPhoneNumber}!`);
  } catch (error) {
    console.error("❌ Failed to send WhatsApp message:", error.response?.data || error.message);
  }
}

app.listen(3000, () => {
  console.log('🚀 Server is running on http://localhost:3000');
});