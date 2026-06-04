from models import Memories
from AI.RAG import embeddings
from pydantic import BaseModel
from logs.logging import logger
from typing import List, Literal
from database import SessionLocal
from AI.config.state import AgentState
from AI.config.AI_models import extractor_llm
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, AIMessage

# ============================================================
# PROMPT - FIXED: Using a raw string to avoid formatting issues
# ============================================================

PROMPT_TEMPLATE = """
You are a memory extraction system.

Your job is to extract useful long-term memory about the user.

Rules:
- Only extract stable facts (preferences, personal info, habits, goals)
- Ignore temporary conversation
- Do NOT include full messages
- Keep memory concise and structured
- If nothing important, return empty list

Return JSON in this exact format:
{
  "memories": [
    {
      "type": "preference",
      "key": "color",
      "value": "pink"
    }
  ]
}

Conversation:
{conversation}
"""

# ============================================================
# SCHEMA
# ============================================================

class MemoryItem(BaseModel):
    type : Literal["preference", "personal/fact", "goal", "habit"]
    key : str
    value : str


class ExtractedMemory(BaseModel):
    memories: List[MemoryItem]


extractor_llm = extractor_llm.with_structured_output(ExtractedMemory)

# ============================================================
# MEMORY SAVER 
# ============================================================

async def memory_saver(user_info, memories: List[MemoryItem]):
    db = SessionLocal()

    try:
        for memory in memories:
            # Check if memory already exists
            existing = db.query(Memories).filter_by(user_id = user_info["id"], key = memory.key).first()

            # Generate embedding for the memory value
            memory_embedding = embeddings.embed_query(memory.value)

            if existing:
                # update existing memory
                existing.value = memory.value
                existing.type = memory.type
                existing.embedding = memory_embedding  # Update embedding too
                logger.info(f"Updated memory : {memory.key} = {memory.value}")
            else:
                # insert new memory with embedding
                db.add(Memories(
                    user_id = user_info["id"],
                    user_role = user_info["role"],
                    type = memory.type,
                    key = memory.key,
                    value = memory.value,
                    embedding = memory_embedding  # Add the embedding here
                ))
                logger.info(f"Added memory: {memory.key} = {memory.value}")

        db.commit()
        logger.info(f"Saved {len(memories)} memories")

    except Exception as e:
        logger.info(f"Error saving memories: {e}")
        db.rollback()
    finally:
        db.close()

# ============================================================
# EXTRACTOR NODE
# ============================================================

async def extractor_node(state: AgentState) -> AgentState:
    try:
        messages = state["messages"]
        user_info = state["user_info"]

        # Format conversation history
        conversation_lines = []
        for msg in messages[-10:]:  # Last 10 messages max
            if isinstance(msg, HumanMessage):
                conversation_lines.append(f"User : {msg.content}")
            elif isinstance(msg, AIMessage):
                conversation_lines.append(f"Assistant : {msg.content}")
        
        conversation = "\n".join(conversation_lines)
        
        if not conversation:
            logger.info("No conversation to extract from")
            return state

        # Format prompt - using simple string replacement
        system_prompt = PROMPT_TEMPLATE.replace("{conversation}", conversation)

        # Extract memories
        result = await extractor_llm.ainvoke(system_prompt)
        
        # Save if we got any memories
        if result and result.memories:
            await memory_saver(user_info, result.memories)
            logger.info(f"Extracted {len(result.memories)} memories")
            logger.info(f"Saved {result.memories} memories")
            logger.info("="*60,end="\n")
        else:
            logger.info("No memories extracted")

    except Exception as e:
        logger.info(f"Error in extractor node: {e}")
        import traceback
        traceback.print_exc()
    
    return state

# ============================================================
# GRAPH BUILD
# ============================================================

async def build_extractor_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("extractor", extractor_node)

    workflow.add_edge(START, "extractor")
    workflow.add_edge("extractor", END)

    return workflow.compile()

# ============================================================
# GRAPH GETTER 
# ============================================================

extractor_graph = None

async def get_extractor_graph():
    global extractor_graph
    if extractor_graph is None:
        extractor_graph = await build_extractor_graph()
        logger.info("Extractor graph compiled")
    return extractor_graph