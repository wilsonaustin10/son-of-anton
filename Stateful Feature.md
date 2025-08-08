To make your **Anton** voice agent “stateful,” you need to give it a way to remember prior turns and to persist that knowledge across sessions.  The OpenAI Realtime API already maintains a stateful **Conversation** for each session – it stores every turn in a session (user and assistant messages) as “conversation items,” while the **Session** controls global settings.  By default this memory is limited to a single session, and older turns can exhaust the 128K‑token context window.  Below is a practical design for adding scalable, long‑term memory compatible with your current Next.js/WebRTC architecture.

---

### 1. Capture and track conversation turns

1. **Track events in the client.**  Extend `useRealtimeAgent` to maintain a `conversationState` object similar to the OpenAI cookbook example.  Each time you receive a final user transcript (`conversation.item.input_audio_transcription.completed`) or an assistant response (`response.done`) push an object `{role: 'user'|'assistant', item_id, text}` into `conversationState.history`.  Also track the running token count (`latest_tokens`) returned in `response.done`.  The OpenAI cookbook shows how a simple `ConversationState` class stores `history`, `summary_count` and `latest_tokens`.

2. **Detect when to summarise.**  Decide on a safe token threshold (e.g. 20 000 tokens).  When `latest_tokens` exceeds this and there are more than two recent turns, trigger a summarisation step.  OpenAI’s example monitors `latest_tokens` and fires a background summarisation coroutine once the threshold is reached.

### 2. Summarise and prune old context (within-session memory)

1. **Generate a summary.**  Collect all but the last `N` turns (e.g. last 2 turns) and create a single text string like `user: …\nassistant: …` for those turns.  Send this text to a lightweight Chat Completion model (e.g. `gpt‑4o‑mini`) with a system prompt instructing it to produce a concise summary.  The cookbook demonstrates a `run_summary_llm` helper that calls `openai.chat.completions.create` and returns the summary text.

2. **Insert the summary into the Realtime session.**  Use the data channel to send a `conversation.item.create` message where:

   ```json
   {
     "type": "conversation.item.create",
     "previous_item_id": "root",
     "item": {
       "id": summary_id,
       "type": "message",
       "role": "system",
       "content": [ { "type": "input_text", "text": summary_text } ]
     }
   }
   ```

   Append this summary locally to the start of `conversationState.history` (with `role: 'assistant'` for the code’s convenience).  Because the summary is marked as a **system** message, the model treats it as context rather than as audio to speak, preventing it from switching modalities.

3. **Delete old items.**  For each summarised turn, send a `conversation.item.delete` message with the original `item_id`.  This frees tokens on the server and ensures the context window doesn’t grow indefinitely.  Update `conversationState.history` to include only the summary and the last `N` turns.

This approach keeps your voice agent responsive while letting it “remember” earlier parts of the conversation in a compressed form.  It’s exactly the method recommended by OpenAI in their context‑summarisation example.

### 3. Persist memory across sessions (long‑term memory)

The Realtime API’s conversation state ends when the session closes.  To have Anton remember previous sessions:

1. **Store summaries in a database.**  After each session ends (e.g. when the user clicks “Disconnect”), call a Next.js API route that persists the final `conversationState.history` to a datastore keyed by the user (for example, SQLite, PostgreSQL or a vector database).  Store both raw transcripts and their summaries so you can regenerate memory later.

2. **Efficient retrieval with embeddings.**  For scalability, generate embeddings for each saved summary or message using OpenAI’s embeddings API and store them with a vector store (e.g. pgvector, Pinecone or Supabase).  When a new session starts, embed the user’s first utterance and perform a vector search to retrieve the most relevant previous summaries or messages.  This “retrieval‑augmented generation” means you only bring back context relevant to the user’s current intent, making memory lookup O(log n) instead of scanning entire transcripts.  Pinecone’s guides explain that LLMs are stateless and conversational memory must be managed externally.

3. **Seed the new session with past context.**  When minting a new session token (`/api/session`), include the retrieved summary in the `instructions` field sent to OpenAI.  For example:

   ```ts
   body: JSON.stringify({
     model: 'gpt-4o-realtime-preview-2024-12-17',
     voice: 'echo',
     instructions: `You are Anton…\n\nHere is context from past sessions:\n${retrievedSummary}\n\nFollow the user’s instructions…`,
     …
   })
   ```

   This primes the model with relevant memory at the start of the session.

4. **Optional incremental updates.**  During a conversation, you can insert additional context by sending `conversation.item.create` messages with `role: "system"` to add new memories (e.g. retrieved from the vector store) into the current session, similar to the summarisation step above.

### 4. Architectural considerations

* **Client vs server:**  Keep token‑heavy operations (summarisation, embedding) on the server to avoid blocking the user interface.  Your Next.js API routes (under `/api`) are ideal places to implement summarisation and vector‑store interactions.
* **Asynchronous processing:**  Trigger summarisation and embedding in background jobs to avoid delaying the user’s audio stream.  The code from OpenAI runs summarisation in a separate coroutine so it doesn’t block event handling.
* **Tuning thresholds:**  In the example, summarisation is triggered at 2 000 tokens for demonstration; in production you might allow 20 000–32 000 tokens depending on observed performance.
* **Multiple users:**  If Anton will handle multiple users concurrently, partition your memory store by user ID so conversations don’t leak across users.

### 5. Summary

LLMs are stateless by default – they do not remember prior turns unless you explicitly pass the history.  The OpenAI Realtime API provides a stateful conversation inside a session, but you must manage that state and compress it as it grows.  Implement a `conversationState` in your `useRealtimeAgent` hook to capture each turn, monitor token usage, and automatically summarise old context when a threshold is reached using a secondary Chat Completion model.  Send the summary as a **system** message via `conversation.item.create` and delete the original messages to free tokens.  To remember across sessions, persist these summaries and (optionally) embeddings in a database or vector store, and retrieve relevant context at the start of each new session to seed the model’s instructions.  This design fits naturally into your current Next.js/WebRTC setup, scales efficiently, and keeps Anton’s responses coherent over long interactions.
