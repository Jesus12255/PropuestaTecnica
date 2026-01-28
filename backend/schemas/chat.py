"""
Schemas for chat functionality.
"""
from typing import Literal
from pydantic import BaseModel, Field


class ChatHistoryItem(BaseModel):
    """A single message in the conversation history."""
    role: Literal["user", "assistant"] = Field(..., description="Who sent the message")
    content: str = Field(..., description="Message content")


class RFPChatRequest(BaseModel):
    """Request body for RFP contextual chat."""
    message: str = Field(..., min_length=1, max_length=2000, description="User's current question")
    history: list[ChatHistoryItem] = Field(
        default=[], 
        max_length=20,
        description="Conversation history (last 20 messages max)"
    )


class RFPChatResponse(BaseModel):
    """Response from RFP contextual chat."""
    response: str = Field(..., description="AI response based on RFP context")
    rfp_id: str = Field(..., description="ID of the RFP used for context")

