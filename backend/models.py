from pydantic import BaseModel
from typing import Optional, Dict

class ChatRequest(BaseModel):
    user_input: str
    thread_id: str

class ChatResponse(BaseModel):
    message: str
    phase: str
    is_sufficient: bool
    data: Optional[Dict[str, str]] = None
